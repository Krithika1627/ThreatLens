import 'react-native-get-random-values';
import { v4 as uuidv4 } from "uuid";

import { getBackendBaseUrl } from "./secureKeyService";
import type { ScanResult } from "../types";

const DEBUG = false;

type BackendClassificationResponse = {
  classification?: "SAFE" | "SPAM" | "SCAM" | "PHISHING";
  confidence?: number;
  explanation?: string;
  red_flags?: string[];
  suggested_actions?: string[];
};

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Number(value.toFixed(2));
}

function normalizeClassification(
  value: unknown
): "SAFE" | "SPAM" | "SCAM" | "PHISHING" {
  if (value === "SAFE" || value === "SPAM" || value === "SCAM" || value === "PHISHING") {
    return value;
  }

  return "SAFE";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function fallbackScanResult(text: string, explanation: string): ScanResult {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    classification: "SAFE",
    confidence: 0,
    messagePreview: text.slice(0, 100),
    redFlags: [],
    suggestedActions: [],
    explanation,
  };
}

export async function classifyMessage(text: string): Promise<ScanResult> {
  try {
    const backendBaseUrl = await getBackendBaseUrl();
    if (!backendBaseUrl || backendBaseUrl.trim().length === 0) {
      return fallbackScanResult(text, "Configure Backend URL in Settings");
    }

    const response = await fetch(`${backendBaseUrl}/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) {
      return fallbackScanResult(text, "Unable to analyse message");
    }

    const parsed = (await response.json()) as BackendClassificationResponse;
    console.log("Calling backend...");
    return {
      id: uuidv4(),
      timestamp: Date.now(),
      classification: normalizeClassification(parsed.classification),
      confidence: normalizeConfidence(parsed.confidence),
      messagePreview: text.slice(0, 100),
      redFlags: normalizeStringArray(parsed.red_flags),
      suggestedActions: normalizeStringArray(parsed.suggested_actions),
      explanation:
        typeof parsed.explanation === "string" && parsed.explanation.trim().length > 0
          ? parsed.explanation.trim()
          : "Unable to analyse message",
    };
  } catch (error: unknown) {
    const typedError =
      error instanceof Error ? error : new Error("Unknown classifyMessage error");
    // if (DEBUG) console.error("classifyMessage failed", typedError);
    void typedError;
    return fallbackScanResult(text, "Configure Backend URL in Settings");
  }
}

export async function generateBreachGuidance(
  breachMetadata: object
): Promise<string> {
  try {
    if (!breachMetadata || Object.keys(breachMetadata).length === 0) {
      return "Unable to generate breach guidance";
    }

    const guidanceParts = [
      "Change passwords for affected accounts and enable 2FA.",
      "Watch for phishing attempts related to this breach.",
      "Review financial and account activity for unusual behavior.",
    ];

    return guidanceParts.join(" ");
  } catch (error: unknown) {
    const typedError =
      error instanceof Error
        ? error
        : new Error("Unknown generateBreachGuidance error");
    // if (DEBUG) console.error("generateBreachGuidance failed", typedError);
    void typedError;
    return "Unable to generate breach guidance";
  }
}

void DEBUG;