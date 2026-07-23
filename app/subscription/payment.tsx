import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { colors, spacing } from '../../theme/tokens';

/**
 * Payment — UI only, non-functional. Deliberately NO real card-entry fields:
 * a "Add a card" placeholder and the primary action both surface a calm note
 * that nothing is charged. Preview of the flow, not a live checkout.
 */
export default function Payment() {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <Pressable onPress={back} accessibilityLabel="Go back" hitSlop={12} style={styles.backArrow}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">Checkout</Text>
          <Text variant="body" color="textSecondary">
            A preview of the plan and payment. Nothing is charged.
          </Text>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Plan
          </Text>
          <View style={styles.row}>
            <Text variant="body" color="textSecondary">
              Premium
            </Text>
            <Text variant="body">$4.99 a month</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="textSecondary">
            Payment method
          </Text>
          <Pressable
            onPress={() => setNote('Payment isn’t set up yet — this is a preview.')}
            accessibilityRole="button"
            style={styles.row}
          >
            <Text variant="body">Add a card</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {note ? (
          <Text variant="body" color="textSecondary">
            {note}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Start Premium"
          onPress={() => setNote('Payments aren’t live yet — nothing was charged.')}
        />
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
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
