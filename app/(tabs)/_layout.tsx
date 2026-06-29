import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/tokens';

/**
 * Bottom tab navigation — Home / History / Taste.
 * Quiet Authority: flat bar on the Bone bg, a single 1px Warm Gray top border,
 * no shadow/elevation. Active = Cool Slate accent, inactive = Warm Gray Deep.
 * Labels are caption-style (13, uppercase, light tracking).
 */
export default function TabsLayout() {
  // Respect the phone's bottom gesture/home-indicator inset so labels aren't
  // clipped by the safe area.
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.chipBorder,
          // Flat: strip the default shadow/elevation.
          elevation: 0,
          shadowOpacity: 0,
          // Native: grow the bar by the safe-area inset (insets.bottom reads 0
          // on web). Mobile web: a fixed-height bar with only modest bottom
          // padding — the label is lifted UP via the item/label styles below so
          // it sits fully inside the bar instead of overflowing past it.
          height: isWeb ? 86 : 58 + insets.bottom,
          paddingTop: isWeb ? 6 : 8,
          paddingBottom: isWeb ? 12 : insets.bottom + 8,
        },
        // Web: nudge the icon+label group up off the bottom edge.
        tabBarItemStyle: isWeb ? { paddingBottom: 6 } : undefined,
        tabBarLabelStyle: {
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          // Web: lineHeight + bottom margin keep descenders from being clipped
          // and pull the label fully inside the bar. Native keeps a small lift.
          ...(isWeb
            ? { marginTop: 2, marginBottom: 10, lineHeight: 16, includeFontPadding: false }
            : { marginBottom: 4 }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="taste"
        options={{
          title: 'Taste',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
