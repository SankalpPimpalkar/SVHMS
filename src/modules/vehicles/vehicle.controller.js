import { dbconnect } from "../../configs/db.config.js";
import { VehicleService } from "./vehicle.service.js";

export class VehicleController {
    static async createVehicle(req, res, next) {
        await dbconnect()
        try {
            const userId = req.user;
            const { manufacturer, model, year, engineType } = req.body;

            const vehicle = await VehicleService.createVehicle(userId, manufacturer, model, year, engineType);
            res.status(201).json({ success: true, vehicle });
        } catch (err) {
            next(err);
        }
    }

    static async getVehicles(req, res, next) {
        await dbconnect()
        try {
            const userId = req.user;
            const vehicles = await VehicleService.getVehiclesByUser(userId);
            res.status(200).json({ success: true, vehicles });
        } catch (err) {
            next(err);
        }
    }

    static async getVehicleById(req, res, next) {
        await dbconnect()
        try {
            const userId = req.user;
            const { vehicleId } = req.params;

            const vehicle = await VehicleService.getVehicleById(userId, vehicleId);
            res.status(200).json({ success: true, vehicle });
        } catch (err) {
            next(err);
        }
    }

    static async updateVehicle(req, res, next) {
        await dbconnect()
        try {
            const userId = req.user;
            const { vehicleId } = req.params;
            const updateData = req.body;

            const updatedVehicle = await VehicleService.updateVehicle(userId, vehicleId, updateData);
            res.status(200).json({ success: true, vehicle: updatedVehicle });
        } catch (err) {
            next(err);
        }
    }

    static async deleteVehicle(req, res, next) {
        await dbconnect()
        try {
            const userId = req.user;
            const { vehicleId } = req.params;

            const deletedVehicle = await VehicleService.deleteVehicle(userId, vehicleId);
            res.status(200).json({ success: true, vehicle: deletedVehicle });
        } catch (err) {
            next(err);
        }
    }
}
