// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Helper prompt for consistent JSON output
function buildPrompt(seed, count = 5) {
  return `
You are a color palette generator.

Input mood: "${seed}"

Output format (STRICT JSON only, nothing else):
{
  "palette": [
    {"hex":"#RRGGBB","name":"short name"},
    ...
  ],
  "description":"1-2 sentence description"
}

Return exactly ${count} colors in the "palette" array.
All hex codes must be valid 6-digit hex (uppercase).
`;
}

// Extract JSON from Gemini response
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// API endpoint
app.post("/api/generate-palette", async (req, res) => {
  try {
    const { seed, count } = req.body;
    if (!seed || typeof seed !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'seed'." });
    }
    const num = Number.isInteger(count) && count > 0 && count <= 10 ? count : 5;

    const prompt = buildPrompt(seed, num);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.palette)) {
      return res.status(502).json({ error: "Invalid AI response", raw: text });
    }

    const palette = parsed.palette.slice(0, num).map((c, i) => {
      const hex = (c.hex || "").toUpperCase();
      const name = c.name || `Color ${i + 1}`;
      return { hex, name };
    });

    res.json({ palette, description: parsed.description || "" });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Server error generating palette" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Gemini server running on http://localhost:${PORT}`);
});
