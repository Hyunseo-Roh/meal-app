import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

type Props = {
  /** A CATEGORY_ORDER label; unknown keys fall back to the grid glyph. */
  category: string;
  size?: number;
  color?: string;
};

// Tabler outline path sets, one per pantry category. Rendered on a 24x24 viewBox
// with fill:none + 2px round strokes — the same react-native-svg approach as
// components/BasketIcon.tsx (no @tabler dependency; these are the raw shapes).
const CATEGORY_PATHS: Record<string, string[]> = {
  Proteins: [
    'M13.62 8.382l1.966 -1.967a2 2 0 1 1 2.828 -2.829l-1.966 1.966a2 2 0 0 1 -2.828 2.83z',
    'M5.904 18.596c2.733 2.734 5.9 4 7.07 2.83c1.172 -1.172 -.095 -4.338 -2.828 -7.07c-2.732 -2.734 -5.9 -4 -7.07 -2.83c-1.171 1.171 .095 4.337 2.828 7.07z',
    'M7.5 16l1 1',
    'M15.898 7.276a5.51 5.51 0 0 0 -1.352 -2.267',
  ],
  Produce: [
    'M9.428 8.062a3.999 3.999 0 0 0 -5.428 3.938c0 5.523 4.477 10 10 10c1.284 0 2.28 -.848 2.28 -2.062',
    'M18 8a2 2 0 1 0 -4 0',
    'M8.5 11.5l2 2',
    'M12.5 15.5l2 2',
    'M18.5 8.5c1.5 -1.5 2.5 -3.5 2.5 -5.5c-2 0 -4 1 -5.5 2.5',
    'M4 12l16 8',
  ],
  Grains: [
    'M12 3c-1.333 1.333 -2 2.667 -2 4c0 2 2 3 2 5c0 1.333 -.667 2.667 -2 4',
    'M16 4c-1 1 -1.5 2 -1.5 3c0 1.5 1.5 2.25 1.5 3.75c0 1 -.5 2 -1.5 3',
    'M8 4c-1 1 -1.5 2 -1.5 3c0 1.5 1.5 2.25 1.5 3.75c0 1 -.5 2 -1.5 3',
    'M4 15h16',
    'M6 15c.667 3 1.667 5 3 6h6c1.333 -1 2.333 -3 3 -6',
  ],
  Dairy: [
    'M8 3h8l-1 3h-6z',
    'M15 6l1 3v11a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-11l1 -3',
    'M8 13h8',
    'M10 17h4',
  ],
  'Fats & oils': ['M6.407 15.464l5.593 -9.464l5.593 9.464a6.5 6.5 0 1 1 -11.187 0z'],
  Seasonings: [
    'M8 8h8l-1 -4h-6z',
    'M7 8h10l1 12a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z',
    'M10 4v-1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v1',
    'M9.5 13.5l.01 0',
    'M12.5 12.5l.01 0',
    'M11.5 16.5l.01 0',
  ],
  Other: ['M4 4h6v6h-6z', 'M14 4h6v6h-6z', 'M4 14h6v6h-6z', 'M14 14h6v6h-6z'],
};

/**
 * A pantry category glyph drawn from the Tabler outline shapes via
 * react-native-svg. Matches the Ionicons rhythm it replaces (size 18, Toast Deep
 * stroke) so the Butter header band is unchanged apart from the artwork.
 */
export function CategoryIcon({ category, size = 18, color = colors.recCardBorder }: Props) {
  const paths = CATEGORY_PATHS[category] ?? CATEGORY_PATHS.Other;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
