import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BasketIcon } from '../../components/BasketIcon';
import { Screen } from '../../components/Screen';
import { Text as AppText } from '../../components/Text';
import { getAuthUser, isOnboarded, withTimeout } from '../../lib/currentUser';
import { colors } from '../../theme/tokens';

/**
 * Bottom tab navigation — Home / Pantry / Profile (History merged into Profile).
 * Quiet Authority: flat bar on the Bone bg, a single 1px Warm Gray top border,
 * no shadow/elevation. Icon-only (no labels); active = solid Charcoal, inactive
 * = Warm Gray Deep. Home/Profile swap filled/outline glyphs on focus; Pantry's
 * custom basket is stroke-only and tracks the tint via its `color`.
 */

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
        // Icon-only bar — no text labels under the tabs.
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.chipBorder,
          // Flat: strip the default shadow/elevation.
          elevation: 0,
          shadowOpacity: 0,
          height: isWeb ? 64 : 58 + insets.bottom,
          // No labels: pad top and bottom evenly so the lone icon sits centred.
          paddingTop: isWeb ? 10 : 8,
          paddingBottom: isWeb ? 10 : insets.bottom + 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'Pantry',
          // Custom shopping-basket-with-groceries glyph; `color`/`focused` track
          // the tint + filled state like the Ionicons tabs. Rendered a touch
          // larger (26) so its lighter artwork matches their visual mass.
          tabBarIcon: ({ color, focused }) => (
            <BasketIcon color={color} focused={focused} size={26} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
