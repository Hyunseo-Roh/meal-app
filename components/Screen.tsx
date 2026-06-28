import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout } from '../theme/tokens';

type ScreenProps = {
  children: ReactNode;
  /** Layout-only style applied to the inner content column. */
  style?: ViewStyle;
};

/**
 * Safe-area screen wrapper. Paints the Bone background edge to edge, applies
 * the 24px horizontal margin, and centers content to the 390px max width on
 * wider screens.
 */
export function Screen({ children, style }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <View style={[styles.content, style]}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenMargin,
  },
});
