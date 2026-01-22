import OBDModel from "./obd.model.js";
import { BadRequestError } from "../../shared/errors/types.js";
import VehicleModel from "../vehicles/vehicle.model.js";
import eventBus from "../../shared/events/EventBus.js";

export class OBDService {
    static REQUIRED_FIELDS = [
        "deviceId",
        "gpsTime",
        "deviceTime",
        "receivedAt",
        "engineRPM",
        "ecuEngineRPM",
        "engineLoad",
        "engineLoadAbsolute",
        "timingAdvance",
        "ambientAirTemp",
        "intakeAirTemperature",
        "catalystTempBank1Sensor1",
        "barometricPressure",
        "intakeManifoldPressure",
        "turboBoostPressure",
        "airFuelRatioCommanded",
        "airFuelRatioMeasured",
        "massAirFlowRate",
        "fuelTrimLTFT_Bank1",
        "fuelTrimSTFT_Bank1",
        "fuelRemaining",
        "o2SensorWideRangeCurrent",
        "o2EquivalenceRatio",
        "o2SensorDownstreamVoltage",
        "commandedEquivalenceRatio",
        "ecuVoltage",
        "obdVoltage",
        "runTimeSinceEngineStart",
        "tripDistance",
        "distanceSinceCodesCleared",
        "distanceWithMILOn",
        "throttleAbsolute",
        "throttleRelative",
        "throttleManifold",
        "acceleratorPedalD",
        "acceleratorPedalE",
        "enginePowerKW",
        "torqueNm",
        "volumetricEfficiency"
    ];

    static async createOBDRecordsBulk(userId, vehicleId, obdRecords = []) {
        if (!Array.isArray(obdRecords) || obdRecords.length === 0) {
            throw new BadRequestError("OBD data must be a non-empty array");
        }

        const validRecords = [];
        const invalidRecords = [];

        for (let i = 0; i < obdRecords.length; i++) {
            const record = obdRecords[i];

            // Merge trusted fields
            const enrichedRecord = {
                ...record,
                user: userId,
                vehicle: vehicleId
            };

            const missingFields = this.REQUIRED_FIELDS.filter(
                field =>
                    enrichedRecord[field] === undefined ||
                    enrichedRecord[field] === null
            );

            if (missingFields.length > 0) {
                invalidRecords.push({
                    index: i,
                    missingFields
                });
                continue;
            }

            validRecords.push(enrichedRecord);
        }

        if (validRecords.length === 0) {
            throw new BadRequestError(
                "All OBD records are invalid",
                { invalidRecords }
            );
        }

        const insertedRecords = await OBDModel.insertMany(validRecords, {
            ordered: false
        });

        eventBus.emit('obd-data:created', {
            obdRecords: insertedRecords,
            vehicleId,
            userId
        })

        return {
            insertedCount: insertedRecords.length,
            failedCount: invalidRecords.length,
            failures: invalidRecords
        };
    }

    static async getOBDRecords(userId, vehicleId, options = {}) {
        const vehicle = await VehicleModel.findOne({
            _id: vehicleId,
            user: userId
        }).select("_id");

        if (!vehicle) {
            throw new UnauthorizedError(
                "Vehicle not found or does not belong to user"
            );
        }

        const query = {
            vehicle: vehicleId,
            user: userId
        };

        if (options.startDate || options.endDate) {
            query.receivedAt = {};
            if (options.startDate) query.receivedAt.$gte = options.startDate;
            if (options.endDate) query.receivedAt.$lte = options.endDate;
        }

        const limit = Math.min(options.limit || 100, 1000);

        return await OBDModel.find(query)
            .sort({ receivedAt: -1 })
            .limit(limit)
            .select("-user")
            .lean();
    }

    static async deleteOldRecords(beforeDate) {
        const result = await OBDModel.deleteMany({ receivedAt: { $lt: beforeDate } });
        return result;
    }
}
