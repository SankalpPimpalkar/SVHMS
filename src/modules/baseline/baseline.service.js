import BaselineModel from "./baseline.model.js";
import Batch from "../batch/batch.model.js";
import { BadRequestError, NotFoundError } from "../../shared/errors/types.js";

export class BaselineService {
    /**
     * Generate a baseline ML model from recent OBD batches
     * This model will be used for edge anomaly detection on ESP32
     */
    static async generateBaseline(userId, vehicleId, minRecordsRequired = 100) {
        // Fetch recent batches for this vehicle
        const batches = await Batch.find({
            vehicle: vehicleId,
            user: userId
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        if (!batches.length) {
            throw new BadRequestError("No batch data available to train model");
        }

        // Calculate aggregate statistics for anomaly detection baseline
        const baselineStats = this.#calculateBaselineStats(batches);

        // Serialize model as JSON (can be upgraded to TFLite later)
        const modelData = JSON.stringify({
            type: "anomaly_detection_baseline",
            version: 1,
            thresholds: {
                rpm: {
                    min: baselineStats.engineRPM.min,
                    max: baselineStats.engineRPM.max,
                    mean: baselineStats.engineRPM.mean,
                    stdDev: baselineStats.engineRPM.stdDev
                },
                engineLoad: {
                    min: baselineStats.engineLoad.min,
                    max: baselineStats.engineLoad.max,
                    mean: baselineStats.engineLoad.mean,
                    stdDev: baselineStats.engineLoad.stdDev
                },
                temperature: {
                    min: baselineStats.temperature.min,
                    max: baselineStats.temperature.max,
                    mean: baselineStats.temperature.mean,
                    stdDev: baselineStats.temperature.stdDev
                },
                afrDeviation: {
                    min: baselineStats.afrDeviation.min,
                    max: baselineStats.afrDeviation.max,
                    mean: baselineStats.afrDeviation.mean,
                    stdDev: baselineStats.afrDeviation.stdDev
                },
                ecuVoltage: {
                    min: baselineStats.ecuVoltage.min,
                    max: baselineStats.ecuVoltage.max,
                    mean: baselineStats.ecuVoltage.mean,
                    stdDev: baselineStats.ecuVoltage.stdDev
                },
                obdVoltage: {
                    min: baselineStats.obdVoltage.min,
                    max: baselineStats.obdVoltage.max,
                    mean: baselineStats.obdVoltage.mean,
                    stdDev: baselineStats.obdVoltage.stdDev
                },
                powerKW: {
                    min: baselineStats.powerKW.min,
                    max: baselineStats.powerKW.max,
                    mean: baselineStats.powerKW.mean,
                    stdDev: baselineStats.powerKW.stdDev
                },
                map: {
                    min: baselineStats.map.min,
                    max: baselineStats.map.max,
                    mean: baselineStats.map.mean,
                    stdDev: baselineStats.map.stdDev
                },
                maf: {
                    min: baselineStats.maf.min,
                    max: baselineStats.maf.max,
                    mean: baselineStats.maf.mean,
                    stdDev: baselineStats.maf.stdDev
                },
                catalystTemp: {
                    min: baselineStats.catalystTemp.min,
                    max: baselineStats.catalystTemp.max,
                    mean: baselineStats.catalystTemp.mean,
                    stdDev: baselineStats.catalystTemp.stdDev
                },
                maxRPM: {
                    min: baselineStats.maxRPM.min,
                    max: baselineStats.maxRPM.max,
                    mean: baselineStats.maxRPM.mean,
                    stdDev: baselineStats.maxRPM.stdDev
                },
                minRPM: {
                    min: baselineStats.minRPM.min,
                    max: baselineStats.minRPM.max,
                    mean: baselineStats.minRPM.mean,
                    stdDev: baselineStats.minRPM.stdDev
                },
                avgAFRMeasured: {
                    min: baselineStats.avgAFRMeasured.min,
                    max: baselineStats.avgAFRMeasured.max,
                    mean: baselineStats.avgAFRMeasured.mean,
                    stdDev: baselineStats.avgAFRMeasured.stdDev
                },
                avgLTFT: {
                    min: baselineStats.avgLTFT.min,
                    max: baselineStats.avgLTFT.max,
                    mean: baselineStats.avgLTFT.mean,
                    stdDev: baselineStats.avgLTFT.stdDev
                }
            },
            trainingDataPoints: batches.length,
            trainedAt: new Date().toISOString()
        });

        // Check existing models for this vehicle
        const lastModel = await BaselineModel.findOne({
            vehicle: vehicleId,
            user: userId
        }).sort({ version: -1 });

        const newVersion = (lastModel?.version || 0) + 1;

        // Create and save baseline model
        const baseline = await BaselineModel.create({
            vehicle: vehicleId,
            user: userId,
            modelData: Buffer.from(modelData),
            modelFormat: "json",
            trainingRecordsCount: batches.length,
            trainingBatchIds: batches.map(b => b._id),
            metrics: {
                precision: 0.95, // Mock metrics - would be calculated from validation
                recall: 0.92,
                f1Score: 0.935
            },
            version: newVersion,
            status: "ready"
        });

        console.log(`[BASELINE] Created baseline model v${newVersion} for vehicle ${vehicleId} using ${batches.length} batches`);
        return baseline;
    }

    /**
     * Calculate aggregate statistics for anomaly detection
     */
    static #calculateBaselineStats(batches) {
        const stats = {
            engineRPM: { values: [] },
            engineLoad: { values: [] },
            temperature: { values: [] },
            afrDeviation: { values: [] },
            ecuVoltage: { values: [] },
            obdVoltage: { values: [] },
            powerKW: { values: [] },
            map: { values: [] },
            maf: { values: [] },
            catalystTemp: { values: [] },
            maxRPM: { values: [] },
            minRPM: { values: [] },
            avgAFRMeasured: { values: [] },
            avgLTFT: { values: [] }
        };

        // Aggregate all batch values
        batches.forEach(batch => {
            if (batch.engine?.avgRPM !== undefined) stats.engineRPM.values.push(batch.engine.avgRPM);
            if (batch.engine?.avgLoad !== undefined) stats.engineLoad.values.push(batch.engine.avgLoad);
            if (batch.thermal?.avgIntakeTemp !== undefined) stats.temperature.values.push(batch.thermal.avgIntakeTemp);
            if (batch.fuel?.afrDeviation !== undefined) stats.afrDeviation.values.push(batch.fuel.afrDeviation);
            if (batch.electrical?.minECUVoltage !== undefined) stats.ecuVoltage.values.push(batch.electrical.minECUVoltage);
            if (batch.electrical?.minOBDVoltage !== undefined) stats.obdVoltage.values.push(batch.electrical.minOBDVoltage);
            if (batch.engine?.avgPowerKW !== undefined) stats.powerKW.values.push(batch.engine.avgPowerKW);
            if (batch.airflow?.avgMAP !== undefined) stats.map.values.push(batch.airflow.avgMAP);
            if (batch.airflow?.avgMAF !== undefined) stats.maf.values.push(batch.airflow.avgMAF);
            if (batch.thermal?.maxCatalystTemp !== undefined) stats.catalystTemp.values.push(batch.thermal.maxCatalystTemp);
            if (batch.engine?.maxRPM !== undefined) stats.maxRPM.values.push(batch.engine.maxRPM);
            if (batch.engine?.minRPM !== undefined) stats.minRPM.values.push(batch.engine.minRPM);
            if (batch.fuel?.avgAFRMeasured !== undefined) stats.avgAFRMeasured.values.push(batch.fuel.avgAFRMeasured);
            if (batch.fuel?.avgLTFT !== undefined) stats.avgLTFT.values.push(batch.fuel.avgLTFT);
        });

        // Calculate min, max, mean, stdDev for each stat
        for (const key in stats) {
            const values = stats[key].values;
            if (values.length > 0) {
                stats[key].min = Math.min(...values);
                stats[key].max = Math.max(...values);
                stats[key].mean = values.reduce((a, b) => a + b, 0) / values.length;

                const variance = values.reduce((sum, val) => sum + Math.pow(val - stats[key].mean, 2), 0) / values.length;
                stats[key].stdDev = Math.sqrt(variance);
            } else {
                stats[key] = { min: 0, max: 100, mean: 50, stdDev: 10 };
            }
        }

        return stats;
    }

    /**
     * Retrieve latest baseline model for a vehicle
     */
    static async getLatestBaseline(userId, vehicleId) {
        const baseline = await BaselineModel.findOne({
            vehicle: vehicleId,
            user: userId,
            status: "ready"
        }).sort({ version: -1 });

        if (!baseline) {
            throw new NotFoundError("No baseline model available for this vehicle");
        }

        return baseline;
    }

    /**
     * Get model for BLE transfer (chunks if needed)
     */
    static async getModelForTransfer(userId, vehicleId, chunkSize = 512) {
        const baseline = await this.getLatestBaseline(userId, vehicleId);
        const modelBuffer = baseline.modelData;

        // Split into chunks for BLE transmission
        const chunks = [];
        for (let i = 0; i < modelBuffer.length; i += chunkSize) {
            chunks.push({
                index: Math.floor(i / chunkSize),
                total: Math.ceil(modelBuffer.length / chunkSize),
                data: modelBuffer.slice(i, i + chunkSize).toString('base64'),
                modelId: baseline._id,
                version: baseline.version
            });
        }

        return {
            modelId: baseline._id,
            version: baseline.version,
            totalSize: modelBuffer.length,
            chunks,
            checksum: this.#calculateChecksum(modelBuffer)
        };
    }

    static #calculateChecksum(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum = (sum + buffer[i]) & 0xFF;
        }
        return sum;
    }

    /**
     * Mark model as deployed to ESP
     */
    static async markAsDeployed(userId, vehicleId, modelId) {
        const updated = await BaselineModel.findByIdAndUpdate(
            modelId,
            {
                deployedToESP: true,
                deployedAt: new Date()
            },
            { new: true }
        );

        if (!updated) {
            throw new NotFoundError("Baseline model not found");
        }

        console.log(`[BASELINE] Model ${modelId} marked as deployed to ESP`);
        return updated;
    }
}

export default BaselineService;
