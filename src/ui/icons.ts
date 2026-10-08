import type { ImageSourcePropType } from 'react-native';

/**
 * The Sage line icons (design/ui-icons), one 256 px PNG each, drawn black on
 * transparent so the theme can tint them. 256 px keeps a 84 pt icon sharp at 3x.
 * Swapping to SVG later means changing this map and Icon, nothing else.
 */
export const ICONS = {
  delete: require('../../assets/icons/delete.png') as ImageSourcePropType,
  diaper: require('../../assets/icons/diaper.png') as ImageSourcePropType,
  'diaper-both': require('../../assets/icons/diaper-both.png') as ImageSourcePropType,
  'diaper-dirty': require('../../assets/icons/diaper-dirty.png') as ImageSourcePropType,
  'diaper-wet': require('../../assets/icons/diaper-wet.png') as ImageSourcePropType,
  'eu-shield': require('../../assets/icons/eu-shield.png') as ImageSourcePropType,
  export: require('../../assets/icons/export.png') as ImageSourcePropType,
  feed: require('../../assets/icons/feed.png') as ImageSourcePropType,
  health: require('../../assets/icons/health.png') as ImageSourcePropType,
  invite: require('../../assets/icons/invite.png') as ImageSourcePropType,
  link: require('../../assets/icons/link.png') as ImageSourcePropType,
  private: require('../../assets/icons/private.png') as ImageSourcePropType,
  pump: require('../../assets/icons/pump.png') as ImageSourcePropType,
  reminder: require('../../assets/icons/reminder.png') as ImageSourcePropType,
  share: require('../../assets/icons/share.png') as ImageSourcePropType,
  sleep: require('../../assets/icons/sleep.png') as ImageSourcePropType,
  'tab-history': require('../../assets/icons/tab-history.png') as ImageSourcePropType,
  'tab-home': require('../../assets/icons/tab-home.png') as ImageSourcePropType,
  'tab-insights': require('../../assets/icons/tab-insights.png') as ImageSourcePropType,
  'tab-settings': require('../../assets/icons/tab-settings.png') as ImageSourcePropType,
  time: require('../../assets/icons/time.png') as ImageSourcePropType,
  visit: require('../../assets/icons/visit.png') as ImageSourcePropType,
  weight: require('../../assets/icons/weight.png') as ImageSourcePropType,
} as const;

export type IconName = keyof typeof ICONS;

/**
 * Small controls the icon set has no file for. The design draws them as text
 * glyphs, so they render as text in the UI font and follow the text size.
 */
export const GLYPHS = {
  back: '\u2039',
  forward: '\u203A',
  close: '\u00D7',
  plus: '+',
  minus: '\u2212',
  check: '\u2713',
} as const;

export type GlyphName = keyof typeof GLYPHS;
