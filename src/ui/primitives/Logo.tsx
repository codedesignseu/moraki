import { Image } from 'react-native';

import { useTheme } from '../theme';

/** The mark's own proportions (viewBox 78 × 62). */
const ASPECT = 78 / 62;

const MARKS = {
  // Honey deep on light backgrounds, honey at night: the logo's own colours,
  // never tinted by the theme (brand guidelines).
  light: require('../../../assets/logo/mark-day.png'),
  night: require('../../../assets/logo/mark-night.png'),
} as const;

type Props = {
  /** Read by screen readers, e.g. "Moraki". */
  accessibilityLabel: string;
  /** Height in dp; defaults to the header size. */
  height?: number;
  testID?: string;
};

/** The Moraki mark alone, without the wordmark, announced as a header. */
export function Logo({ accessibilityLabel, height, testID }: Props) {
  const theme = useTheme();
  const side = height ?? theme.size.logoHeader;
  return (
    <Image
      source={MARKS[theme.scheme]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      resizeMode="contain"
      style={{ height: side, width: side * ASPECT }}
    />
  );
}
