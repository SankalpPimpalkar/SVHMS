import cron from "node-cron";
import Batch from "../batch/batch.model.js";
import DiagnosticsModel from "./diagnostic.model.js";
import { explainOBDWithLLM } from "../ai/groq.ai.js";
import { dbconnect } from "../../configs/db.config.js";

/**
 * Legacy cron job for automatic diagnostic generation
 * NOW DISABLED - Reports are triggered manually via API or ESP32 anomaly detection
 * Kept for documentation purposes
 */
export default async function runDiagnosticJob(intervalMinutes = 5) {
    console.log(`[CRON] Diagnostic cron job is DISABLED. Use POST /vehicles/:vehicleId/diagnostics/generate for manual reports.`);
    // Cron job disabled - manual generation only
}

// DO NOT SCHEDULE CRON - Reports are now event-driven
// cron.schedule("0 * * * *", () => runDiagnosticJob(60));