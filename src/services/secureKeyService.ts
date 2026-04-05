import * as SecureStore from 'expo-secure-store';

export const BACKEND_URL_KEY_NAME = "THREATLENS_BACKEND_URL";
export const GEMINI_KEY_NAME = "GEMINI_API_KEY";

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
  if (key === BACKEND_URL_KEY_NAME) return "https://threatlens-932777930684.asia-south1.run.app";

  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`Failed to get key ${key}`, error);
    return null;
  }
}

export async function getBackendBaseUrl(): Promise<string | null> {
  return await getKey(BACKEND_URL_KEY_NAME);
}

// Ensure defaults for mock environment
// In a real environment, you'd prompt the user if they're missing
export async function initializeMockKeys() {
  // Intentionally no mocked Gemini key. Set EXPO_PUBLIC_GEMINI_API_KEY
  // or store GEMINI_API_KEY securely via setKey.
}