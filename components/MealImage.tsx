import { useState } from 'react';
import { Image, View } from 'react-native';

import { upsizeImageUrl } from '../lib/format';
import { colors } from '../theme/tokens';

/**
 * A meal photo with a guaranteed same-size fallback. When `url` is null or the
 * image fails to load, it renders a flat Greige block at the exact same
 * dimensions — no icon, no placeholder text, no layout shift. Decorative
 * (hidden from a11y): the meal name always sits beside/below it.
 *
 * `upsize` swaps Spoonacular's 312x231 thumbnail for 636x393 — use it for the
 * full-width heroes (150 tall), not the 56px history thumbnails.
 */
export function MealImage({
  url,
  width,
  height,
  radius = 0,
  upsize = false,
}: {
  url: string | null;
  width: number | '100%';
  height: number;
  radius?: number;
  upsize?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  // Greige backs both states so a slow-loading photo never flashes bare Bone.
  const box = { width, height, borderRadius: radius, backgroundColor: colors.card };

  if (url && !failed) {
    return (
      <Image
        source={{ uri: upsize ? upsizeImageUrl(url) : url }}
        style={box}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessible={false}
      />
    );
  }
  return <View style={box} accessible={false} />;
}
