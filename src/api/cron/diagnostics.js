import runDiagnosticJob from "../../modules/diagnostics/diagnostic.cron.js";

export default async function handler(req, res) {
    await runDiagnosticJob(60);
    return res
        .status(200)
        .json({ success: true });
}