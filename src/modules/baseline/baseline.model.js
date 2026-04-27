import mongoose from "mongoose";

const baselineModelSchema = new mongoose.Schema(
    {
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

        // Serialized ML model (trained on OBD data)
        modelData: {
            type: Buffer,
            required: true
        },

        // Model metadata
        modelFormat: {
            type: String,
            enum: ["json", "tflite", "onnx", "binary"],
            default: "json"
        },

        // Training info
        trainingRecordsCount: {
            type: Number,
            required: true
        },

        trainingBatchIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Batch"
            }
        ],

        // Performance metrics
        metrics: {
            precision: Number,
            recall: Number,
            f1Score: Number
        },

        // Version for tracking model evolution
        version: {
            type: Number,
            default: 1
        },

        // Status tracking
        status: {
            type: String,
            enum: ["training", "ready", "deployed", "archived"],
            default: "ready"
        },

        // When model was deployed to ESP
        deployedToESP: {
            type: Boolean,
            default: false
        },

        deployedAt: Date
    },
    { timestamps: true }
);

baselineModelSchema.index({ vehicle: 1, createdAt: -1 });
baselineModelSchema.index({ user: 1, version: -1 });

const BaselineModel =
    mongoose.models.Baseline ||
    mongoose.model("Baseline", baselineModelSchema);

export default BaselineModel;
