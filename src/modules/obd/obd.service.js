import OBDModel from "./obd.model.js";
import { BadRequestError, UnauthorizedError } from "../../shared/errors/types.js";
import VehicleModel from "../vehicles/vehicle.model.js";
import eventBus from "../../shared/events/EventBus.js";
import { BatchService } from "../batch/batch.service.js";

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

        console.log("OBD RECORDS", obdRecords)
        await BatchService.saveBatches({
            obdReadings: insertedRecords,
            userId,
            vehicleId
        })
        console.log("Created Batches")

        return {
            insertedCount: insertedRecords.length,
            failedCount: invalidRecords.length,
            failures: invalidRecords
        };
    }

    static async seedFromCSV(userId, vehicleId, csvText = "") {
        if (typeof csvText !== "string" || !csvText.trim()) {
            throw new BadRequestError("CSV payload is required for seeding");
        }

        const existingCount = await OBDModel.countDocuments({
            user: userId,
            vehicle: vehicleId
        });

        if (existingCount > 0) {
            return {
                skipped: true,
                reason: "OBD data already exists for this vehicle",
                existingCount
            };
        }

        const lines = csvText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        if (lines.length < 2) {
            throw new BadRequestError("CSV must include a header and at least one data row");
        }

        const headers = lines[0].split(",").map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split(",").map(c => c.trim()));

        const toNumber = (value, fallback = 0) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : fallback;
        };

        const get = (row, aliases = [], fallback = "") => {
            for (const alias of aliases) {
                const idx = headers.findIndex(h => h.toLowerCase() === alias.toLowerCase());
                if (idx !== -1 && row[idx] !== undefined && row[idx] !== "") {
                    return row[idx];
                }
            }
            return fallback;
        };

        const records = rows.map((row, idx) => {
            const now = new Date(Date.now() + idx * 1000);
            const rpm = toNumber(get(row, ["Engine RPM(rpm)", "rpm"]), 900);
            const load = toNumber(get(row, ["Engine Load(%)", "load"]), 30);
            const absLoad = toNumber(get(row, ["Engine Load(Absolute)(%)", "absLoad"]), load);
            const power = toNumber(get(row, ["Engine kW (At the wheels)(kW)", "enginePowerKW"]), 40);
            const turboPsi = toNumber(get(row, ["Turbo Boost & Vacuum Gauge(psi)", "turboBoostPressure"]), 0);
            const baroPsi = toNumber(get(row, ["Barometric pressure (from vehicle)(psi)", "barometricPressure"]), 14.7);
            const relThrottle = toNumber(get(row, ["Relative Throttle Position(%)", "throttleRelative"]), 25);
            const manifoldThrottle = toNumber(get(row, ["Throttle Position(Manifold)(%)", "throttleManifold"]), relThrottle);
            const fuelRemaining = toNumber(get(row, ["Fuel Remaining (Calculated from vehicle profile)(%)", "fuelRemaining"]), 50);
            const intakeTemp = toNumber(get(row, ["Intake Air Temperature(°C)", "intakeAirTemperature"]), toNumber(get(row, ["Ambient air temp(°C)", "ambientAirTemp"]), 25) + 8);
            const tripDistance = toNumber(get(row, ["Trip Distance(km)", "tripDistance"]), idx * 0.1);

            const intakeManifoldPressure = Math.max(20, Math.min(250, 101.3 + turboPsi * 6.89476));
            const massAirFlowRate = Math.max(2, (rpm * absLoad) / 120000);
            const torqueNm = rpm > 0 ? (9549 * power) / Math.max(rpm, 600) : 0;

            return {
                deviceId: "APP-CSV-SEED-001",
                gpsTime: now.toISOString(),
                deviceTime: now.toISOString(),
                receivedAt: now.toISOString(),
                engineRPM: rpm,
                ecuEngineRPM: rpm,
                engineLoad: load,
                engineLoadAbsolute: absLoad,
                timingAdvance: toNumber(get(row, ["Timing Advance(°)", "timingAdvance"]), 12),
                ambientAirTemp: toNumber(get(row, ["Ambient air temp(°C)", "ambientAirTemp"]), 25),
                intakeAirTemperature: intakeTemp,
                catalystTempBank1Sensor1: toNumber(get(row, ["Catalyst Temperature (Bank 1 Sensor 1)(°C)", "catalystTempBank1Sensor1"]), 650),
                barometricPressure: baroPsi * 6.89476,
                intakeManifoldPressure,
                turboBoostPressure: turboPsi * 6.89476,
                airFuelRatioCommanded: toNumber(get(row, ["Air Fuel Ratio(Commanded)(:1)", "airFuelRatioCommanded"]), 14.7),
                airFuelRatioMeasured: toNumber(get(row, ["Air Fuel Ratio(Measured)(:1)", "airFuelRatioMeasured"]), 14.7),
                massAirFlowRate,
                fuelTrimLTFT_Bank1: toNumber(get(row, ["Fuel Trim Bank 1 Long Term(%)", "fuelTrimLTFT_Bank1"]), 0),
                fuelTrimSTFT_Bank1: toNumber(get(row, ["Fuel Trim Bank 1 Short Term(%)", "fuelTrimSTFT_Bank1"]), 0),
                fuelRemaining,
                o2SensorWideRangeCurrent: toNumber(get(row, ["O2 Sensor1 Wide Range Current(mA)", "o2SensorWideRangeCurrent"]), 1.2),
                o2EquivalenceRatio: toNumber(get(row, ["O2 Bank 1 Sensor 1 Wide Range Equivalence Ratio(λ)", "o2EquivalenceRatio"]), 1.0),
                o2SensorDownstreamVoltage: toNumber(get(row, ["O2 Bank 1 Sensor 2 Voltage(V)", "o2SensorDownstreamVoltage"]), 0.8),
                commandedEquivalenceRatio: toNumber(get(row, ["Commanded Equivalence Ratio(lambda)", "commandedEquivalenceRatio"]), 1.0),
                ecuVoltage: toNumber(get(row, ["Voltage (Control Module)(V)", "ecuVoltage"]), 13.8),
                obdVoltage: toNumber(get(row, ["Voltage (OBD Adapter)(V)", "obdVoltage", "Voltage (Control Module)(V)"]), 12.6),
                runTimeSinceEngineStart: toNumber(get(row, ["Run time since engine start(s)", "runTimeSinceEngineStart"]), idx),
                tripDistance,
                distanceSinceCodesCleared: tripDistance,
                distanceWithMILOn: 0,
                throttleAbsolute: Math.max(relThrottle, manifoldThrottle),
                throttleRelative: relThrottle,
                throttleManifold: manifoldThrottle,
                acceleratorPedalD: toNumber(get(row, ["Accelerator PedalPosition D(%)", "acceleratorPedalD"]), 20),
                acceleratorPedalE: toNumber(get(row, ["Accelerator PedalPosition E(%)", "acceleratorPedalE"]), 20),
                enginePowerKW: power,
                torqueNm,
                volumetricEfficiency: toNumber(get(row, ["Volumetric Efficiency (Calculated)(%)", "volumetricEfficiency"]), 75)
            };
        });

        const result = await this.createOBDRecordsBulk(userId, vehicleId, records);
        return {
            skipped: false,
            insertedCount: result.insertedCount,
            failedCount: result.failedCount,
            failures: result.failures
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
