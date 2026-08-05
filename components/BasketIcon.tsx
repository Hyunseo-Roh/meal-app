import Svg, { G, Line, Path, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';

type Props = {
  /** Active/inactive tab tint — stroke (and fill, when focused). */
  color: string;
  /** Knock-out colour for the filled state — the tab-bar background (colors.bg),
   *  so the rim band + slats read as true cut-outs. Defaults to that token. */
  bg?: string;
  /** Active tab → filled silhouette, matching the solid Home/Profile glyphs. */
  focused?: boolean;
  size?: number;
};

// Shared path data — the outline and the filled silhouette use the same shapes.
const BOTTLE = 'M5.5 8.5 L5.5 5 Q5.5 3.9 6.5 3.4 L6.5 2 L8.5 2 L8.5 3.4 Q9.5 3.9 9.5 5 L9.5 8.5';
const ROUND = 'M10.5 8.5 C10.5 3.6 18.5 3.6 18.5 8.5';
const BODY = 'M4.2 11.7 L6.4 19.5 L17.6 19.5 L19.8 11.7';

/**
 * Pantry tab glyph — a shopping basket with groceries: a tall bottle and one
 * big round item filling the basket over a rim band. 24x24 artwork, round
 * strokes to sit alongside the Ionicons on the other tabs. The viewBox is
 * tightened to the artwork's bounding box so the glyph fills the frame like the
 * Ionicons and sits level with them.
 *
 * Focus tracks the other tabs exactly:
 *   - UNFOCUSED: outline only (fill none, item bottoms open to tuck behind the
 *     rim), in the muted tint.
 *   - FOCUSED: filled Charcoal silhouette — but with negative space knocked out
 *     in the background colour so it still reads as a basket, not a blob (like
 *     filled Ionicons `home` keeps its door): the rim is a light divider band
 *     and three light slats break up the body.
 */
export function BasketIcon({ color, bg = colors.bg, focused = false, size = 26 }: Props) {
  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="1.5 0.25 21 21" fill="none">
        <G strokeLinecap="round" strokeLinejoin="round">
          {/* Items + body, filled Charcoal (items closed so they read solid). */}
          <Path d={`${BOTTLE} Z`} fill={color} stroke={color} strokeWidth={1.9} />
          <Path d={`${ROUND} Z`} fill={color} stroke={color} strokeWidth={1.9} />
          <Path d={`${BODY} Z`} fill={color} stroke={color} strokeWidth={1.9} />
          {/* Rim: light band cut out of the fill — the divider between items and
              body — with a thin colour stroke to keep its edges crisp. */}
          <Rect x={2.5} y={8.5} width={19} height={3.2} rx={1.4} fill={bg} stroke={color} strokeWidth={1.4} />
          {/* Knock-out slats — light verticals following the body's taper, so the
              solid body reads as a basket. */}
          <Line x1={8.95} y1={12.3} x2={9.68} y2={18.8} stroke={bg} strokeWidth={1.6} strokeLinecap="round" />
          <Line x1={12} y1={12.3} x2={12} y2={18.8} stroke={bg} strokeWidth={1.6} strokeLinecap="round" />
          <Line x1={15.05} y1={12.3} x2={14.32} y2={18.8} stroke={bg} strokeWidth={1.6} strokeLinecap="round" />
        </G>
      </Svg>
    );
  }
  // Unfocused — unchanged outline (57d292c).
  return (
    <Svg width={size} height={size} viewBox="1.5 0.25 21 21" fill="none">
      <G stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <Path d={BOTTLE} />
        <Path d={ROUND} />
        <Rect x={2.5} y={8.5} width={19} height={3.2} rx={1.4} />
        <Path d={BODY} />
      </G>
    </Svg>
  );
}
