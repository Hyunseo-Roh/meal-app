import { Pressable, StyleSheet } from 'react-native';

import { colors, spacing } from '../theme/tokens';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Pill chip. Unselected: Greige card fill, Warm Gray border, Charcoal text.
 * Selected: Charcoal fill + Bone text — reads as clearly active (like a mini
 * primary button), not the muted Cool Slate that looked disabled (AA: Bone on
 * Charcoal is 11.33:1; Bone on Cool Slate was 2.41:1). Never Sage (gap-only).
 */
export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text variant="body" color={selected ? 'bg' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    // minHeight guarantees a ≥44px tap target (content alone computes to ~42);
    // justifyContent keeps the label vertically centered in the taller pill.
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.chipBorder,
    backgroundColor: colors.card,
  },
  chipSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
});
