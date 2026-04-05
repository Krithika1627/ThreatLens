import * as SecureStore from "expo-secure-store";

const DEBUG = false;

export const BACKEND_URL_KEY_NAME = "BACKEND_URL_KEY_NAME" as const;
export const AUTH_TOKEN_KEY_NAME = "AUTH_TOKEN_KEY_NAME" as const;
export const USER_PREFERENCES_KEY_NAME = "USER_PREFERENCES_KEY_NAME" as const;
export const DB_ENCRYPTION_KEY_NAME = "DB_ENCRYPTION_KEY_NAME" as const;

const DEFAULT_BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "";

export async function setKey(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error("Unknown setKey error");
    // if (DEBUG) console.error("setKey failed", typedError);
    void typedError;
    throw new Error("Failed to set secure key");
  }
}

export async function getKey(key: string): Promise<string | null> {
  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (typeof secureValue === "string") {
      return secureValue;
    }

    return null;
  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error("Unknown getKey error");
    // if (DEBUG) console.error("getKey failed", typedError);
    void typedError;

    return null;
  }
}

export async function getBackendBaseUrl(): Promise<string> {
  try {
    const configured = await getKey(BACKEND_URL_KEY_NAME);

    if (configured && configured.trim().length > 0) {
      return configured.trim();
    }

    // fallback to env
    return DEFAULT_BACKEND_BASE_URL;
  } catch (error) {
    return DEFAULT_BACKEND_BASE_URL;
  }
}

export async function deleteKey(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error: unknown) {
    const typedError =
      error instanceof Error ? error : new Error("Unknown deleteKey error");
    // if (DEBUG) console.error("deleteKey failed", typedError);
    void typedError;
    throw new Error("Failed to delete secure key");
  }
}

void DEBUG;