import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Literata_500Medium } from '@expo-google-fonts/literata';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { resetCurrentUser } from '../lib/currentUser';
// Named import also runs the module side effect: validates Supabase env vars and
// throws loudly if they are missing/blank, so we never boot a broken client.
import { supabase } from '../lib/supabase';
import { colors } from '../theme/tokens';

// Quiet Authority is light-only: pin React Navigation to the light theme always
// (never useColorScheme/Dark) and make scene containers paint Bone, so no dark
// shows through behind screens on a dark-mode phone browser.
const LightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Literata_500Medium,
  });

  // No eager anonymous sign-in here: a brand-new visitor must reach the Welcome
  // screen with NO session. The anonymous identity is minted on "Get started"
  // (welcome.tsx) or lazily by getCurrentUserId() when a screen first needs it.

  // Keep the in-memory identity memo in sync with the auth session: on any
  // identity-changing event (login / logout / promote-in-place), drop the memo
  // so getCurrentUserId() re-derives from the new session. Idempotent and cheap.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        resetCurrentUser();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Render nothing until Inter is ready, so the type ladder never flashes a fallback font.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={LightTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
