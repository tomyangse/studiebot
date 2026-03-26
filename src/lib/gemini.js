import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export function getGeminiModel(modelName = "gemini-2.5-flash") {
  if (!genAI) {
    throw new Error("Gemini API key is not configured");
  }
  return genAI.getGenerativeModel({ model: modelName });
}

export { genAI };
