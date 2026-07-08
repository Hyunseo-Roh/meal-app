import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '../../components/Screen';
import { Text as AppText } from '../../components/Text';
import { getAuthUser, isOnboarded, withTimeout } from '../../lib/currentUser';
import { colors } from '../../theme/tokens';

/**
 * Bottom tab navigation — Home / History / Pantry / Profile.
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
        lineHeight: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.78,
        textAlign: 'center',
        includeFontPadding: false,
        paddingBottom: 2,
      }}
    >
      {text}
    </Text>
  );
}

/**
 * Defense-in-depth guard for direct (web/deep-link) access to a tab that
 * bypassed the splash. Allow only a signed-in, onboarded account; any bad state
 * is sent to '/', which resolves to a NON-tab terminal (Welcome / Onboarding) —
 * so this can never ping-pong with the splash. We never redirect while state is
 * still `checking`. (No anon branch: sign-up is required, and the splash evicts
 * any legacy anonymous session before the tabs are ever reached.)
 */
function useTabGuard(): 'checking' | 'ok' | 'redirect' {
  const [state, setState] = useState<'checking' | 'ok' | 'redirect'>('checking');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await withTimeout(getAuthUser());
        if (!user) return active && setState('redirect');
        const done = await withTimeout(isOnboarded());
        return active && setState(done ? 'ok' : 'redirect');
      } catch {
        // Unknown state — send to the splash to re-resolve rather than risk
        // rendering the tabs for a non-onboarded user.
        return active && setState('redirect');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export default function TabsLayout() {
  // Native uses the bottom safe-area inset (reads 0 on web).
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const guard = useTabGuard();

  if (guard === 'checking') {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <AppText variant="body" color="textSecondary">
          One moment…
        </AppText>
      </Screen>
    );
  }
  if (guard === 'redirect') {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      initialRouteName="home"
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
        name="home"
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
        name="pantry"
        options={{
          title: 'Pantry',
          tabBarLabel: tabLabel('Pantry'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'basket' : 'basket-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: tabLabel('Profile'),
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
