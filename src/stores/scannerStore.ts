import { create } from "zustand";

import { classifyMessage } from "../services/geminiService";
import { getScanHistory, insertScanResult } from "../services/storageService";
import type { ScanResult } from "../types";

const DEBUG = false;

type ScannerActions = {
  setInputText: (text: string) => void;
  startScan: () => Promise<void>;
  loadHistory: () => Promise<void>;
};

type ScannerStoreState = {
  inputText: string;
  isScanning: boolean;
  currentResult: ScanResult | null;
  scanHistory: ScanResult[];
  actions: ScannerActions;
};

function toPersistableResult(
  result: ScanResult
): Omit<ScanResult, "id" | "timestamp"> {
  return {
    classification: result.classification,
    confidence: result.confidence,
    messagePreview: result.messagePreview,
    redFlags: result.redFlags,
    suggestedActions: result.suggestedActions,
    explanation: result.explanation,
  };
}

export const useScannerStore = create<ScannerStoreState>()((set, get) => ({
  inputText: "",
  isScanning: false,
  currentResult: null,
  scanHistory: [],
  actions: {
    setInputText: (text: string): void => {
      set({ inputText: text });
    },

    startScan: async (): Promise<void> => {
  const { inputText, isScanning } = get();
  const trimmedMessage = inputText.trim();

  console.log("🔥 startScan triggered");
  console.log("Input:", trimmedMessage);

  if (isScanning) {
    console.log("❌ Already scanning");
    return;
  }

  if (trimmedMessage.length < 10) {
    console.log("❌ Input too short");
    return;
  }

  set({ isScanning: true });

  try {
    console.log("🚀 Calling classifyMessage...");

    const result = await classifyMessage(trimmedMessage);

    console.log("✅ Got result:", result);

    const saved = await insertScanResult(toPersistableResult(result));
    const finalResult = saved ?? result;

    set((state) => ({
      currentResult: finalResult,
      scanHistory: [
        finalResult,
        ...state.scanHistory.filter((item) => item.id !== finalResult.id),
      ],
    }));
  } catch (error) {
    console.log("❌ Scan failed:", error);
  } finally {
    set({ isScanning: false });
  }
},

    loadHistory: async (): Promise<void> => {
      try {
        const history = await getScanHistory();
        set({ scanHistory: history });
      } catch (error: unknown) {
        const typedError =
          error instanceof Error ? error : new Error("Unknown loadHistory error");
        // if (DEBUG) console.error("loadHistory failed", typedError);
        void typedError;
        set({ scanHistory: [] });
      }
    },
  },
}));

void DEBUG;