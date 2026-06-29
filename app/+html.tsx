import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { colors } from '../theme/tokens';

/**
 * Web-only root HTML document (native ignores this).
 *
 * Quiet Authority is light-only, so we force the light color scheme and paint
 * the Bone background at the html/body level — this stops the browser's
 * prefers-color-scheme: dark from flipping the page dark. No token values are
 * changed; we reuse colors.bg as the single source of truth.
 */
const forceLight = `
:root { color-scheme: only light; }
html, body, #root { background-color: ${colors.bg}; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Light-only: never honor the OS dark preference. */}
        <meta name="color-scheme" content="light" />

        {/* Expo's recommended reset so body scroll matches native behavior. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: forceLight }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
