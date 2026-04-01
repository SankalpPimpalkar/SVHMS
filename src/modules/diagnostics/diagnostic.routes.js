import { DiagnosticController } from "./diagnostic.controller.js";
import { Router } from "express";

const diagnosticRouter = Router({ mergeParams: true })

diagnosticRouter.get('/', DiagnosticController.getDiagnostics)
diagnosticRouter.get('/progress', DiagnosticController.getProgress)
diagnosticRouter.post('/generate', DiagnosticController.generateReport)

export default diagnosticRouter