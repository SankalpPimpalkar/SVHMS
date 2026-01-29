import mongoose from "mongoose";

const obdSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true,
        index: true
    },
    deviceId: {
        type: String,
        required: true,
        index: true
    },

    // Timestamps
    gpsTime: Date,
    deviceTime: Date,
    receivedAt: { type: Date, default: Date.now, index: true },

    // Engine Performance
    engineRPM: Number,
    ecuEngineRPM: Number,
    engineLoad: Number,
    engineLoadAbsolute: Number,
    timingAdvance: Number,

    // Temperature (°C)
    ambientAirTemp: Number,
    intakeAirTemperature: Number,
    catalystTempBank1Sensor1: Number,

    // Pressure (kPa)
    barometricPressure: Number,
    intakeManifoldPressure: Number,
    turboBoostPressure: Number,

    // Fuel & Air
    airFuelRatioCommanded: Number,
    airFuelRatioMeasured: Number,
    massAirFlowRate: Number,
    fuelTrimLTFT_Bank1: Number,
    fuelTrimSTFT_Bank1: Number,
    fuelRemaining: Number,

    // Exhaust / Emissions
    o2SensorWideRangeCurrent: Number,
    o2EquivalenceRatio: Number,
    o2SensorDownstreamVoltage: Number,
    commandedEquivalenceRatio: Number,

    // Electrical
    ecuVoltage: Number,
    obdVoltage: Number,

    // Usage & Distance
    runTimeSinceEngineStart: Number,
    tripDistance: Number,
    distanceSinceCodesCleared: Number,
    distanceWithMILOn: Number,

    // Throttle & Pedal
    throttleAbsolute: Number,
    throttleRelative: Number,
    throttleManifold: Number,
    acceleratorPedalD: Number,
    acceleratorPedalE: Number,

    // Power & Torque
    enginePowerKW: Number,
    torqueNm: Number,
    volumetricEfficiency: Number

}, { timestamps: true });

obdSchema.index({ vehicleId: 1, receivedAt: -1 });

const OBDModel = mongoose.models.OBD || mongoose.model('OBD', obdSchema);
export default OBDModel;
