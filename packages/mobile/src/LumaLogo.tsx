import Svg, { Path } from 'react-native-svg';
import {
  LUMA_ISOTYPE_PATH,
  LUMA_LOGO_VIEWBOX,
  LUMA_WORDMARK_PATHS,
} from '../../../shared/brand/luma-logo';
import { colors } from './theme';

const [, , viewWidth, viewHeight] = LUMA_LOGO_VIEWBOX.split(' ').map(Number);

/** Wordmark de Luma. Los trazos viven en `/shared/brand/luma-logo.ts`. */
export function LumaLogo({
  width = 168,
  color = colors.text,
}: {
  width?: number;
  color?: string;
}) {
  const height = (width * viewHeight) / viewWidth;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={LUMA_LOGO_VIEWBOX}
      accessibilityRole="image"
      accessibilityLabel="Luma"
    >
      {LUMA_WORDMARK_PATHS.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
      <Path d={LUMA_ISOTYPE_PATH} fill={color} />
    </Svg>
  );
}
