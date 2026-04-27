import Groq from "groq-sdk";
import {
    GROQ_API_KEY,
    LLM_MODEL,
    LLM_FALLBACK_MODELS,
    LLM_MAX_RETRIES
} from "../../configs/env.config.js";

const groq = new Groq({
    apiKey: GROQ_API_KEY
});

const MAX_RETRIES = Math.max(0, Number(LLM_MAX_RETRIES) || 2);
const MODELS = [
    String(LLM_MODEL || "").trim(),
    ...String(LLM_FALLBACK_MODELS || "")
        .split(",")
        .map(m => m.trim())
        .filter(Boolean)
].filter(Boolean);

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(error) {
    const status = Number(error?.status);
    if ([408, 409, 429, 500, 502, 503, 504].includes(status)) {
        return true;
    }

    const msg = String(error?.message || "").toLowerCase();
    return msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset");
}

function parseLlmJson(raw) {
    try {
        return JSON.parse(raw);
    } catch {
        // Attempt to extract JSON object from fenced/verbose model output.
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start >= 0 && end > start) {
            const sliced = raw.slice(start, end + 1);
            return JSON.parse(sliced);
        }
        throw new Error("Unable to parse JSON payload");
    }
}

export async function explainOBDWithLLM(batches, anomalyContext = null) {
    if (!Array.isArray(batches) || !batches.length) {
        throw new Error("No batch data provided to LLM");
    }

        const prompt = `
You are an automotive diagnostics analyst. Your output is consumed by a production system.

OBJECTIVE
Produce one consolidated diagnosis from OBD batch summaries and baseline anomaly context.

INPUTS
1) Batch summaries (most recent first): aggregated telemetry over short windows.
2) Baseline anomaly context: model-based anomaly score and triggered metrics.

BASELINE CONTEXT
${JSON.stringify(anomalyContext || { modelAvailable: false }, null, 2)}

BATCH DATA
${JSON.stringify(batches)}

ANALYSIS RULES
1) Use only supplied data. Do not invent DTC codes, parts, or root causes.
2) Prioritize repeated deviations across multiple batches over single spikes.
3) Correlate subsystems before concluding:
     - Engine: avgRPM, avgLoad, avgPowerKW
     - Airflow: avgMAP, avgMAF
     - Fuel: avgAFRMeasured, avgLTFT
     - Thermal: avgIntakeTemp, maxCatalystTemp
     - Electrical: minECUVoltage, minOBDVoltage
4) If baseline anomaly context has triggered metrics, treat them as high-priority evidence.
5) If evidence is weak or conflicting, say so and reduce confidence.

CONFIDENCE CALIBRATION
- 80-95: strong multi-signal, repeated, coherent evidence
- 60-79: moderate evidence, some corroboration
- 35-59: weak or partial evidence
- 10-34: mostly normal/insufficient evidence
Never return 0 unless input is invalid.

CONSUMER INTERPRETABLE EXPLANATION
- Write explanation in plain language for non-technical vehicle owners.
- Avoid dense jargon. If technical terms are needed, explain them briefly.
- Keep it practical and actionable.
- Structure explanation in this order:
    1) What we observed
    2) What it means for the driver
    3) What to do next (short recommendation)

AFFECTED_PARTS CONSTRAINTS
- Return 0-4 items maximum.
- Use component-level terms only, for example:
    ["air intake", "fuel injectors", "catalytic converter", "battery/charging", "ignition system", "vacuum lines", "oxygen sensor"]
- If uncertain, return an empty array.

OUTPUT FORMAT
Return STRICTLY valid JSON only. No markdown, no code fences, no extra text.
{
    "likely_issue": "short diagnosis",
    "affected_parts": ["component", "component"],
    "confidence_percentage": 0,
    "severity_band": "low|medium|high|critical",
    "health_adjustment": 0,
    "explanation": "3-5 plain-language sentences with clear recommendation"
}

HEALTH ADJUSTMENT RULES
- health_adjustment must be an integer between -10 and 0.
- low => around 0, medium => around -3, high => around -6, critical => around -10.
- Use stronger penalties only when evidence is strong and consistent across batches.
`;

    try {
        let completion = null;
        let lastError = null;

        const modelsToTry = MODELS.length ? MODELS : ["groq/compound"];

        for (const model of modelsToTry) {
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    completion = await groq.chat.completions.create({
                        model,
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.15
                    });
                    break;
                } catch (error) {
                    lastError = error;
                    const willRetry = attempt < MAX_RETRIES && shouldRetry(error);
                    if (!willRetry) {
                        console.warn(`[LLM] model ${model} failed without retry: ${error?.message || "unknown error"}`);
                        break;
                    }
                    const backoff = 500 * Math.pow(2, attempt);
                    console.warn(`[LLM] model ${model} transient failure, retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
                    await delay(backoff);
                }
            }

            if (completion) {
                break;
            }
        }

        if (!completion && lastError) {
            throw lastError;
        }

        const rawContent = completion.choices[0]?.message?.content || "{}";

        try {
            return parseLlmJson(rawContent);
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
