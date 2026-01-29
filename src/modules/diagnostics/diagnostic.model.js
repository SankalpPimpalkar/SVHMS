import mongoose from "mongoose";

const diagnosticsSchema = new mongoose.Schema({
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    timeWindow: {
        start: { type: Date, required: true },
        end: { type: Date, required: true }
    },

    // Aggregated Metrics
    engine: {
        avgRPM: Number,
        maxRPM: Number,
        minRPM: Number,
        avgLoad: Number,
        maxTimingAdvance: Number
    },
    temperature: {
        avgIntakeTemp: Number,
        maxCatalystTemp: Number
    },
    fuelAir: {
        avgAFRCommanded: Number,
        avgAFRMeasured: Number,
        afrDeviation: Number,
        leanMixtureEvents: Number
    },
    power: {
        avgPowerKW: Number,
        maxPowerKW: Number,
        torqueNm: Number
    },
    electrical: {
        minECUVoltage: Number,
        minOBDVoltage: Number,
        voltageFluctuationCount: Number
    },

    // Risk Flags (derived)
    risks: {
        misfire: Boolean,
        overheat: Boolean,
        leanMixture: Boolean,
        powerLoss: Boolean,
        electrical: Boolean
    },

    // Overall Health Scores
    healthScores: {
        engine: String,
        fuelSystem: String,
        emissions: String,
        electrical: String
    },

    // AI Analysis / Summary
    aiSnapshot: {
        summary: String,
        likely_issue: String,
        affected_parts: [String],
        confidenceScore: Number
    },

    rawOBDIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OBD'
        }
    ]
}, { timestamps: true });

diagnosticsSchema.index({ vehicleId: 1, "timeWindow.end": -1 });

const DiagnosticsModel = mongoose.model.Diagnostics || mongoose.model('Diagnostic', diagnosticsSchema);
export default DiagnosticsModel;