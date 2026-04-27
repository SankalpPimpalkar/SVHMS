import DiagnosticsModel from "./diagnostic.model.js";
import OBDModel from "../obd/obd.model.js";
import Batch from "../batch/batch.model.js";
import { BaselineService } from "../baseline/baseline.service.js";
import { explainOBDWithLLM } from "../ai/groq.ai.js";
import {
    OBD_RECORD_THRESHOLD,
    REPORT_BATCH_WINDOW,
    CONFIDENCE_LLM_WEIGHT
} from "../../configs/env.config.js";
import { OBDService } from "../obd/obd.service.js";
import { BadRequestError } from "../../shared/errors/types.js";

class DiagnosticService {
    static #clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    static #computeHealthScore(anomalyContext) {
        if (!anomalyContext?.modelAvailable) {
            return 75;
        }

        const anomalyScore = this.#clamp(Number(anomalyContext?.anomalyScore) || 0, 0, 100);
        const triggeredCount = Array.isArray(anomalyContext?.triggeredMetrics)
            ? anomalyContext.triggeredMetrics.length
            : 0;

        // Use moderated anomaly impact so non-critical findings do not collapse health too aggressively.
        const anomalyImpact = anomalyScore * 0.75;
        const triggeredPenalty = Math.min(18, triggeredCount * 4);
        const health = this.#clamp(
            Math.round(100 - anomalyImpact - triggeredPenalty),
            0,
            100
        );
        return health;
    }

    static #computeLLMHealthAdjustment(aiResponse, anomalyContext) {
        const explanation = String(aiResponse?.explanation || "");
        const llmUnavailable = [
            "LLM request failed",
            "AI response could not be parsed"
        ].includes(explanation);

        if (llmUnavailable) {
            return { adjustment: 0, reason: "LLM unavailable" };
        }

        // If baseline says no anomaly, do not allow LLM to penalize health.
        if (!anomalyContext?.anomalyDetected) {
            return { adjustment: 0, reason: "No baseline anomaly detected" };
        }

        const rawAdjustment = Number(aiResponse?.health_adjustment);
        if (Number.isFinite(rawAdjustment)) {
            const bounded = this.#clamp(Math.round(rawAdjustment), -8, 0);
            return { adjustment: bounded, reason: "LLM-provided health adjustment" };
        }

        const band = String(aiResponse?.severity_band || "").toLowerCase();
        const bandMap = {
            low: 0,
            medium: -2,
            high: -4,
            critical: -7
        };

        if (Object.prototype.hasOwnProperty.call(bandMap, band)) {
            return { adjustment: bandMap[band], reason: `LLM severity band: ${band}` };
        }

        return { adjustment: 0, reason: "No valid LLM severity signal" };
    }

    static #computeEvidenceStrength(anomalyContext) {
        const anomalyScore = this.#clamp(Number(anomalyContext?.anomalyScore) || 0, 0, 100);
        const breachRatio = this.#clamp(Number(anomalyContext?.breachRatio) || 0, 0, 1);
        const batchBreachRatio = this.#clamp(Number(anomalyContext?.batchBreachRatio) || 0, 0, 1);
        const batchCount = Math.max(0, Number(anomalyContext?.batchCount) || 0);
        const checkedCount = Math.max(0, Number(anomalyContext?.checkedCount) || 0);
        const avgZ = this.#clamp(Number(anomalyContext?.avgZScore) || 0, 0, 6);
        const zStd = this.#clamp(Number(anomalyContext?.zScoreStdDev) || 0, 0, 6);

        const sufficiency = this.#clamp(batchCount / 24, 0, 1);
        const coverage = this.#clamp(checkedCount / (Math.max(batchCount, 1) * 5), 0, 1);

        // Confidence should be high when evidence is decisive either way:
        // mostly normal OR consistently abnormal. Ambiguous middle is lower.
        const decisiveness = this.#clamp(Math.abs((breachRatio * 2) - 1), 0, 1);

        // Consistency penalizes noisy/contradictory signals.
        const consistency = this.#clamp(1 - (zStd / 2), 0, 1);

        // Strong anomaly can increase certainty, but should not dominate confidence.
        const anomalySignal = this.#clamp(anomalyScore / 100, 0, 1);

        const evidenceStrength = Math.round(
            (45 * sufficiency) +
            (15 * coverage) +
            (15 * decisiveness) +
            (15 * consistency) +
            (10 * anomalySignal)
        );

        // With sufficient, consistent data, confidence should not collapse to very low values.
        const minFloor = batchCount >= 12 ? 60 : 45;
        return this.#clamp(evidenceStrength, minFloor, 95);
    }

    static #blendConfidence(aiResponse, anomalyContext) {
        const llmRaw = Number(aiResponse?.confidence_percentage);
        const llmConfidence = Number.isFinite(llmRaw)
            ? this.#clamp(Math.round(llmRaw), 0, 100)
            : null;

        const evidenceConfidence = this.#computeEvidenceStrength(anomalyContext);
        const llmWeight = this.#clamp(Number(CONFIDENCE_LLM_WEIGHT) || 0.85, 0, 1);
        const evidenceWeight = 1 - llmWeight;

        if (llmConfidence === null) {
            return {
                confidenceScore: evidenceConfidence,
                confidenceReasoning: `Deterministic evidence score used (${evidenceConfidence}) because LLM confidence was unavailable.`
            };
        }

        const blended = this.#clamp(
            Math.round((llmConfidence * llmWeight) + (evidenceConfidence * evidenceWeight)),
            0,
            100
        );

        return {
            confidenceScore: blended,
            confidenceReasoning: `Blended confidence: LLM ${llmConfidence} (${llmWeight.toFixed(2)}) + evidence ${evidenceConfidence} (${evidenceWeight.toFixed(2)}).`
        };
    }

    static #buildRuleBasedFallback(anomalyContext) {
        const triggered = Array.isArray(anomalyContext?.triggeredMetrics)
            ? anomalyContext.triggeredMetrics
            : [];

        if (!triggered.length) {
            return {
                likely_issue: "No critical anomaly detected from baseline",
                affected_parts: [],
                confidence_percentage: Math.max(10, Number(anomalyContext?.anomalyScore) || 0),
                explanation: "Rule-based baseline comparison found no significant threshold violations in recent batches."
            };
        }

        const topTriggered = triggered
            .slice(0, 3)
            .map(t => `${t.metric} (z=${t.zScore})`);

        return {
            likely_issue: "Baseline deviation detected in recent telemetry",
            affected_parts: triggered.map(t => t.metric),
            confidence_percentage: Math.max(30, Number(anomalyContext?.anomalyScore) || 0),
            explanation: `Rule-based anomaly detection flagged: ${topTriggered.join(", ")}.`
        };
    }

    /**
     * Get count of OBD records for vehicle
     */
    static async getRecordCount(vehicleId, userId) {
        const count = await OBDModel.countDocuments({
            vehicle: vehicleId,
            user: userId
        });
        return count;
    }

    /**
     * Get all diagnostics for vehicle
     */
    static async getDiagnostics(vehicleId, userId) {
        if (!vehicleId || !userId) {
            throw new Error("vehicleId and userId are required");
        }

        const diagnostics = await DiagnosticsModel
            .find({ vehicle: vehicleId, user: userId })
            .sort({ createdAt: -1 })
            .select("-__v -vehicle -user")
            .lean();

        return diagnostics;
    }

    /**
     * Manually trigger report generation
     * Checks threshold and generates diagnostic if enough data collected
     */
    static async generateManualReport(vehicleId, userId, options = {}) {
        const {
            espAnomalyFlag = false,
            seedCsv = ""
        } = options;

        const threshold = Number(OBD_RECORD_THRESHOLD) || 100;
        let seedResult = null;
        let recordCount = await this.getRecordCount(vehicleId, userId);

        if (recordCount === 0 && seedCsv && seedCsv.trim()) {
            seedResult = await OBDService.seedFromCSV(userId, vehicleId, seedCsv);
            recordCount = await this.getRecordCount(vehicleId, userId);
        }

        if (recordCount < threshold) {
            throw new BadRequestError(
                `Insufficient data for accurate diagnosis. Collected ${recordCount}/${threshold} records. Please drive and collect more data.`,
                { collected: recordCount, required: threshold, seedResult }
            );
        }

        // Use recent coherent window for report generation.
        const batchWindow = Math.max(5, Number(REPORT_BATCH_WINDOW) || 24);
        const batches = await Batch.find({
            vehicle: vehicleId,
            user: userId
        })
            .sort({ createdAt: -1 })
            .limit(batchWindow)
            .lean();

        if (!batches.length) {
            throw new BadRequestError("No batch data available for analysis");
        }

        // Use all available OBD records for this vehicle/user in time order.
        const recentOBDRecords = await OBDModel.find({
            vehicle: vehicleId,
            user: userId
        })
            .sort({ receivedAt: 1 })
            .lean();

        if (!recentOBDRecords.length) {
            throw new BadRequestError("No OBD records found for analysis");
        }

        // Build LLM input from batches
        const llmInput = batches.map(b => ({
            engine: {
                avgRPM: b.engine?.avgRPM ?? 0,
                avgLoad: b.engine?.avgLoad ?? 0,
                avgPowerKW: b.engine?.avgPowerKW ?? 0
            },
            airflow: {
                avgMAP: b.airflow?.avgMAP ?? 0,
                avgMAF: b.airflow?.avgMAF ?? 0
            },
            fuel: {
                avgAFRMeasured: b.fuel?.avgAFRMeasured ?? 14.7,
                avgLTFT: b.fuel?.avgLTFT ?? 0
            },
            thermal: {
                avgIntakeTemp: b.thermal?.avgIntakeTemp ?? 0,
                maxCatalystTemp: b.thermal?.maxCatalystTemp ?? 0
            },
            electrical: {
                minECUVoltage: b.electrical?.minECUVoltage ?? 12,
                minOBDVoltage: b.electrical?.minOBDVoltage ?? 12
            }
        }));

        let baselineModel = null;
        try {
            baselineModel = await BaselineService.getLatestBaseline(userId, vehicleId);
        } catch {
            baselineModel = await BaselineService.generateBaseline(userId, vehicleId, threshold);
        }

        const anomalyContext = this.#detectAnomaliesFromBaseline(batches, baselineModel);

        let aiResponse = {
            likely_issue: "Analysis in progress",
            affected_parts: [],
            confidence_percentage: 0,
            explanation: "Generating AI insights..."
        };

        try {
            aiResponse = await explainOBDWithLLM(llmInput, anomalyContext);
        } catch (aiError) {
            console.warn("[DIAGNOSTIC] AI analysis failed, using rule engine only:", aiError.message);
        }

        const llmUnavailable = [
            "LLM request failed",
            "AI response could not be parsed"
        ].includes(String(aiResponse?.explanation || ""));

        if (llmUnavailable || !Number.isFinite(Number(aiResponse?.confidence_percentage))) {
            const fallback = this.#buildRuleBasedFallback(anomalyContext);
            aiResponse = {
                likely_issue: fallback.likely_issue,
                affected_parts: fallback.affected_parts,
                confidence_percentage: fallback.confidence_percentage,
                explanation: `${fallback.explanation} (LLM unavailable, fallback used.)`
            };
        }

        const blendedConfidence = this.#blendConfidence(aiResponse, anomalyContext);

        // Calculate time window
        const now = new Date();
        const timeWindowStart = new Date(recentOBDRecords[0].receivedAt);
        const timeWindowEnd = new Date(recentOBDRecords[recentOBDRecords.length - 1].receivedAt);

        const baseHealthScore = this.#computeHealthScore(anomalyContext);
        const llmHealthAdjustmentResult = this.#computeLLMHealthAdjustment(aiResponse, anomalyContext);
        const healthScore = this.#clamp(
            baseHealthScore + llmHealthAdjustmentResult.adjustment,
            0,
            100
        );

        // Create diagnostic
        const diagnostic = await DiagnosticsModel.create({
            vehicle: vehicleId,
            user: userId,
            timeWindow: { start: timeWindowStart, end: timeWindowEnd },
            batchIds: batches.map(b => b._id),
            recordsUsed: recentOBDRecords.length,
            isManuallyTriggered: true,
            espAnomalyFlag: espAnomalyFlag,
            espAnomalyDetails: JSON.stringify(anomalyContext),
            baselineModelId: baselineModel?._id,
            aiSnapshot: {
                summary: aiResponse.explanation,
                likely_issue: aiResponse.likely_issue,
                affected_parts: aiResponse.affected_parts,
                baseHealthScore,
                llmHealthAdjustment: llmHealthAdjustmentResult.adjustment,
                healthScoreReasoning: `${llmHealthAdjustmentResult.reason}; base=${baseHealthScore}, final=${healthScore}`,
                healthScore,
                confidenceScore: blendedConfidence.confidenceScore,
                confidenceReasoning: blendedConfidence.confidenceReasoning
            }
        });

        console.log(`[DIAGNOSTIC] Manual report generated for vehicle ${vehicleId}, confidence: ${diagnostic.aiSnapshot.confidenceScore}%`);

        if (recordCount >= threshold && recordCount % (threshold * 2) === 0) {
            try {
                await BaselineService.generateBaseline(userId, vehicleId, threshold);
                console.log(`[DIAGNOSTIC] Baseline model refreshed at ${recordCount} records`);
            } catch (baselineError) {
                console.warn("[DIAGNOSTIC] Baseline refresh failed:", baselineError.message);
            }
        }

        return diagnostic;
    }

    static #detectAnomaliesFromBaseline(batches, baselineModel) {
        if (!baselineModel?.modelData || !batches?.length) {
            return {
                modelAvailable: false,
                anomalyDetected: false,
                anomalyScore: 0,
                triggeredMetrics: []
            };
        }

        let parsed;
        try {
            parsed = JSON.parse(Buffer.from(baselineModel.modelData).toString("utf8"));
        } catch {
            return {
                modelAvailable: false,
                anomalyDetected: false,
                anomalyScore: 0,
                triggeredMetrics: []
            };
        }

        const metricExtractor = {
            rpm: b => b.engine?.avgRPM ?? 0,
            maxRPM: b => b.engine?.maxRPM ?? 0,
            minRPM: b => b.engine?.minRPM ?? 0,
            engineLoad: b => b.engine?.avgLoad ?? 0,
            powerKW: b => b.engine?.avgPowerKW ?? 0,
            temperature: b => b.thermal?.avgIntakeTemp ?? 0,
            catalystTemp: b => b.thermal?.maxCatalystTemp ?? 0,
            map: b => b.airflow?.avgMAP ?? 0,
            maf: b => b.airflow?.avgMAF ?? 0,
            avgAFRMeasured: b => b.fuel?.avgAFRMeasured ?? 14.7,
            avgLTFT: b => b.fuel?.avgLTFT ?? 0,
            afrDeviation: b => b.fuel?.afrDeviation ?? 0,
            ecuVoltage: b => b.electrical?.minECUVoltage ?? 0,
            obdVoltage: b => b.electrical?.minOBDVoltage ?? 0
        };

        // RPM and engineLoad are expected to vary with driving behavior.
        // Use stricter thresholds and persistence checks to reduce false positives.
        const metricRules = {
            rpm: { zThreshold: 3.5, weight: 0.6 },
            maxRPM: { zThreshold: 3.6, weight: 0.5 },
            minRPM: { zThreshold: 3.4, weight: 0.5 },
            engineLoad: { zThreshold: 3.2, weight: 0.7 },
            powerKW: { zThreshold: 2.7, weight: 0.9 },
            temperature: { zThreshold: 2.2, weight: 1.0 },
            catalystTemp: { zThreshold: 2.1, weight: 1.0 },
            map: { zThreshold: 2.4, weight: 0.9 },
            maf: { zThreshold: 2.4, weight: 0.9 },
            avgAFRMeasured: { zThreshold: 2.4, weight: 0.9 },
            avgLTFT: { zThreshold: 2.3, weight: 0.95 },
            afrDeviation: { zThreshold: 2.2, weight: 1.0 },
            ecuVoltage: { zThreshold: 2.0, weight: 1.0 },
            obdVoltage: { zThreshold: 2.0, weight: 1.0 }
        };

        const triggeredByMetric = new Map();
        const metricBreachCount = new Map();
        const metricObservationCount = new Map();
        let scoreSum = 0;
        let checked = 0;
        let breachCount = 0;
        const breachedBatchSet = new Set();
        let batchIndex = 0;

        for (const batch of batches) {
            let batchBreached = false;
            for (const key of Object.keys(metricExtractor)) {
                const baseline = parsed?.thresholds?.[key];
                if (!baseline) continue;

                metricObservationCount.set(key, (metricObservationCount.get(key) || 0) + 1);

                const current = metricExtractor[key](batch);
                const std = Math.max(Number(baseline.stdDev) || 0, 0.01);
                const z = Math.abs((current - (Number(baseline.mean) || 0)) / std);
                const hardMin = Number(baseline.min);
                const hardMax = Number(baseline.max);
                const rule = metricRules[key] || { zThreshold: 2.2, weight: 1.0 };
                const breachedRange = Number.isFinite(hardMin) && Number.isFinite(hardMax)
                    ? current < hardMin || current > hardMax
                    : false;
                const breachedZ = z >= rule.zThreshold;

                if (breachedZ || breachedRange) {
                    breachCount += 1;
                    batchBreached = true;
                    metricBreachCount.set(key, (metricBreachCount.get(key) || 0) + 1);
                    const prev = triggeredByMetric.get(key);
                    if (!prev || z > prev.zScore) {
                        triggeredByMetric.set(key, {
                            metric: key,
                            current,
                            zScore: Number(z.toFixed(2))
                        });
                    }
                }

                scoreSum += Math.min(100, z * 20 * rule.weight);
                checked += 1;
            }
            if (batchBreached) {
                breachedBatchSet.add(batchIndex);
            }
            batchIndex += 1;
        }

        const triggeredMetrics = Array.from(triggeredByMetric.values()).filter(item => {
            const observed = metricObservationCount.get(item.metric) || 0;
            const breaches = metricBreachCount.get(item.metric) || 0;
            const breachRatioByMetric = observed ? breaches / observed : 0;

            // Require persistence for high-variance metrics to avoid noise flags.
            if (item.metric === "rpm" || item.metric === "engineLoad" || item.metric === "maxRPM" || item.metric === "minRPM") {
                return breaches >= 3 && breachRatioByMetric >= 0.25;
            }

            return breaches >= 1;
        });
        const anomalyScore = checked ? Math.round(scoreSum / checked) : 0;
        const breachRatio = checked ? breachCount / checked : 0;
        const batchBreachRatio = batches.length ? breachedBatchSet.size / batches.length : 0;

        // Compute z-score distribution to detect contradictory/noisy evidence.
        const zValues = [];
        for (const batch of batches) {
            for (const key of Object.keys(metricExtractor)) {
                const baseline = parsed?.thresholds?.[key];
                if (!baseline) continue;
                const current = metricExtractor[key](batch);
                const std = Math.max(Number(baseline.stdDev) || 0, 0.01);
                const z = Math.abs((current - (Number(baseline.mean) || 0)) / std);
                zValues.push(z);
            }
        }
        const avgZScore = zValues.length
            ? zValues.reduce((acc, val) => acc + val, 0) / zValues.length
            : 0;
        const zScoreStdDev = zValues.length
            ? Math.sqrt(zValues.reduce((acc, val) => acc + Math.pow(val - avgZScore, 2), 0) / zValues.length)
            : 0;

        return {
            modelAvailable: true,
            baselineModelId: String(baselineModel._id),
            baselineVersion: baselineModel.version,
            anomalyDetected: triggeredMetrics.length > 0,
            anomalyScore,
            breachRatio,
            batchBreachRatio,
            batchCount: batches.length,
            checkedCount: checked,
            avgZScore: Number(avgZScore.toFixed(3)),
            zScoreStdDev: Number(zScoreStdDev.toFixed(3)),
            triggeredMetrics
        };
    }

    /**
     * Get collection progress (for UI)
     */
    static async getCollectionProgress(vehicleId, userId) {
        const recordCount = await this.getRecordCount(vehicleId, userId);
        const threshold = Number(OBD_RECORD_THRESHOLD) || 100;
        const progress = Math.min(100, Math.round((recordCount / threshold) * 100));
        const canGenerate = recordCount >= threshold;

        return {
            recordsCollected: recordCount,
            recordsRequired: threshold,
            progress,
            canGenerate,
            message: canGenerate
                ? "You have enough data! Generate a report now."
                : `Collecting data: ${recordCount}/${threshold} records`
        };
    }
}

export default DiagnosticService;
