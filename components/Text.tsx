import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type ColorName, type TypeVariant } from '../theme/tokens';

type TextProps = Omit<RNTextProps, 'style'> & {
  /** One of the 4 locked type roles. Defaults to `body`. */
  variant?: TypeVariant;
  /** A token color name. Defaults to `text`. */
  color?: ColorName;
  /**
   * Escape hatch for layout-only style (margins, alignment, etc.).
   * Font size cannot be overridden here — variant is the only way to size text,
   * so the 4-step ladder can never be bypassed.
   */
  style?: Omit<NonNullable<RNTextProps['style']>, 'fontSize' | 'lineHeight' | 'fontFamily'>;
};

/**
 * The only Text in the app. `variant` is a closed union over the 4 type roles
 * and `color` is a closed union over token names — there is no way to pass an
 * arbitrary font size.
 */
export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  return <RNText style={[typography[variant], { color: colors[color] }, style]} {...rest} />;
}
