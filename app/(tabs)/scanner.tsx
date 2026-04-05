import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import ClassificationCard from "../../src/components/ClassificationCard";
import RedFlagHighlighter from "../../src/components/RedFlagHighlighter";
import { THEME } from "../../src/constants/theme";
import { useScannerStore } from "../../src/stores/scannerStore";
import type { ScanResult } from "../../src/types";

const MAX_INPUT_LENGTH = 1500;

const CLASSIFICATION_COLORS: Record<ScanResult["classification"], string> = {
  SAFE: "#4ADE80",
  SPAM: "#FBBF24",
  SCAM: "#F97316",
  PHISHING: "#F87171",
};

export default function ScannerScreen() {
  const inputText = useScannerStore((state) => state.inputText);
  const isScanning = useScannerStore((state) => state.isScanning);
  const currentResult = useScannerStore((state) => state.currentResult);
  const scanHistory = useScannerStore((state) => state.scanHistory);
  const setInputText = useScannerStore((state) => state.actions.setInputText);
  const startScan = useScannerStore((state) => state.actions.startScan);
  const loadHistory = useScannerStore((state) => state.actions.loadHistory);

  const [progress, setProgress] = useState<number>(0);
  const wasScanningRef = useRef<boolean>(false);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (isScanning) {
      wasScanningRef.current = true;
      setProgress(8);
      intervalId = setInterval(() => {
        setProgress((previous) => Math.min(previous + 6, 92));
      }, 180);
    } else if (wasScanningRef.current) {
      setProgress(100);
      timeoutId = setTimeout(() => {
        setProgress(0);
        wasScanningRef.current = false;
      }, 300);
    } else {
      setProgress(0);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isScanning]);

  const canAnalyse = inputText.trim().length >= 10 && !isScanning;

  const handleScanPress = (): void => {
    if (!canAnalyse) {
      return;
    }

    void startScan();
  };

  const renderHistoryItem = ({ item }: { item: ScanResult }): ReactElement => {
    const color = CLASSIFICATION_COLORS[item.classification];

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.timestampText}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
          <View style={[styles.classificationBadge, { borderColor: color }]}> 
            <Text style={[styles.classificationBadgeText, { color }]}>
              {item.classification}
            </Text>
          </View>
        </View>
        <RedFlagHighlighter text={item.messagePreview} flags={item.redFlags} />
      </View>
    );
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={styles.title}>Message Scanner</Text>
      <Text style={styles.subtitle}>Paste suspicious SMS, email, or chat text.</Text>

      <View style={styles.inputWrap}>
        <TextInput
          multiline
          maxLength={MAX_INPUT_LENGTH}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Paste a suspicious message here..."
          placeholderTextColor={THEME.colors.textSecondary}
          style={styles.input}
          textAlignVertical="top"
        />
      </View>

      <Text style={styles.counterText}>{`${inputText.length}/${MAX_INPUT_LENGTH}`}</Text>

      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.button, !canAnalyse && styles.buttonDisabled]}
        disabled={!canAnalyse}
        onPress={handleScanPress}
      >
        <Text style={styles.buttonText}>
          {isScanning ? "Analysing..." : "Analyse Message"}
        </Text>
      </TouchableOpacity>

      {progress > 0 ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      ) : null}

      {currentResult ? <ClassificationCard result={currentResult} /> : null}

      {currentResult?.explanation === "Configure Backend URL in Settings" ? (
        <Text style={styles.apiKeyHint}>Configure Backend URL in Settings</Text>
      ) : null}

      <Text style={styles.historyTitle}>Recent Scans</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={scanHistory}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<Text style={styles.emptyText}>No scans yet.</Text>}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 22,
    fontFamily: THEME.fontFamily.dmSans,
    fontWeight: "700",
  },
  subtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontFamily: THEME.fontFamily.dmSans,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  headerBlock: {
    gap: 12,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius,
    backgroundColor: THEME.colors.surface,
    minHeight: 150,
  },
  input: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fontFamily.dmSans,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 150,
  },
  counterText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontFamily: THEME.fontFamily.jetbrainsMono,
    textAlign: "right",
  },
  button: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.borderRadius,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#0E0F11",
    fontSize: 15,
    fontFamily: THEME.fontFamily.dmSans,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: THEME.colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: THEME.colors.accent,
  },
  historyTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontFamily: THEME.fontFamily.dmSans,
    fontWeight: "700",
    marginTop: 4,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius,
    backgroundColor: THEME.colors.surface,
    padding: 12,
    gap: 8,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  timestampText: {
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fontFamily.jetbrainsMono,
    fontSize: 11,
    flex: 1,
  },
  classificationBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  classificationBadgeText: {
    fontFamily: THEME.fontFamily.dmSans,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  emptyText: {
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fontFamily.dmSans,
    fontSize: 13,
  },
  apiKeyHint: {
    color: THEME.colors.warning,
    fontFamily: THEME.fontFamily.dmSans,
    fontSize: 13,
  },
});