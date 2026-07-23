import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { colors, spacing } from '../../theme/tokens';

/**
 * Cancel — UI only, non-functional. Not a dead end: "Keep Premium" returns, and
 * the cancel action surfaces a calm preview note rather than doing anything.
 */
export default function CancelSubscription() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <Pressable onPress={back} accessibilityLabel="Go back" hitSlop={12} style={styles.backArrow}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Cancel Premium</Text>
          <Text variant="body" color="textSecondary">
            Premium stays on until the end of the month, then you go back to Free. Your pantry
            and taste stay exactly as they are.
          </Text>
        </View>

        {done ? (
          <Text variant="body" color="textSecondary">
            {"This is a preview — nothing changed, and you're still on Free."}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Cancel Premium" onPress={() => setDone(true)} />
        <Pressable onPress={back} accessibilityRole="button" style={styles.secondary}>
          <Text variant="body" color="accent">
            Keep Premium
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backArrow: {
    alignSelf: 'flex-start',
    marginLeft: -spacing.md,
    paddingTop: spacing.md,
    paddingRight: spacing.md,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
