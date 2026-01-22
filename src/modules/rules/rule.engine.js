import DiagnosticsModel from "../diagnostics/diagnostic.model.js";

function expectedMAF({ engineRPM, engineLoad }) {
    if (!engineRPM || !engineLoad) return 0;
    return (engineRPM * engineLoad) / 1200;
}

export default async function runOBDRulesAndCreateReport(obdReadings, vehicleId, userId) {
    if (!obdReadings || obdReadings.length === 0) throw new Error("No OBD readings provided");

    let sumSignals = {
        overheating: 0,
        fuelSystem: 0,
        airIntake: 0,
        electrical: 0,
        emissions: 0
    };

    let metrics = {
        engineRPM: [],
        engineLoad: [],
        timingAdvance: [],
        intakeTemp: [],
        catalystTemp: [],
        AFRCommanded: [],
        AFRMeasured: [],
        massAirFlow: [],
        powerKW: [],
        torqueNm: [],
        ecuVoltage: [],
        obdVoltage: []
    };

    obdReadings.forEach(r => {
        if (r.catalystTempBank1Sensor1 > 900 || r.engineLoad > 95) sumSignals.overheating += 0.4;
        if ((r.fuelTrimLTFT_Bank1 > 10) || (r.fuelTrimSTFT_Bank1 > 10)) sumSignals.fuelSystem += 0.3;

        // Calculate expected MAF safely
        const expected = expectedMAF({ engineRPM: r.engineRPM, engineLoad: r.engineLoad });
        if (r.massAirFlowRate < expected) sumSignals.airIntake += 0.2;

        if (r.ecuVoltage < 12 || r.obdVoltage < 11) sumSignals.electrical += 0.2;
        if (r.o2EquivalenceRatio < 0.8 || r.o2EquivalenceRatio > 1.2) sumSignals.emissions += 0.3;

        // Ensure we push valid numbers (handle undefined/null)
        metrics.engineRPM.push(r.engineRPM || 0);
        metrics.engineLoad.push(r.engineLoad || 0);
        metrics.timingAdvance.push(r.timingAdvance || 0);
        metrics.intakeTemp.push(r.intakeAirTemperature || 0);
        metrics.catalystTemp.push(r.catalystTempBank1Sensor1 || 0);
        metrics.AFRCommanded.push(r.airFuelRatioCommanded || 0);
        metrics.AFRMeasured.push(r.airFuelRatioMeasured || 0);
        metrics.massAirFlow.push(r.massAirFlowRate || 0);
        metrics.powerKW.push(r.enginePowerKW || 0);
        metrics.torqueNm.push(r.torqueNm || 0);
        metrics.ecuVoltage.push(r.ecuVoltage || 0);
        metrics.obdVoltage.push(r.obdVoltage || 0);
    });

    const count = obdReadings.length;

    const avgSignals = {
        overheating: 0,
        fuelSystem: 0,
        airIntake: 0,
        electrical: 0,
        emissions: 0
    };

    // Calculate average signals safely
    for (let key in sumSignals) {
        avgSignals[key] = count > 0 ? parseFloat((sumSignals[key] / count).toFixed(3)) : 0;
    }

    // Calculate confidence score safely
    const avgSignalsArray = Object.values(avgSignals);
    const totalAvg = avgSignalsArray.reduce((a, b) => a + b, 0);
    const confidenceScore = avgSignalsArray.length > 0 && totalAvg > 0
        ? Math.round((totalAvg / avgSignalsArray.length) * 100)
        : 0;

    // Generate a summary based on the data
    let summary = "";
    if (count > 0) {
        const avgRPM = parseFloat((metrics.engineRPM.reduce((a, b) => a + b, 0) / count).toFixed(1));
        const avgLoad = parseFloat((metrics.engineLoad.reduce((a, b) => a + b, 0) / count).toFixed(1));
        summary = `Analysis of ${count} OBD readings shows average RPM: ${avgRPM}, load: ${avgLoad}%. `;

        if (avgSignals.overheating > 0.2) summary += "Potential overheating detected. ";
        if (avgSignals.fuelSystem > 0.2) summary += "Fuel system anomalies observed. ";
        if (avgSignals.electrical > 0.2) summary += "Electrical system issues noted. ";

        if (summary === `Analysis of ${count} OBD readings shows average RPM: ${avgRPM}, load: ${avgLoad}%. `) {
            summary += "Vehicle systems operating within normal parameters.";
        }
    } else {
        summary = "No valid OBD readings to analyze.";
    }

    const diagnosticsData = {
        vehicle: vehicleId,
        user: userId,
        timeWindow: {
            start: obdReadings[0].receivedAt,
            end: obdReadings[obdReadings.length - 1].receivedAt
        },
        engine: {
            avgRPM: parseFloat((metrics.engineRPM.reduce((a, b) => a + b, 0) / count).toFixed(1)),
            maxRPM: Math.max(...metrics.engineRPM),
            minRPM: Math.min(...metrics.engineRPM),
            avgLoad: parseFloat((metrics.engineLoad.reduce((a, b) => a + b, 0) / count).toFixed(1)),
            maxTimingAdvance: Math.max(...metrics.timingAdvance)
        },
        temperature: {
            avgIntakeTemp: parseFloat((metrics.intakeTemp.reduce((a, b) => a + b, 0) / count).toFixed(1)),
            maxCatalystTemp: Math.max(...metrics.catalystTemp)
        },
        fuelAir: {
            avgAFRCommanded: parseFloat((metrics.AFRCommanded.reduce((a, b) => a + b, 0) / count).toFixed(2)),
            avgAFRMeasured: parseFloat((metrics.AFRMeasured.reduce((a, b) => a + b, 0) / count).toFixed(2)),
            afrDeviation: parseFloat((metrics.AFRCommanded.reduce((sum, i, idx) => sum + Math.abs(i - metrics.AFRMeasured[idx]), 0) / count).toFixed(2)),
            leanMixtureEvents: obdReadings.filter(r => r.airFuelRatioMeasured && r.airFuelRatioMeasured < 14.7).length
        },
        power: {
            avgPowerKW: parseFloat((metrics.powerKW.reduce((a, b) => a + b, 0) / count).toFixed(1)),
            maxPowerKW: Math.max(...metrics.powerKW),
            torqueNm: parseFloat((metrics.torqueNm.reduce((a, b) => a + b, 0) / count).toFixed(1))
        },
        electrical: {
            minECUVoltage: Math.min(...metrics.ecuVoltage),
            minOBDVoltage: Math.min(...metrics.obdVoltage),
            voltageFluctuationCount: obdReadings.filter(r => r.ecuVoltage && r.ecuVoltage < 12 || r.obdVoltage && r.obdVoltage < 11).length
        },
        risks: {
            misfire: false,
            overheat: avgSignals.overheating > 0.2,
            leanMixture: avgSignals.fuelSystem > 0.2,
            powerLoss: avgSignals.airIntake > 0.2,
            electrical: avgSignals.electrical > 0.2
        },
        healthScores: {
            engine: avgSignals.overheating > 0.3 ? "Poor" : "Good",
            fuelSystem: avgSignals.fuelSystem > 0.2 ? "Moderate" : "Good",
            emissions: avgSignals.emissions > 0.2 ? "Moderate" : "Good",
            electrical: avgSignals.electrical > 0.2 ? "Moderate" : "Good"
        },
        aiSnapshot: {
            summary,
            confidenceScore // Now this will never be NaN
        },
        rawOBDIds: obdReadings.map(r => r._id)
    };

    const diagnosticReport = await DiagnosticsModel.create(diagnosticsData);

    return {
        confidenceScore,
        diagnosticId: diagnosticReport._id,
        avgSignals,
    };
}