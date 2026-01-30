import Batch from "./batch.model.js";

export class BatchService {

    /* -------- Utils -------- */

    static #chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static #avg(arr) {
        const valid = arr.filter(v => typeof v === "number" && !isNaN(v));
        if (!valid.length) return 0;
        return valid.reduce((a, b) => a + b, 0) / valid.length;
    }

    static #min(arr, fallback = 0) {
        const valid = arr.filter(v => typeof v === "number" && !isNaN(v));
        return valid.length ? Math.min(...valid) : fallback;
    }

    static #max(arr, fallback = 0) {
        const valid = arr.filter(v => typeof v === "number" && !isNaN(v));
        return valid.length ? Math.max(...valid) : fallback;
    }

    /* -------- Core batch calculation -------- */

    static #calculateBatchMetrics(batch) {
        console.log("BATCH", batch)

        const rpm = batch.map(r => r.engineRPM);
        const load = batch.map(r => r.engineLoadAbsolute);
        const power = batch.map(r => r.enginePowerKW);

        const map = batch.map(r => r.intakeManifoldPressure);
        const maf = batch.map(r => r.massAirFlowRate);

        const afr = batch.map(r => r.airFuelRatioMeasured);
        const ltft = batch.map(r => r.fuelTrimLTFT_Bank1);

        const intakeTemp = batch.map(r => r.intakeAirTemperature);
        const catalystTemp = batch.map(r => r.catalystTempBank1Sensor1);

        const ecuVoltage = batch.map(r => r.ecuVoltage);
        const obdVoltage = batch.map(r => r.obdVoltage);

        return {
            timeWindow: {
                start: batch[0].receivedAt,
                end: batch[batch.length - 1].receivedAt
            },

            engine: {
                avgRPM: Number(this.#avg(rpm).toFixed(1)),
                maxRPM: this.#max(rpm),
                minRPM: this.#min(rpm),
                avgLoad: Number(this.#avg(load).toFixed(1)),
                avgPowerKW: Number(this.#avg(power).toFixed(1))
            },

            airflow: {
                avgMAP: Number(this.#avg(map).toFixed(1)),
                avgMAF: Number(this.#avg(maf).toFixed(2))
            },

            fuel: {
                avgAFRMeasured: Number(this.#avg(afr).toFixed(2)),
                afrDeviation: Number(
                    this.#avg(afr.map(v => Math.abs((v ?? 14.7) - 14.7))).toFixed(2)
                ),
                avgLTFT: Number(this.#avg(ltft).toFixed(2))
            },

            thermal: {
                avgIntakeTemp: Number(this.#avg(intakeTemp).toFixed(1)),
                maxCatalystTemp: this.#max(catalystTemp)
            },

            electrical: {
                minECUVoltage: this.#min(ecuVoltage, 12),
                minOBDVoltage: this.#min(obdVoltage, 12)
            },

            rawOBDIds: batch.map(r => r._id)
        };
    }

    /* -------- Batch generation -------- */

    static #generateBatches(obdReadings, batchSize) {
        if (!Array.isArray(obdReadings) || obdReadings.length < batchSize) {
            return [];
        }

        return this.#chunkArray(obdReadings, batchSize)
            .filter(batch => batch.length === batchSize)
            .map(batch => this.#calculateBatchMetrics(batch));
    }

    /* -------- Persist -------- */

    static async saveBatches({
        obdReadings,
        userId,
        vehicleId,
        batchSize = 10
    }) {
        const batches = this.#generateBatches(obdReadings, batchSize);
        if (!batches.length) return [];

        const docs = batches.map(b => ({
            user: userId,
            vehicle: vehicleId,
            ...b
        }));

        return await Batch.insertMany(docs);
    }
}
