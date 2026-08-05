import Svg, { G, Line, Path, Rect } from 'react-native-svg';

type Props = {
  /** Active/inactive tab tint — passed straight through to every stroke. */
  color: string;
  size?: number;
};

/**
 * Pantry tab glyph — a shopping basket with groceries: a bottle and a rounded
 * loaf poking out over a rim band, with vertical slats down the basket body.
 * Stroke-only (no fill), 24x24 viewBox, 2px round strokes to sit alongside the
 * Ionicons on the other tabs. The single `color` prop carries the focus tint,
 * so the whole glyph tracks active (Charcoal) / inactive exactly like them.
 */
export function BasketIcon({ color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Bottle poking out — narrow neck, left of centre. */}
        <Path d="M7.6 9 L7.6 6.6 Q7.6 5.6 8.3 5.2 L8.3 3.5 L9.5 3.5 L9.5 5.2 Q10.2 5.6 10.2 6.6 L10.2 9" />
        {/* Loaf poking out — rounded dome, right of centre. */}
        <Path d="M12 9 C12 5.5 17.5 5.5 17.5 9" />
        {/* Rim band across the top of the basket. */}
        <Rect x={2.5} y={9} width={19} height={3} rx={1.5} />
        {/* Basket body — tapered, open top tucked under the rim. */}
        <Path d="M4 12 L6.5 20.5 L17.5 20.5 L20 12" />
        {/* Vertical slats, following the taper. */}
        <Line x1={8.9} y1={12.9} x2={9.5} y2={19.9} />
        <Line x1={12} y1={12.9} x2={12} y2={20} />
        <Line x1={15.1} y1={12.9} x2={14.5} y2={19.9} />
      </G>
    </Svg>
  );
}
