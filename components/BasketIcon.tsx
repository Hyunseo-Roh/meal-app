import Svg, { G, Path, Rect } from 'react-native-svg';

type Props = {
  /** Active/inactive tab tint — passed straight through to stroke (and fill when focused). */
  color: string;
  /** Active tab → filled silhouette, matching the solid Home/Profile glyphs. */
  focused?: boolean;
  size?: number;
};

/**
 * Pantry tab glyph — a shopping basket with groceries: a tall bottle and one
 * big round item filling the basket over a rim band. 24x24 artwork, round
 * strokes to sit alongside the Ionicons on the other tabs.
 *
 * Focus tracks the other tabs exactly: unfocused renders an OUTLINE (fill none,
 * item bottoms left open to tuck behind the rim); focused renders a FILLED
 * silhouette (paths closed + filled with `color`) so the active tab reads solid
 * like the filled `home`/`person` glyphs. `color` carries the tint per state.
 *
 * The viewBox is tightened to the artwork's bounding box (a square centred on
 * its centre of mass) so the glyph fills the frame like the Ionicons and sits
 * level with them — no floating, no reading small.
 */
export function BasketIcon({ color, focused = false, size = 26 }: Props) {
  // Close the open shapes only when filling, so the outline keeps its item
  // bottoms tucked behind the rim while the fill reads as one solid basket.
  const z = focused ? ' Z' : '';
  const fill = focused ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="1.5 0.25 21 21" fill="none">
      <G stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill={fill}>
        {/* Tall bottle */}
        <Path d={`M5.5 8.5 L5.5 5 Q5.5 3.9 6.5 3.4 L6.5 2 L8.5 2 L8.5 3.4 Q9.5 3.9 9.5 5 L9.5 8.5${z}`} />
        {/* Big round item */}
        <Path d={`M10.5 8.5 C10.5 3.6 18.5 3.6 18.5 8.5${z}`} />
        {/* Rim band */}
        <Rect x={2.5} y={8.5} width={19} height={3.2} rx={1.4} />
        {/* Tapered body */}
        <Path d={`M4.2 11.7 L6.4 19.5 L17.6 19.5 L19.8 11.7${z}`} />
      </G>
    </Svg>
  );
}
