import mongoose from "mongoose";

const batchSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
            index: true
        },

        /* Time window this batch represents */
        timeWindow: {
            start: { type: Date, required: true },
            end: { type: Date, required: true }
        },

        /* ==============================
            Engine / Mechanical Health
           ============================== */
        engine: {
            avgRPM: Number,
            maxRPM: Number,
            minRPM: Number,
            avgLoad: Number,
            avgPowerKW: Number
        },

        /* ==============================
            Airflow / Breathing
           ============================== */
        airflow: {
            avgMAP: Number,      
            avgMAF: Number         
        },

        /* ==============================
            Fuel & Combustion Quality
           ============================== */
        fuel: {
            avgAFRMeasured: Number,
            afrDeviation: Number,
            avgLTFT: Number
        },

        /* ==============================
            Thermal Stress
           ============================== */
        thermal: {
            avgIntakeTemp: Number,
            maxCatalystTemp: Number
        },

        /* ==============================
            Electrical Stability
           ============================== */
        electrical: {
            minECUVoltage: Number,
            minOBDVoltage: Number
        },

        rawOBDIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "OBD",
                required: true
            }
        ]
    },
    { timestamps: true }
);

batchSchema.index({ vehicle: 1, "timeWindow.end": -1 });
batchSchema.index({ vehicle: 1, createdAt: -1 });

const Batch =
    mongoose.models.Batch ||
    mongoose.model("Batch", batchSchema);

export default Batch;
