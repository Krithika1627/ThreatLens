import { DMSans_400Regular } from "@expo-google-fonts/dm-sans";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import { Stack, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initDatabase } from "../src/services/storageService";
import { registerBackgroundFetchTasks } from "../src/services/backgroundTasks";
import { initializeNotificationInterceptor } from "../src/modules/notificationBridge";
import { requestNotificationPermissions } from "../src/services/notificationService";
import { useScannerStore } from "../src/stores/scannerStore";

const DEBUG = false;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "DMSans-Regular": DMSans_400Regular,
    "JetBrainsMono-Regular": JetBrainsMono_400Regular,
  });

  const router = useRouter();

  useEffect(() => {
    // 🔥 1. Ask notification permission
    requestNotificationPermissions();

    // 🔥 2. Background + interceptor (optional future use)
    void registerBackgroundFetchTasks();
    initializeNotificationInterceptor();

    // 🔥 3. NOTIFICATION LISTENER (MAIN LOGIC)
    const notificationSubscription =
      Notifications.addNotificationReceivedListener(async (notification) => {
        try {
          const message = notification.request.content.body;

          console.log("📩 Notification received:", message);

          if (message && typeof message === "string") {
            // 🔥 SCAN MESSAGE
            await useScannerStore.getState().scanManualText(message);

            console.log("✅ Scan triggered from notification");

            // 🔥 OPTIONAL ALERT
            Alert.alert("Scan Complete", "Message scanned for threats");

            // 🔥 Navigate to result screen
            router.push("/scan/result");
          }
        } catch (err) {
          console.error("❌ Notification scan failed:", err);
        }
      });

    // 🔗 Deep link handler (your existing logic)
    const handleUrl = (url: string | null) => {
      if (url) {
        try {
          const parsed = Linking.parse(url);
          const textAttr =
            parsed.queryParams?.text ||
            parsed.queryParams?.["android.intent.extra.TEXT"];

          if (textAttr && typeof textAttr === "string") {
            setTimeout(() => {
              void useScannerStore.getState().scanManualText(textAttr);
              router.push("/scan/result");
            }, 500);
          }
        } catch (e) {}
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const linkingSubscription = Linking.addEventListener("url", ({ url }) =>
      handleUrl(url)
    );

    // 🗄️ Init DB
    void initDatabase().catch((error: unknown) => {
      const typedError =
        error instanceof Error
          ? error
          : new Error("Database initialization failed");

      if (DEBUG) console.error("Root initDatabase failed", typedError);
    });

    // 🧹 CLEANUP
    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove(); // 🔥 IMPORTANT
    };
  }, [router]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: styles.stackContent,
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E0F11",
  },
  stackContent: {
    backgroundColor: "#0E0F11",
  },
});