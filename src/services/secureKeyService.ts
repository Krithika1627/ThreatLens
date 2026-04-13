import * as SecureStore from 'expo-secure-store';

export const GEMINI_KEY_NAME = "GEMINI_API_KEY";
export const CLOUD_FUNCTION_URL_KEY_NAME = "THREATLENS_CLOUD_FUNCTION_URL";
export const CLOUD_FUNCTION_API_KEY_NAME = "THREATLENS_CLOUD_FUNCTION_API_KEY";

export async function setKey(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`Failed to set key ${key}`, error);
  }
}

export async function getKey(key: string): Promise<string | null> {
  if (key === GEMINI_KEY_NAME) {
    const envGemini = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (typeof envGemini === "string" && envGemini.trim().length > 0) {
      return envGemini.trim();
    }
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`Failed to get key ${key}`, error);
    return null;
  }
}

/**
 * Returns the base URL for the image protection cloud function.
 * Update this URL after deploying the cloud function.
 */
export async function getCloudFunctionUrl(): Promise<string | null> {
  // First check for a user-configured URL in SecureStore
  try {
    const stored = await SecureStore.getItemAsync(CLOUD_FUNCTION_URL_KEY_NAME);
    if (stored) return stored;
  } catch {
    // Ignore SecureStore errors
  }

  // Fallback: environment variable
  const envUrl = process.env.EXPO_PUBLIC_CLOUD_FUNCTION_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  // Default: deployed cloud function URL
  return "https://us-central1-threatlens-492816.cloudfunctions.net/protect-image";
}

export async function getCloudFunctionApiKey(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(CLOUD_FUNCTION_API_KEY_NAME);
    if (typeof stored === "string" && stored.trim().length > 0) {
      return stored.trim();
    }
  } catch {
    // Ignore SecureStore errors
  }

  const envKey = process.env.EXPO_PUBLIC_CLOUD_FUNCTION_API_KEY;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return null;
}

// Ensure defaults for mock environment
export async function initializeMockKeys() {
  // Intentionally no mocked Gemini key. Set EXPO_PUBLIC_GEMINI_API_KEY
  // or store GEMINI_API_KEY securely via setKey.
}