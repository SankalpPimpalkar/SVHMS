import Groq from "groq-sdk";
import { GROQ_API_KEY } from "../../configs/env.config.js";

const groq = new Groq({
    apiKey: GROQ_API_KEY
});

export async function explainOBDWithLLM(batches) {
    if (!Array.isArray(batches) || !batches.length) {
        throw new Error("No batch data provided to LLM");
    }

    const prompt = `
        You are an automotive diagnostic expert AI.

        You are given multiple OBD-II DATA BATCHES collected within a one-hour window.
        Each batch represents averaged and peak sensor behavior for a short driving period.

        Your task:
        - Analyze patterns, trends, and repeated abnormalities ACROSS ALL batches
        - Correlate symptoms across engine, airflow, fuel, thermal, electrical, and power output
        - Generate ONE consolidated diagnostic result
        - Base conclusions STRICTLY on provided data
        - Do NOT hallucinate vehicle-specific parts or causes

        Sensor interpretation rules:

        1) Engine operation (mechanical health)
        - avgRPM + avgLoad → stalls, misfires, resistance, power loss
        - avgPowerKW → confirms real output degradation

        2) Airflow / breathing
        - avgMAP → vacuum leaks, intake restriction, boost issues
        - avgMAF → confirms actual air entering engine

        3) Fuel & combustion quality
        - avgAFRMeasured → lean / rich combustion
        - avgLTFT → long-term fueling compensation (injectors, leaks, wear)

        4) Thermal stress
        - avgIntakeTemp → heat stress, knock risk
        - maxCatalystTemp → misfire, rich burn, exhaust overheating

        5) Electrical stability
        - minECUVoltage → electrical instability, sensor corruption, ECU stress

        Return STRICTLY valid JSON in the following format ONLY:

        {
            "likely_issue": "brief description",
            "affected_parts": ["list of affected parts"],
            "confidence_percentage": number (0-100),
            "explanation": "short factual explanation based only on observed batch trends"
        }

        Hourly Batches:
        ${JSON.stringify(batches, null, 2)}
    `;

    console.log("AI PROMPT:", prompt);

    try {
        const completion = await groq.chat.completions.create({
            model: "groq/compound",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.15
        });

        const rawContent = completion.choices[0]?.message?.content || "{}";

        try {
            return JSON.parse(rawContent);
        } catch (err) {
            console.error("Failed to parse LLM JSON:", rawContent);
            return {
                likely_issue: "Unknown",
                affected_parts: [],
                confidence_percentage: 0,
                explanation: "AI response could not be parsed"
            };
        }

    } catch (err) {
        console.error("LLM error:", err);
        return {
            likely_issue: "Unknown",
            affected_parts: [],
            confidence_percentage: 0,
            explanation: "LLM request failed"
        };
    }
}
