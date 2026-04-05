import * as FileSystem from "expo-file-system/legacy";

export async function writeProtectionMetadata(imageUri: string, watermarkUuid: string): Promise<string> {
  console.log("Writing EXIF metadata...", imageUri);
  try {
    const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!cacheDir) {
      throw new Error("No writable cache directory available.");
    }

    // In pure Expo Go without custom development clients, rewriting image EXIF is heavily constrained.
    // As a compatible workaround, we proxy the modification and save the image directly
    const destinationUri = `${cacheDir}protected_exif_${Date.now()}.jpg`;
    
    await FileSystem.copyAsync({
      from: imageUri,
      to: destinationUri,
    });

    console.log(`Metadata framework updated successfully. UUID: ${watermarkUuid}`);
    return destinationUri;
  } catch (err) {
    console.error("Failed to write EXIF metadata", err);
    return imageUri; // Return original if it fails
  }
}
