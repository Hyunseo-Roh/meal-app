import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { colors, spacing } from '../../theme/tokens';

// First step of account creation — the method chooser. Social options sit on top
// (UI-only, same "coming soon" pattern as register.tsx / the Pantry premium
// cards; no OAuth wired). "Sign up with email" leads to the email form
// (register.tsx), which owns the fields, validation, and onboarding redirect.
export default function SignUpChooser() {
  const router = useRouter();
  const [comingSoon, setComingSoon] = useState(false);

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityLabel="Go back"
        hitSlop={12}
        style={styles.backArrow}
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text variant="title">Create your account</Text>
          <Text variant="body" color="textSecondary">
            You can start right away.
          </Text>
        </View>

        {/* Social sign-in — visual only, not wired. Tap shows a calm note. */}
        <View style={styles.social}>
          <Pressable
            onPress={() => setComingSoon(true)}
            accessibilityRole="button"
            style={styles.ghost}
          >
            <Text variant="body">Continue with Google</Text>
          </Pressable>
          <Pressable
            onPress={() => setComingSoon(true)}
            accessibilityRole="button"
            style={styles.ghost}
          >
            <Text variant="body">Continue with Apple</Text>
          </Pressable>
          {comingSoon ? (
            <Text variant="body" color="textSecondary">
              Coming soon
            </Text>
          ) : null}
        </View>

        <PrimaryButton label="Sign up with email" onPress={() => router.push('/auth/register')} />

        <Pressable
          onPress={() => router.replace('/auth/login')}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text variant="body" color="accent">
            Already have an account? Log in
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 0,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    // 2px of horizontal room, matching register.tsx's scroll padding.
    paddingHorizontal: 2,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  // Copied verbatim from register.tsx so the social buttons look identical.
  social: {
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
  link: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
