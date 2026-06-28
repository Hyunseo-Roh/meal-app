import { StyleSheet, View } from 'react-native';

import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { colors, spacing } from '../theme/tokens';

/**
 * TEMPORARY proof screen — Step 0 only.
 *
 * Exists solely to eyeball that fonts + tokens + the 4-step type ladder all
 * render. It gets replaced by Screen 3 ("How's Tonight") in Step 1.
 */
export default function TokenPreview() {
  return (
    <Screen style={styles.screen}>
      <Text variant="caption" color="textSecondary" style={styles.tag}>
        Temporary · Step 0 token preview
      </Text>

      <Text variant="display">Display 32</Text>
      <Text variant="title">Title 24</Text>
      <Text variant="body">Body 16 — the quiet default.</Text>
      <Text variant="caption" color="textSecondary">
        Caption 13 label
      </Text>

      <View style={styles.swatchRow}>
        <View style={styles.swatch}>
          <Text variant="body" color="have">
            ✓
          </Text>
        </View>
        <Text variant="caption" color="textSecondary">
          Sage “have” check
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tag: {
    marginBottom: spacing.sm,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.chipBorder,
  },
});
