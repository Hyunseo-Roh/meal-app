import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { colors } from '../theme/tokens';

/**
 * Web-only root HTML document (native ignores this).
 *
 * Quiet Authority is light-only. We force the light color scheme and paint the
 * Bone background unconditionally (and again under a dark media query with
 * !important) so a phone browser set to dark mode can't flip the page. We also
 * add viewport-fit=cover + env(safe-area-inset-bottom) padding so the bottom
 * tab bar clears the mobile browser's bottom chrome / home indicator.
 *
 * Colors come from theme/tokens (Bone #EDEAE3, Charcoal #2E2E2C) — no token
 * values are changed and no dark palette is introduced.
 */
const forceLight = `
:root { color-scheme: light only; }

html, body, #root {
  background-color: ${colors.bg} !important;
  color: ${colors.text};
}

/* Even when the browser prefers dark, keep the Bone background. */
@media (prefers-color-scheme: dark) {
  html, body, #root { background-color: ${colors.bg} !important; }
}

/* Mobile-web only: reserve the bottom safe-area so the tab bar isn't clipped
   by the browser chrome / home indicator. env() needs viewport-fit=cover. */
body, #root { padding-bottom: env(safe-area-inset-bottom, 0px); }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Light-only: never honor the OS dark preference. */}
        <meta name="color-scheme" content="light only" />

        {/* Expo's recommended reset so body scroll matches native behavior. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: forceLight }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
