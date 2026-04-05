const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

const SYSTEM_INSTRUCTION =
  "You are a cybersecurity expert specialising in consumer fraud detection. Focus on the Indian context (UPI scams, OTP fraud, KYC phishing).";

const CLASSIFY_PROMPT_TEMPLATE =
  "Classify this message. Respond ONLY with valid JSON. Schema: { classification: 'SAFE'|'SPAM'|'SCAM'|'PHISHING', confidence: number (0-100) Normalize confidence to 0-100 scale , explanation: string (max 3 sentences), red_flags: string[], suggested_actions: string[] }. Message: {{MESSAGE}}";

app.use(cors());
app.use(express.json());

function stripMarkdownFences(value) {
  return String(value)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }

  if (numeric < 0) {
    return 0;
  }

  if (numeric > 100) {
    return 100;
  }

  return Number(numeric.toFixed(2));
}

function normalizeClassification(value) {
  if (value === "SAFE" || value === "SPAM" || value === "SCAM" || value === "PHISHING") {
    return value;
  }

  return "SAFE";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string");
}

function mapXposedResponse(data) {
  const possibleList =
    (Array.isArray(data?.breaches) && data.breaches) ||
    (Array.isArray(data?.exposedBreaches) && data.exposedBreaches) ||
    (Array.isArray(data?.data?.breaches) && data.data.breaches) ||
    [];

  return possibleList.map((item, index) => ({
    id: String(item?.id ?? index),
    breachName: item?.breach || item?.name || item?.breach_name || "Unknown",
    date: item?.date || item?.breach_date || item?.breached_date || "",
    dataTypes: normalizeStringArray(item?.exposedData || item?.xposed_data),
    severity: "medium",
    source: "xposedornot",
  }));
}

function mapBreachDirectoryResponse(data) {
  const possibleList =
    (Array.isArray(data) && data) ||
    (Array.isArray(data?.result) && data.result) ||
    (Array.isArray(data?.results) && data.results) ||
    [];

  return possibleList.map((item, index) => ({
    id: String(item?.id ?? index),
    breachName: item?.name || item?.title || item?.breach || "Unknown",
    date: item?.date || item?.breach_date || "",
    dataTypes: normalizeStringArray(item?.fields || item?.data || item?.exposedData),
    severity: "medium",
    source: "breachdirectory",
  }));
}
function stripMarkdownFences(text) {
  if (!text) return "";

  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

app.post("/classify", async (req, res) => {
  try {
    console.log("📩 Incoming message:", req.body);

    const message =
      typeof req.body?.message === "string"
        ? req.body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({ error: "Invalid message" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing API key" });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
    You are a cybersecurity expert specialising in consumer fraud detection in India.

    Classify the message strictly in JSON format:

    {
    "classification": "SAFE|SPAM|SCAM|PHISHING",
    "confidence": number (0-100),
    "explanation": "string",
    "red_flags": ["string"],
    "suggested_actions": ["string"]
    }

    Message: ${message}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    console.log("🤖 Gemini response received");

    const rawText = response.text;

    const cleanedText = stripMarkdownFences(rawText);

    console.log("🧹 Cleaned text:", cleanedText);

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      console.log("❌ JSON parse failed:", cleanedText);
      return res.status(500).json({ error: "Parse error" });
    }

    return res.json(parsed);

  } catch (error) {
    console.log("❌ Backend error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/breach/email/:email", async (req, res) => {
  try {
    const email = typeof req.params?.email === "string" ? req.params.email.trim() : "";
    if (!email) {
      return res.status(400).json({ error: "Something went wrong" });
    }

    try {
      const response = await axios.get(
        `https://xposedornot.com/api/v1/check-email/${encodeURIComponent(email)}`,
        {
          timeout: 10000,
        }
      );

      return res.json(mapXposedResponse(response.data));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return res.json([]);
      }

      throw error;
    }
  } catch (_error) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/breach/username", async (req, res) => {
  try {
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";

    if (!username || !process.env.RAPIDAPI_KEY) {
      return res.status(400).json({ error: "Something went wrong" });
    }

    const response = await axios.get("https://breachdirectory.p.rapidapi.com/", {
      params: {
        func: "auto",
        term: username,
      },
      headers: {
        "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        "x-rapidapi-host": "breachdirectory.p.rapidapi.com",
      },
      timeout: 10000,
    });

    return res.json(mapBreachDirectoryResponse(response.data));
  } catch (_error) {
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(port, () => {
  process.stdout.write(`ThreatLens backend listening on port ${port}\n`);
});