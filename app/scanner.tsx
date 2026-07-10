import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { colors, spacing } from '../theme/tokens';

// Barcode formats used on packaged grocery products.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

type Scan = { data: string; type: string };

/**
 * Full-screen barcode scanner (pushed route at /scanner). Camera preview + live
 * barcode detection ONLY — no product lookup and no Supabase write yet (those
 * are the next two steps). The result card is a temporary display of the raw
 * value to verify the detection pipeline on-device.
 */
export default function Scanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  // Dedupe lock: pause detection after the first hit so it fires once.
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<Scan | null>(null);

  function handleBarcodeScanned({ data, type }: { data: string; type: string }) {
    if (scanned) return;
    setScanned(true);
    setResult({ data, type });
  }

  // Permission still resolving — minimal blank placeholder.
  if (!permission) {
    return <View style={styles.blank} />;
  }

  // Not granted — request screen (or a Settings hint if permanently denied).
  if (!permission.granted) {
    return (
      <Screen style={styles.permissionScreen}>
        <View style={styles.permissionBody}>
          <Text variant="title">Camera access</Text>
          <Text variant="body" color="textSecondary">
            Sate needs your camera to scan barcodes
          </Text>
          {permission.canAskAgain ? (
            <PrimaryButton label="Allow camera" onPress={requestPermission} />
          ) : (
            <Text variant="body" color="textSecondary">
              Enable camera for Sate in your device Settings
            </Text>
          )}
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.link}>
          <Text variant="body" color="accent">
            Back
          </Text>
        </Pressable>
      </Screen>
    );
  }

  // Granted — live camera with the scan overlay.
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Subtle dark scrim (Charcoal token, semi-transparent) for overlay contrast. */}
      <View style={styles.scrim} pointerEvents="none" />

      {/* Overlay chrome — lets touches fall through to nothing behind the camera. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Close scanner"
          hitSlop={12}
          style={[styles.close, { top: insets.top + spacing.sm }]}
        >
          <Ionicons name="close" size={28} color={colors.bg} />
        </Pressable>

        <View style={styles.center} pointerEvents="none">
          <View style={styles.frame} />
          <Text variant="body" color="bg" style={styles.instruction}>
            Point at a product barcode
          </Text>
        </View>
      </View>

      {result ? (
        <View style={[styles.resultCard, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text variant="title">Scanned</Text>
          <Text variant="body">{result.data}</Text>
          <Text variant="caption" color="textSecondary">
            {result.type}
          </Text>
          <View style={styles.resultActions}>
            <PrimaryButton
              label="Scan again"
              onPress={() => {
                setResult(null);
                setScanned(false);
              }}
            />
            <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.ghost}>
              <Text variant="body">Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  permissionScreen: {
    justifyContent: 'center',
    gap: spacing.xl,
  },
  permissionBody: {
    gap: spacing.md,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    // Dark base behind the camera preview.
    backgroundColor: colors.text,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    opacity: 0.2,
  },
  close: {
    position: 'absolute',
    left: spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: spacing.lg,
    backgroundColor: 'transparent',
  },
  instruction: {
    textAlign: 'center',
  },
  resultCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  resultActions: {
    gap: spacing.md,
  },
  ghost: {
    height: 52,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
