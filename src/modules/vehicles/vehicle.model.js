import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    manufacturer: {
        type: String,
        required: true,
    },
    model: {
        type: String,
        required: true,
    },
    year: {
        type: Number,
        required: true,
        min: 1900,
        max: 3000
    },
    engineType: {
        type: String,
        enum: ["PETROL", "DIESEL", "EV", "HYBRID", "CNG", "LPG"],
        required: true
    }
}, { timestamps: true })

const VehicleModel = mongoose.model('Vehicle', vehicleSchema)
export default VehicleModel