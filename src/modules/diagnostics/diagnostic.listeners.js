import eventBus from "../../shared/events/EventBus.js";
import { explainOBDWithLLM } from "../ai/groq.ai.js";
import runOBDRulesAndCreateReport from "../rules/rule.engine.js";
import DiagnosticsModel from "./diagnostic.model.js";

eventBus.on('obd-data:created', async ({ obdRecords, vehicleId, userId }) => {
    const { avgSignals, diagnosticId, confidenceScore } = await runOBDRulesAndCreateReport(obdRecords, vehicleId, userId)
    const response = await explainOBDWithLLM(avgSignals);
    const diagnosticReport = await DiagnosticsModel.findById(diagnosticId)
    console.log("AI RESPONSE", response)

    diagnosticReport.aiSnapshot.summary = response.explanation
    diagnosticReport.aiSnapshot.confidenceScore = confidenceScore
    diagnosticReport.aiSnapshot.likely_issue = response.likely_issue
    diagnosticReport.aiSnapshot.affected_parts = response.affected_parts

    await diagnosticReport.save()
    console.log("DIAGNOSTIC REPORT", diagnosticReport)
})