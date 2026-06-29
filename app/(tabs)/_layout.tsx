import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/tokens';

/**
 * Bottom tab navigation — Home / History / Taste.
 * Quiet Authority: flat bar on the Bone bg, a single 1px Warm Gray top border,
 * no shadow/elevation. Active = Cool Slate accent, inactive = Warm Gray Deep.
 *
 * Labels are rendered with a custom RN <Text> (nav chrome, not screen content)
 * so they size to their own content — react-navigation's default label sits in
 * a fixed-height container that cropped the text bottom on iOS web. The `color`
 * arg carries the active/inactive tint automatically.
 */
function tabLabel(text: string) {
  return ({ color }: { color: string }) => (
    <Text
      style={{
        color,
        fontSize: 13,
        lineHeight: 18,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: 'center',
        includeFontPadding: false,
        paddingBottom: 2,
      }}
    >
      {text}
    </Text>
  );
}

export default function TabsLayout() {
  // Native uses the bottom safe-area inset (reads 0 on web).
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
          height: isWeb ? 64 : 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: isWeb ? 10 : insets.bottom + 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: tabLabel('Home'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: tabLabel('History'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="taste"
        options={{
          title: 'Taste',
          tabBarLabel: tabLabel('Taste'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
