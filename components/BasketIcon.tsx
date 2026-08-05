import Svg, { G, Path, Rect } from 'react-native-svg';

type Props = {
  /** Active/inactive tab tint — passed straight through to every stroke. */
  color: string;
  size?: number;
};

/**
 * Pantry tab glyph — a shopping basket with groceries: a tall bottle and one
 * big round item filling the basket over a rim band. Stroke-only (no fill),
 * 24x24 viewBox, round strokes to sit alongside the Ionicons on the other tabs.
 * The single `color` prop carries the focus tint, so the whole glyph tracks
 * active (Charcoal) / inactive exactly like them.
 */
export function BasketIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Tall bottle */}
        <Path d="M5.5 8.5 L5.5 5 Q5.5 3.9 6.5 3.4 L6.5 2 L8.5 2 L8.5 3.4 Q9.5 3.9 9.5 5 L9.5 8.5" />
        {/* Big round item */}
        <Path d="M10.5 8.5 C10.5 3.6 18.5 3.6 18.5 8.5" />
        {/* Rim band */}
        <Rect x={2.5} y={8.5} width={19} height={3.2} rx={1.4} />
        {/* Tapered body */}
        <Path d="M4.2 11.7 L6.4 19.5 L17.6 19.5 L19.8 11.7" />
      </G>
    </Svg>
  );
}
