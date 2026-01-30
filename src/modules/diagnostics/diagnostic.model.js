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
        confidenceScore: {
            type: Number,
            min: 0,
            max: 100
        },
        summary: { type: String }
    }

}, { timestamps: true });

diagnosticsSchema.index({ vehicle: 1, "timeWindow.end": -1 });
diagnosticsSchema.index({ createdAt: -1 });

const DiagnosticsModel =
    mongoose.model("Diagnostic", diagnosticsSchema);

export default DiagnosticsModel;
