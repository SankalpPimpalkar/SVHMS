import DiagnosticsModel from "./diagnostic.model.js";

class DiagnosticService {
    static async getDiagnostics(vehicleId, userId) {
        if (!vehicleId || !userId) {
            throw new Error("vehicleId and userId are required");
        }

        const diagnostics = await DiagnosticsModel
            .find({ vehicle: vehicleId, user: userId })
            .sort({ "timeWindow.end": -1 })
            .select("-rawOBDIds -__v -vehicle -user")
            .lean();

        return diagnostics;
    }
}

export default DiagnosticService;
