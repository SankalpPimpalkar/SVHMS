import Groq from "groq-sdk";
import { GROQ_API_KEY } from "../../configs/env.config.js";

const groq = new Groq({
    apiKey: GROQ_API_KEY
});

export async function explainOBDWithLLM(avgSignals) {
    const confidenceMap = {};
    for (let key in avgSignals) {
        confidenceMap[key] = Math.round(avgSignals[key] * 100);
    }

    const prompt = `
        You are an automotive diagnostic assistant. 
        Given the following OBD-II signal confidence percentages, generate a JSON object with the following structure:
        {
        "likely_issue": "brief description",
        "affected_parts": ["list of affected parts"],
        "confidence_percentage": number (0-100),
        "explanation": "short factual explanation based only on the signals, no hallucinations"
        }

        Signals:
        ${JSON.stringify(confidenceMap, null, 2)}

        Return strictly valid JSON only, do not add extra text.
    `;

    console.log("AI PROMPT", prompt)

    try {
        const completion = await groq.chat.completions.create({
            model: "groq/compound",
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        const rawContent = completion.choices[0]?.message?.content || "{}";
        let result = {};
        try {
            result = JSON.parse(rawContent);
        } catch (e) {
            console.error("Failed to parse LLM response as JSON:", rawContent);
            result = {
                likely_issue: "Unknown",
                affected_parts: [],
                confidence_percentage: 0,
                explanation: "Could not generate explanation."
            };
        }

        return result;
    } catch (err) {
        console.error("LLM error:", err);
        return {
            likely_issue: "Unknown",
            affected_parts: [],
            confidence_percentage: 0,
            explanation: "LLM request failed."
        };
    }
}