import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { ThemeProvider, contrastRatio, useTheme } from '../theme';
import type { ColorName, Scheme, TypeVariant } from '../tokens';
import { colors, radius, spacing, typography } from '../tokens';

/**
 * Developer screen for judging the tokens: every scheme rendered in full,
 * one after another. Labels are token names, so there is no copy to translate.
 * Nothing is laid out with a fixed height, so it holds up at 200% font scale.
 */
export function TokenShowcase() {
  const schemes = Object.keys(colors) as Scheme[];
  return (
    <ScrollView>
      {schemes.map((scheme) => (
        <ThemeProvider key={scheme} scheme={scheme}>
          <SchemeSection />
        </ThemeProvider>
      ))}
    </ScrollView>
  );
}

function SchemeSection() {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={theme.text.display}>
        {theme.scheme}
      </Text>

      <Text accessibilityRole="header" style={s.groupHeading}>
        typography
      </Text>
      {(Object.keys(typography) as TypeVariant[]).map((variant) => (
        <Text key={variant} style={theme.text[variant]}>
          {variant}
        </Text>
      ))}
      <Text style={[theme.text.body, s.muted]}>textMuted</Text>

      <Text accessibilityRole="header" style={s.groupHeading}>
        colors
      </Text>
      {(Object.keys(theme.colors) as ColorName[]).map((name) => (
        <View key={name} style={s.row}>
          <View style={[s.swatch, { backgroundColor: theme.colors[name] }]} />
          <View style={s.rowText}>
            <Text style={theme.text.label}>{name}</Text>
            <Text style={[theme.text.caption, s.muted]}>
              {theme.colors[name]} ·{' '}
              {contrastRatio(theme.colors[name], theme.colors.background).toFixed(2)}
            </Text>
          </View>
        </View>
      ))}

      <Text accessibilityRole="header" style={s.groupHeading}>
        surfaces
      </Text>
      {(['surface', 'surfaceSunken', 'accentSubtle'] as const).map((bg) => (
        <View key={bg} style={[s.panel, { backgroundColor: theme.colors[bg] }]}>
          <Text style={theme.text.bodyStrong}>{bg}</Text>
          <Text style={[theme.text.body, s.muted]}>textMuted</Text>
          <Text style={[theme.text.label, s.accentText]}>accent</Text>
        </View>
      ))}
      <View style={s.accentBlock}>
        <Text style={[theme.text.bodyStrong, s.onAccent]}>onAccent</Text>
      </View>

      <Text accessibilityRole="header" style={s.groupHeading}>
        spacing
      </Text>
      {(Object.keys(spacing) as (keyof typeof spacing)[]).map((key) => (
        <View key={key} style={s.row}>
          <View style={[s.spacingBar, { width: spacing[key] }]} />
          <Text style={theme.text.caption}>
            {key} {spacing[key]}
          </Text>
        </View>
      ))}

      <Text accessibilityRole="header" style={s.groupHeading}>
        radius
      </Text>
      <View style={s.wrapRow}>
        {(Object.keys(radius) as (keyof typeof radius)[]).map((key) => (
          <View key={key} style={[s.radiusSample, { borderRadius: radius[key] }]}>
            <Text style={theme.text.caption}>{key}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    section: {
      backgroundColor: t.colors.background,
      padding: t.spacing.xl,
      gap: t.spacing.md,
    },
    groupHeading: {
      ...t.text.heading,
      marginTop: t.spacing.xl,
    },
    muted: { color: t.colors.textMuted },
    accentText: { color: t.colors.accent },
    onAccent: { color: t.colors.onAccent },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: t.size.touchTarget,
    },
    rowText: { flex: 1 },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md },
    swatch: {
      width: t.size.touchTarget,
      height: t.size.touchTarget,
      borderRadius: t.radius.sm,
      borderWidth: t.size.borderThin,
      borderColor: t.colors.borderStrong,
    },
    panel: {
      padding: t.spacing.lg,
      borderRadius: t.radius.md,
      gap: t.spacing.xs,
    },
    accentBlock: {
      backgroundColor: t.colors.accent,
      borderRadius: t.radius.pill,
      minHeight: t.size.touchTarget,
      paddingHorizontal: t.spacing.xl,
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    spacingBar: {
      height: t.spacing.lg,
      backgroundColor: t.colors.accent,
    },
    radiusSample: {
      minWidth: t.size.touchTarget * 2,
      minHeight: t.size.touchTarget * 2,
      padding: t.spacing.sm,
      justifyContent: 'flex-end',
      backgroundColor: t.colors.surfaceSunken,
      borderWidth: t.size.borderThin,
      borderColor: t.colors.borderStrong,
    },
  });
