import { dbconnect } from "../../configs/db.config.js";
import { BaselineService } from "./baseline.service.js";
import { NotFoundError, BadRequestError } from "../../shared/errors/types.js";

export class BaselineController {
    /**
     * Get baseline model for transfer to ESP32
     */
    static async getModelForTransfer(req, res, next) {
        await dbconnect()
        try {
            const { vehicleId } = req.params;
            const userId = req.user;

            if (!vehicleId) {
                return res.status(400).json({ message: "vehicleId required" });
            }

            const modelData = await BaselineService.getModelForTransfer(userId, vehicleId);

            return res.status(200).json({
                success: true,
                data: modelData
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get model chunk for BLE transmission (low-bandwidth variant)
     */
    static async getModelChunk(req, res, next) {
        await dbconnect()
        try {
            const { vehicleId, chunkIndex } = req.params;
            const userId = req.user;

            if (!vehicleId) {
                return res.status(400).json({ message: "vehicleId required" });
            }

            const modelData = await BaselineService.getModelForTransfer(userId, vehicleId, 244); // ~244 bytes fits in BLE 20-byte MTU
            
            if (!modelData.chunks[chunkIndex]) {
                throw new BadRequestError(`Chunk index ${chunkIndex} not found`);
            }

            return res.status(200).json({
                success: true,
                chunk: modelData.chunks[chunkIndex]
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mark model as deployed to ESP
     */
    static async markAsDeployed(req, res, next) {
        await dbconnect()
        try {
            const { vehicleId, modelId } = req.params;
            const userId = req.user;

            if (!vehicleId || !modelId) {
                return res.status(400).json({ message: "vehicleId and modelId required" });
            }

            const updated = await BaselineService.markAsDeployed(userId, vehicleId, modelId);

            return res.status(200).json({
                success: true,
                message: "Model marked as deployed",
                data: updated
            });
        } catch (error) {
            next(error);
        }
    }
}

export default BaselineController;
