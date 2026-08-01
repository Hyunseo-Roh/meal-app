import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { colors, layout, spacing } from '../theme/tokens';

// Bundled brand hero. Drop the exported photo at assets/images/welcome-hero.jpg
// (this path) to replace the placeholder — the require resolves that file at
// build time, so the filename must stay exactly this.
const HERO = require('../assets/images/welcome-hero.jpg');

/**
 * First screen for a visitor with no session. A full-bleed brand hero carries
 * the serif wordmark (over a flat Charcoal scrim for legibility — never a
 * gradient); the two entry paths sit below on Bone. Sign-up is required before
 * onboarding (no anonymous entry). No identity is minted here.
 */
export default function Welcome() {
  const router = useRouter();
  // If the hero asset ever fails to load, fall back to a flat Greige block the
  // same size — the screen never breaks.
  const [imageOk, setImageOk] = useState(true);

  return (
    <Screen style={styles.screen}>
      <View style={styles.hero}>
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

      <View style={styles.actions}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    // Column: hero at the top, actions centered in the Bone space below it.
    gap: spacing.xl,
  },
  // Full-bleed hero: cancel the Screen's 24px side margins, fixed large height.
  hero: {
    marginHorizontal: -layout.screenMargin,
    marginTop: -spacing.xl,
    height: 430,
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
  // Bottom text band; re-inset to the content column (the hero broke out −24).
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
  // Entry paths sit one comfortable gap below the wordmark (the Screen column's
  // xl gap), NOT centered — so the leftover breathing room falls at the bottom
  // and the screen reads as one connected top-to-bottom column.
  actions: {
    gap: spacing.lg,
  },
  link: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
