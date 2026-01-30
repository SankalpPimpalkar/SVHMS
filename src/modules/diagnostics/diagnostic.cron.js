import cron from "node-cron";
import Batch from "../batch/batch.model.js";
import DiagnosticsModel from "./diagnostic.model.js";
import { explainOBDWithLLM } from "../ai/groq.ai.js";
import { dbconnect } from "../../configs/db.config.js";

async function runDiagnosticJob(intervalMinutes = 5) {
    console.log(`[CRON] Running ${intervalMinutes}-minute diagnostic batch job`);
    await dbconnect();

    try {
        const since = new Date(Date.now() - 1000 * 60 * (intervalMinutes + 5));

        const vehicles = await Batch.aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: { vehicle: "$vehicle", user: "$user" } } }
        ]);

        if (!vehicles.length) {
            console.log(`[CRON] No batches found in the last ${intervalMinutes} minutes, skipping.`);
            return;
        }

        for (const { _id } of vehicles) {
            const { vehicle, user } = _id;

            const batches = await Batch.find({
                vehicle,
                user,
                createdAt: { $gte: since }
            }).lean();
            console.log("BATCHES", batches.flatMap(b => b._id))

            if (!batches.length) continue;

            // Map batches to LLM input
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

            const aiResponse = await explainOBDWithLLM(llmInput);

            // Calculate time window for diagnostics
            const diagStart = new Date();
            if (intervalMinutes === 60) {
                diagStart.setMinutes(0, 0, 0);
            } else {
                diagStart.setMinutes(Math.floor(diagStart.getMinutes() / intervalMinutes) * intervalMinutes, 0, 0);
            }
            const diagEnd = new Date(diagStart.getTime() + intervalMinutes * 60 * 1000);

            const diagnostic = await DiagnosticsModel.create({
                vehicle,
                user,
                timeWindow: { start: diagStart, end: diagEnd },
                batchIds: batches.flatMap(b => b._id)
            });

            // Update AI snapshot
            diagnostic.aiSnapshot = {
                summary: aiResponse.explanation,
                likely_issue: aiResponse.likely_issue,
                affected_parts: aiResponse.affected_parts,
                confidenceScore: aiResponse.confidence_percentage
            };
            console.log("DIAGNOSTIC", diagnostic)

            await diagnostic.save();
        }
    } catch (err) {
        console.error(`[CRON] Error in ${intervalMinutes}-minute diagnostic job:`, err);
    }
}

cron.schedule("0 * * * *", () => runDiagnosticJob(60));