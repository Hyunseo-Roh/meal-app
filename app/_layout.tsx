import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { getCurrentUserId } from '../lib/currentUser';
// Imported at startup for its side effect: validates Supabase env vars and
// throws loudly if they are missing/blank, so we never boot a broken client.
import '../lib/supabase';
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
  });

  // Silently establish the per-device anonymous identity on first load (client
  // only — runs after mount, never during web SSR). Failures here are
  // non-fatal; screens resolve the id again when they need it.
  useEffect(() => {
    getCurrentUserId().catch(() => {});
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
