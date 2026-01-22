import { DiagnosticController } from "./diagnostic.controller.js";
import { Router } from "express";

const diagnosticRouter = Router({ mergeParams: true })

diagnosticRouter.get('/', DiagnosticController.getDiagnostics)

export default diagnosticRouter