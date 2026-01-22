import mongoose from "mongoose";
import { MONGO_URI, MONGODB_NAME } from "./env.config.js";

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

export async function dbconnect() {
    try {
        if (cached.conn) {
            return cached.conn;
        }

        if (!cached.promise) {
            cached.promise = await mongoose.connect(MONGO_URI, { dbName: MONGODB_NAME, bufferCommands: false })
            console.log("☘️ Mongodb connected", cached.promise.connection.host)
        }

        cached.conn = await cached.promise;
        return cached.conn;

    } catch (error) {
        console.log("❌ Mongodb failed to connect: ", error)
        process.exit(1)
    }
}