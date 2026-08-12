import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { Text } from '../components/Text';
import { colors, layout, spacing } from '../theme/tokens';

// Bundled brand hero. Drop the exported photo at assets/images/welcome-hero.jpg
// (this path) to replace the placeholder — the require resolves that file at
// build time, so the filename must stay exactly this.
const HERO = require('../assets/images/welcome-hero.jpg');

// Visible height of the hero below the status bar; insets.top is added on top so
// the image bleeds behind the notch. Tuned to the image's offset framing.
const HERO_HEIGHT = 430;

/**
 * First screen for a visitor with no session. A full-bleed brand hero fills the
 * full window width AND the top edge (behind the status bar) — it renders OUTSIDE
 * any safe-area / max-width column so nothing boxes it. The serif wordmark sits
 * over a flat Charcoal scrim (never a gradient); the two entry paths sit below on
 * Bone in a padded, centered column. Sign-up is required before onboarding (no
 * anonymous entry). No identity is minted here.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // If the hero asset ever fails to load, fall back to a flat Greige block the
  // same size — the screen never breaks.
  const [imageOk, setImageOk] = useState(true);

  return (
    <View style={styles.root}>
      {/* HERO — full-bleed: spans the full window width and starts at y=0, so the
          image bleeds edge to edge and behind the status bar. height carries
          insets.top so the covered band reaches the very top. */}
      <View style={[styles.hero, { height: HERO_HEIGHT + insets.top }]}>
        {imageOk ? (
          <Image
            source={HERO}
            style={styles.heroImage}
            onError={() => setImageOk(false)}
            accessible={false}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
        )}

        {/* Wordmark over the photo, on a flat (single-opacity) Charcoal scrim. */}
        <View style={styles.heroText}>
          <View style={styles.scrim} pointerEvents="none" />
          <Text variant="display" color="bg">
            Sate
          </Text>
          <Text variant="body" color="bg">
            Three meals, picked for your taste — decide in seconds.
          </Text>
        </View>
      </View>

      {/* ACTIONS — reintroduce the padded, centered column so the buttons keep
          their width; bottom padding clears the home indicator. */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.xl }]}>
        <PrimaryButton label="Sign up" onPress={() => router.push('/auth/register')} />
        <Pressable
          onPress={() => router.push('/auth/login')}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text variant="body" color="textSecondary">
            Log in
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full window: no maxWidth, no horizontal padding — the hero owns the edges.
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Full-bleed hero: stretches to the full window width (stretch cross-axis);
  // height is set inline (HERO_HEIGHT + insets.top).
  hero: {
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: colors.card, // shows through until the image paints
  },
  // The photo is a wide landscape with the plate low-left; `cover` can't lift it
  // enough on a phone, so we draw the image oversized at its exact aspect
  // (1066×647 ≈ 1440×874) and offset it to frame the plate + near hand, leaving
  // the empty table beneath for the wordmark scrim. Tuned for the 375–390px
  // content width and the 430px hero height.
  heroImage: {
    position: 'absolute',
    width: 1066,
    height: 647,
    left: -203,
    top: -213,
  },
  heroFallback: {
    backgroundColor: colors.card, // Greige, same size — never bare/broken
  },
  // Bottom text band; padded to the content margin so the wordmark stays inset
  // from the screen edges even though the hero itself is full-bleed.
  heroText: {
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  // Flat Charcoal scrim (one opacity, no gradient). Separate view so its opacity
  // never dims the Bone wordmark/tagline sitting on top of it.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    opacity: 0.55,
  },
  // Entry paths in a padded, centered column (max 390) below the hero, so the
  // Sign up button + Log in link keep their prior width. The leftover breathing
  // room falls at the bottom of the window.
  actions: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  link: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
