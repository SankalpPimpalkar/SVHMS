import { dbconnect } from "../../configs/db.config.js";
import DiagnosticService from "./diagnostic.service.js";

export class DiagnosticController {
    static async getDiagnostics(req, res, next) {
        await dbconnect()
        try {
            const { vehicleId } = req.params;
            const userId = req.user;

            if (!vehicleId || !userId) {
                return res.status(400).json({ message: "vehicleId and userId are required" });
            }

            const diagnostics = await DiagnosticService.getDiagnostics(vehicleId, userId);

            return res.status(200).json({
                success: true,
                data: diagnostics
            });
        } catch (error) {
            next(error)
        }
    }

    /**
     * Manually trigger report generation
     * Checks threshold before generating
     */
    static async generateReport(req, res, next) {
        await dbconnect()
        try {
            const { vehicleId } = req.params;
            const userId = req.user;
            const { espAnomalyFlag, seedCsv } = req.body;

            if (!vehicleId || !userId) {
                return res.status(400).json({ message: "Missing vehicleId or userId" });
            }

            const diagnostic = await DiagnosticService.generateManualReport(
                vehicleId,
                userId,
                {
                    espAnomalyFlag: espAnomalyFlag || false,
                    seedCsv: typeof seedCsv === "string" ? seedCsv : ""
                }
            );

            return res.status(201).json({
                success: true,
                message: "Report generated successfully",
                data: diagnostic
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get data collection progress
     */
    static async getProgress(req, res, next) {
        await dbconnect()
        try {
            const { vehicleId } = req.params;
            const userId = req.user;

            if (!vehicleId || !userId) {
                return res.status(400).json({ message: "Missing vehicleId or userId" });
            }

            const progress = await DiagnosticService.getCollectionProgress(vehicleId, userId);

            return res.status(200).json({
                success: true,
                data: progress
            });
        } catch (error) {
            next(error);
        }
    }
}