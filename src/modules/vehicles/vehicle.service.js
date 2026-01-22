import VehicleModel from "./vehicle.model.js";
import { NotFoundError, BadRequestError } from "../../shared/errors/types.js";

export class VehicleService {
    static async createVehicle(userId, manufacturer, model, year, engineType) {

        if (!manufacturer || !model || !year || !engineType) {
            throw new BadRequestError("All vehicle fields are required");
        }

        const newVehicle = await VehicleModel.create({
            user: userId,
            manufacturer,
            model,
            year,
            engineType
        });

        return newVehicle;
    }

    static async getVehiclesByUser(userId) {
        return VehicleModel.find({ user: userId }).select("-user -__v").lean();
    }

    static async getVehicleById(userId, vehicleId) {
        const vehicle = await VehicleModel.findById(vehicleId);

        if (!vehicle) {
            throw new NotFoundError("Vehicle not found");
        }

        if (vehicle.user.toString() !== userId.toString()) {
            throw new BadRequestError("Unauthorized access to this vehicle");
        }

        return vehicle;
    }

    static async updateVehicle(userId, vehicleId, updateData) {
        const vehicle = await this.getVehicleById(userId, vehicleId);

        const allowedFields = ["manufacturer", "model", "year", "engineType"];

        allowedFields.forEach((field) => {
            if (updateData[field] !== undefined) {
                vehicle[field] = updateData[field];
            }
        });

        await vehicle.save();
        return vehicle;
    }

    static async deleteVehicle(userId, vehicleId) {
        const vehicle = await this.getVehicleById(userId, vehicleId);

        await vehicle.deleteOne();
        return vehicle;
    }
}
