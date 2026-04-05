import { getBackendBaseUrl } from "./secureKeyService";

const DEBUG = false;

export type BreachApiItem = {
  id: string;
  breachName: string;
  date: string;
  dataTypes: string[];
  severity: string;
  source: string;
};

function isBreachItem(value: unknown): value is BreachApiItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BreachApiItem>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.breachName === "string" &&
    typeof candidate.date === "string" &&
    Array.isArray(candidate.dataTypes) &&
    typeof candidate.severity === "string" &&
    typeof candidate.source === "string"
  );
}

function toBreachItems(value: unknown): BreachApiItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isBreachItem);
}

export async function checkEmail(email: string): Promise<BreachApiItem[]> {
  try {
    const baseUrl = await getBackendBaseUrl();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return [];
    }

    const response = await fetch(
      `${baseUrl}/breach/email/${encodeURIComponent(trimmedEmail)}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as unknown;
    return toBreachItems(payload);
  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error("Unknown checkEmail error");
    // if (DEBUG) console.error("checkEmail failed", typedError);
    void typedError;
    return [];
  }
}

export async function checkUsername(username: string): Promise<BreachApiItem[]> {
  try {
    const baseUrl = await getBackendBaseUrl();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      return [];
    }

    const response = await fetch(`${baseUrl}/breach/username`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: trimmedUsername }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as unknown;
    return toBreachItems(payload);
  } catch (error: unknown) {
    const typedError =
      error instanceof Error ? error : new Error("Unknown checkUsername error");
    // if (DEBUG) console.error("checkUsername failed", typedError);
    void typedError;
    return [];
  }
}

void DEBUG;