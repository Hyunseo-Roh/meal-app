import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { lookupProduct, type OFFResult } from '../lib/openfoodfacts';
import { addPantryItem } from '../lib/pantry';
import { colors, spacing, typography } from '../theme/tokens';

// Barcode formats used on packaged grocery products.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

type Phase = 'scanning' | 'looking_up' | 'found' | 'confirm' | 'not_found' | 'error';
type FoundProduct = Extract<OFFResult, { status: 'found' }>;

// Display-only sentence case for the name prefill (local equivalent of the
// pantry screen's helper, which isn't exported). Storage still lowercases.
function toSentenceCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// Brand is usually the better pantry label than OFF's marketing product_name
// ("ZERO SUGAR LEMON-LIME SODA" vs "Sprite"); fall back to the name.
function prefillName(p: FoundProduct): string {
  return toSentenceCase((p.brand?.trim() || p.name?.trim() || ''));
}

/**
 * Full-screen barcode scanner (pushed route at /scanner). Detects a barcode,
 * looks it up in Open Food Facts, shows a product card, then a prefilled edit
 * step to confirm the name and add it to the pantry (reusing the manual-add
 * insert path). No schema change; category stays derived at render time.
 */
export default function Scanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  // Dedupe lock: pause detection after the first hit so it fires once.
  const [scanned, setScanned] = useState(false);
  const [phase, setPhase] = useState<Phase>('scanning');
  const [barcode, setBarcode] = useState<string | null>(null);
  const [product, setProduct] = useState<FoundProduct | null>(null);
  // Prefilled edit step (phase 'confirm').
  const [nameDraft, setNameDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function runLookup(code: string) {
    setPhase('looking_up');
    const result = await lookupProduct(code);
    if (result.status === 'found') {
      setProduct(result);
      setPhase('found');
    } else if (result.status === 'not_found') {
      setProduct(null);
      setPhase('not_found');
    } else {
      setPhase('error');
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    setBarcode(data);
    runLookup(data);
  }

  function scanAgain() {
    setProduct(null);
    setBarcode(null);
    setNameDraft('');
    setAddError(null);
    setAdding(false);
    setPhase('scanning');
    setScanned(false);
  }

  // Open the prefilled edit step from the found card.
  function openConfirm() {
    if (!product) return;
    setNameDraft(prefillName(product));
    setAddError(null);
    setPhase('confirm');
  }

  // Insert via the SAME path as manual add (dedupe + lowercase live there),
  // tagged source 'scanned', then return to the Pantry tab (which refetches on
  // focus). On failure, keep the edit card open with an inline note.
  async function confirmAdd() {
    const v = nameDraft.trim();
    if (!v || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      await addPantryItem(v, 'scanned');
      router.back();
    } catch {
      setAdding(false);
      setAddError('Could not add, try again');
    }
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

  // Granted — live camera with the scan overlay + per-phase bottom card.
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

        {phase === 'scanning' ? (
          <View style={styles.center} pointerEvents="none">
            <View style={styles.frame} />
            <Text variant="body" color="bg" style={styles.instruction}>
              Point at a product barcode
            </Text>
          </View>
        ) : null}
      </View>

      {phase !== 'scanning' ? (
        <View style={[styles.resultCard, { paddingBottom: insets.bottom + spacing.lg }]}>
          {phase === 'looking_up' ? (
            <View style={styles.lookingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text variant="body">Looking up</Text>
            </View>
          ) : null}

          {phase === 'found' && product ? (
            <>
              <View style={styles.productRow}>
                {product.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbPlaceholder} />
                )}
                <View style={styles.productInfo}>
                  <Text variant="body">{product.name}</Text>
                  {product.brand ? (
                    <Text variant="caption" color="textSecondary">
                      {product.brand}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.actions}>
                <PrimaryButton label="Add to pantry" onPress={openConfirm} />
                <Pressable onPress={scanAgain} accessibilityRole="button" style={styles.ghost}>
                  <Text variant="body">Scan again</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {phase === 'confirm' && product ? (
            <>
              <Text variant="title">Add to pantry</Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                onSubmitEditing={confirmAdd}
                autoFocus
                autoCapitalize="none"
                returnKeyType="done"
                placeholder="Item name"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
              <Text variant="caption" color="textSecondary" style={styles.refLine}>
                {product.brand ? `${product.name} · ${product.brand}` : product.name}
              </Text>
              {addError ? <Text variant="body">{addError}</Text> : null}
              <View style={styles.actions}>
                <PrimaryButton
                  label={adding ? 'Adding' : 'Add'}
                  onPress={confirmAdd}
                  disabled={adding || nameDraft.trim().length === 0}
                />
                <Pressable onPress={scanAgain} accessibilityRole="button" style={styles.ghost}>
                  <Text variant="body">Scan again</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {phase === 'not_found' ? (
            <>
              <Text variant="title">Not in database</Text>
              <Text variant="body" color="textSecondary">
                Sate could not find this product
              </Text>
              {barcode ? (
                <Text variant="caption" color="textSecondary">
                  {barcode}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <PrimaryButton label="Scan again" onPress={scanAgain} />
                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  style={styles.ghost}
                >
                  <Text variant="body">Done</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <Text variant="title">Lookup failed</Text>
              <Text variant="body" color="textSecondary">
                Check your connection and try again
              </Text>
              <View style={styles.actions}>
                <PrimaryButton
                  label="Try again"
                  onPress={() => barcode && runLookup(barcode)}
                />
                <Pressable onPress={scanAgain} accessibilityRole="button" style={styles.ghost}>
                  <Text variant="body">Scan again</Text>
                </Pressable>
              </View>
            </>
          ) : null}
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
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // Bone against the Greige card so the field reads as editable.
    backgroundColor: colors.bg,
  },
  refLine: {
    // Show the scanned product string as-is (override the caption uppercase).
    textTransform: 'none',
    letterSpacing: 0,
  },
  lookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: spacing.sm,
    backgroundColor: colors.chipBorder,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: spacing.sm,
    backgroundColor: colors.chipBorder,
  },
  productInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  actions: {
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
