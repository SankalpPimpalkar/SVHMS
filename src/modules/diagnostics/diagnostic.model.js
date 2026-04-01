import mongoose from "mongoose";

const diagnosticsSchema = new mongoose.Schema({
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle",
        required: true,
        index: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    timeWindow: {
        start: { type: Date, required: true },
        end: { type: Date, required: true }
    },

    batchIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Batch",
            required: true
        }
    ],

    aiSnapshot: {
        likely_issue: { type: String },
        affected_parts: [String],
        baseHealthScore: {
            type: Number,
            min: 0,
            max: 100
        },
        llmHealthAdjustment: {
            type: Number,
            min: -10,
            max: 0
        },
        healthScoreReasoning: { type: String },
        healthScore: {
            type: Number,
            min: 0,
            max: 100
        },
        confidenceScore: {
            type: Number,
            min: 0,
            max: 100
        },
        confidenceReasoning: { type: String },
        summary: { type: String }
    },

    // ESP32 anomaly detection
    espAnomalyFlag: {
        type: Boolean,
        default: false
    },
    espAnomalyDetails: String,

    // Baseline model reference for edge ML
    baselineModelId: mongoose.Schema.Types.ObjectId,

    // Track if this was manually triggered vs auto-generated
    isManuallyTriggered: {
        type: Boolean,
        default: false
    },

    // Track data collection progress
    recordsUsed: {
        type: Number,
        default: 0
    }

}, { timestamps: true });

diagnosticsSchema.index({ vehicle: 1, "timeWindow.end": -1 });
diagnosticsSchema.index({ createdAt: -1 });

const DiagnosticsModel =
    mongoose.model("Diagnostic", diagnosticsSchema);

export default DiagnosticsModel;
