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
          // on web). Mobile web: a generous FIXED bar that guarantees the
          // labels clear the browser chrome / home indicator without depending
          // on env() resolving to a nonzero value (env padding in +html.tsx is
          // an extra cushion on real devices).
          height: isWeb ? 88 : 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: isWeb ? 28 : insets.bottom + 8,
        },
        tabBarLabelStyle: {
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          // Lift the label off the bar's bottom edge.
          marginBottom: 4,
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
