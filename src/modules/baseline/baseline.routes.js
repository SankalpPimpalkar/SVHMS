import { BaselineController } from "./baseline.controller.js";
import { Router } from "express";

const baselineRouter = Router({ mergeParams: true });

// Get complete model for transfer
baselineRouter.get('/', BaselineController.getModelForTransfer);

// Get specific chunk for BLE (low bandwidth)
baselineRouter.get('/chunk/:chunkIndex', BaselineController.getModelChunk);

// Mark model as deployed to ESP
baselineRouter.post('/:modelId/deployed', BaselineController.markAsDeployed);

export default baselineRouter;
