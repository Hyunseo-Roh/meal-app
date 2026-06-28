import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';

type MealCardProps = {
  tierLabel: string;
  name: string;
  contextLine: string;
  cost: string;
  cookTime: string;
  overTime: boolean;
  onPress: () => void;
};

/**
 * One recommendation card. Greige fill, Warm Gray border, flat. Tier shown as
 * a quiet uppercase caption (never Sage — Sage is gap-only). over_time is a
 * calm informational caption, not a block.
 */
export function MealCard({
  tierLabel,
  name,
  contextLine,
  cost,
  cookTime,
  overTime,
  onPress,
}: MealCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <Text variant="caption" color="textSecondary">
        {tierLabel}
      </Text>
      <Text variant="title" style={styles.name}>
        {name}
      </Text>
      <Text variant="body" color="textSecondary">
        {contextLine}
      </Text>
      <View style={styles.metaRow}>
        <Text variant="caption" color="textSecondary">
          {cookTime}
        </Text>
        <Text variant="caption" color="textSecondary">
          {cost}
        </Text>
      </View>
      {overTime ? (
        <Text variant="caption" color="textSecondary">
          A little longer than tonight
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.chipBorder,
    borderWidth: 1,
    borderRadius: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  name: {
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
});
