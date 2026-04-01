import dotenv from "dotenv"
dotenv.config()

export const NODE_ENV = process.env.NODE_ENV
export const PORT = process.env.PORT
export const MONGO_URI = process.env.MONGO_URI
export const MONGODB_NAME = process.env.DB_NAME
export const JWT_SECRET = process.env.JWT_SECRET
export const GROQ_API_KEY = process.env.GROQ_API_KEY

// Feature constants
export const OBD_RECORD_THRESHOLD = process.env.OBD_RECORD_THRESHOLD || 100
export const BATCH_SIZE_FOR_DIAGNOSTICS = process.env.BATCH_SIZE_FOR_DIAGNOSTICS || 10
export const LLM_MAX_BATCHES = process.env.LLM_MAX_BATCHES || 12
export const LLM_MAX_RETRIES = process.env.LLM_MAX_RETRIES || 2
export const LLM_MODEL = process.env.LLM_MODEL || "groq/compound"
export const LLM_FALLBACK_MODELS = process.env.LLM_FALLBACK_MODELS || "llama-3.3-70b-versatile,llama-3.1-8b-instant"
export const REPORT_BATCH_WINDOW = process.env.REPORT_BATCH_WINDOW || 24
export const CONFIDENCE_LLM_WEIGHT = process.env.CONFIDENCE_LLM_WEIGHT || 0.7