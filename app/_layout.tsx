import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { getCurrentUserId } from '../lib/currentUser';
// Imported at startup for its side effect: validates Supabase env vars and
// throws loudly if they are missing/blank, so we never boot a broken client.
import '../lib/supabase';

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
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
