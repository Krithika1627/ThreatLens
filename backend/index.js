const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

const SYSTEM_INSTRUCTION =
  "You are a cybersecurity expert specialising in consumer fraud detection. Focus on the Indian context (UPI scams, OTP fraud, KYC phishing).";

const CLASSIFY_PROMPT_TEMPLATE =
  "Classify this message. Respond ONLY with valid JSON. Schema: { classification: 'SAFE'|'SPAM'|'SCAM'|'PHISHING', confidence: number (0-100) Normalize confidence to 0-100 scale , explanation: string (max 3 sentences), red_flags: string[], suggested_actions: string[] }. Message: {{MESSAGE}}";

app.use(cors());
app.use(express.json());

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  },
});

// Ensure output directory exists
const outputDir = path.join(__dirname, "protected");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

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

function mapLeakCheckResponse(data) {
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const fields = normalizeStringArray(data?.fields);

  return sources.map((item, index) => ({
    id: String(item?.name || index),
    breachName: item?.name || "Unknown",
    date: item?.date || "",
    dataTypes: fields,
    severity: "medium",
    source: "leakcheck",
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
        `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`,
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

    if (!username) {
      return res.status(400).json({ error: "Something went wrong" });
    }

    const response = await axios.get("https://leakcheck.io/api/public", {
      params: {
        check: username,
      },
      timeout: 10000,
    });

    if (response.status !== 200 || response.data?.success !== true) {
      return res.json([]);
    }

    return res.json(mapLeakCheckResponse(response.data));
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 429)) {
      return res.json([]);
    }
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(port, () => {
  process.stdout.write(`ThreatLens backend listening on port ${port}\n`);
});

// Image protection endpoint
app.post("/protect-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const inputPath = req.file.path;
    const protectionUuid = req.body?.uuid || uuidv4();
    const strength = parseFloat(req.body?.strength) || 0.03;

    // Output path for protected image
    const outputFilename = `protected_${Date.now()}${path.extname(req.file.originalname)}`;
    const outputPath = path.join(__dirname, "protected", outputFilename);

    // Run Python protection script
    const pythonProcess = spawn("python3", [
      path.join(__dirname, "image_protect.py"),
      inputPath,
      outputPath,
      "--uuid", protectionUuid,
      "--strength", strength.toString(),
    ]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      // Clean up input file
      try {
        fs.unlinkSync(inputPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      if (code !== 0) {
        console.error("Python script error:", stderr);
        return res.status(500).json({
          error: "Image protection failed",
          details: stderr || "Unknown error"
        });
      }

      try {
        const result = JSON.parse(stdout);

        if (!result.success) {
          return res.status(500).json({
            error: result.error || "Protection failed"
          });
        }

        // Read the protected image and send as base64
        const imageBuffer = fs.readFileSync(outputPath);
        const base64Image = imageBuffer.toString("base64");
        const mimeType = req.file.mimetype;

        // Clean up output file after reading
        try {
          fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        return res.json({
          success: true,
          image: `data:${mimeType};base64,${base64Image}`,
          protectionId: result.protection_id,
          protectionsApplied: result.protections_applied,
          message: result.message
        });

      } catch (parseError) {
        console.error("Failed to parse Python output:", stdout, stderr);
        return res.status(500).json({
          error: "Failed to process protection result"
        });
      }
    });

  } catch (error) {
    console.error("Image protection error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// Serve protected images temporarily
app.use("/protected", express.static(path.join(__dirname, "protected")));