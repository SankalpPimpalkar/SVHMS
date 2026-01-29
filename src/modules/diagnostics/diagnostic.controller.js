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
}