import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  Segmented,
  Sheet,
  SheetPanel,
  Stepper,
  TimerText,
} from '../primitives';
import type { Theme } from '../theme';
import { ThemeProvider, useTheme } from '../theme';
import type { Scheme } from '../tokens';
import { colors } from '../tokens';

/**
 * Developer screen: every primitive in every state, in every scheme, so the
 * set can be judged as a system. Labels are placeholder demo text, not app copy.
 */
export function PrimitivesShowcase() {
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {(Object.keys(colors) as Scheme[]).map((scheme) => (
        <ThemeProvider key={scheme} scheme={scheme}>
          <SchemeSection />
        </ThemeProvider>
      ))}
    </ScrollView>
  );
}

const sides = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
] as const;
const diaper = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'both', label: 'Both' },
] as const;

function SchemeSection() {
  const theme = useTheme();
  const s = styles(theme);
  const [ml, setMl] = useState(90);
  const [side, setSide] = useState<'left' | 'right' | null>('left');
  const [kind, setKind] = useState<'wet' | 'dirty' | 'both' | null>(null);
  const [feeds, setFeeds] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={theme.text.display}>
        {theme.scheme}
      </Text>

      <Group title="TimerText">
        <Card>
          {['0m', '42m', '1h 0m', '2h 18m', '26h 59m'].map((t) => (
            <TimerText key={t} text={t} />
          ))}
        </Card>
      </Group>

      <Group title="Button">
        <State name="primary">
          <Button label="Save" onPress={() => {}} />
        </State>
        <State name="primary pressed">
          <Button label="Save" onPress={() => {}} testOnly_pressed />
        </State>
        <State name="secondary">
          <Button label="Cancel" variant="secondary" onPress={() => {}} />
        </State>
        <State name="secondary pressed">
          <Button label="Cancel" variant="secondary" onPress={() => {}} testOnly_pressed />
        </State>
        <State name="disabled">
          <Button label="Save" onPress={() => {}} disabled />
        </State>
      </Group>

      <Group title="Stepper">
        <State name="default (interactive)">
          <Stepper
            value={ml}
            onChange={setMl}
            step={10}
            max={300}
            unit="mL"
            accessibilityLabel="Amount"
          />
        </State>
        <State name="pressed">
          <Stepper
            value={90}
            onChange={() => {}}
            unit="mL"
            accessibilityLabel="Amount"
            testOnly_pressed="increment"
          />
        </State>
        <State name="at min">
          <Stepper value={0} onChange={() => {}} unit="mL" accessibilityLabel="Amount" />
        </State>
        <State name="disabled">
          <Stepper value={90} onChange={() => {}} unit="mL" accessibilityLabel="Amount" disabled />
        </State>
        <State name="invalid">
          <Stepper value={0} onChange={() => {}} unit="mL" accessibilityLabel="Amount" invalid />
          <Text style={[theme.text.caption, s.invalidText]}>Enter an amount</Text>
        </State>
      </Group>

      <Group title="Segmented">
        <State name="default (interactive)">
          <Segmented options={sides} value={side} onChange={setSide} accessibilityLabel="Side" />
        </State>
        <State name="pressed">
          <Segmented
            options={diaper}
            value="wet"
            onChange={() => {}}
            accessibilityLabel="Diaper"
            testOnly_pressedValue="dirty"
          />
        </State>
        <State name="disabled">
          <Segmented
            options={diaper}
            value="both"
            onChange={() => {}}
            accessibilityLabel="Diaper"
            disabled
          />
        </State>
        <State name="invalid (interactive)">
          <Segmented
            options={diaper}
            value={kind}
            onChange={setKind}
            accessibilityLabel="Diaper"
            invalid={kind === null}
          />
          {kind === null ? (
            <Text style={[theme.text.caption, s.invalidText]}>Choose one</Text>
          ) : null}
        </State>
      </Group>

      <Group title="Chip">
        <View style={s.wrapRow}>
          <Chip label="Feeds" selected={feeds} onPress={() => setFeeds(!feeds)} />
          <Chip label="Diapers" selected={false} onPress={() => {}} />
          <Chip label="Sleep" selected={false} onPress={() => {}} testOnly_pressed />
          <Chip label="Health" selected={false} onPress={() => {}} disabled />
          <Chip label="Pump" selected onPress={() => {}} disabled />
        </View>
      </Group>

      <Group title="Card">
        <Card>
          <Text style={theme.text.heading}>Card</Text>
          <Text style={[theme.text.body, s.muted]}>surface, radius lg, padding lg</Text>
        </Card>
      </Group>

      <Group title="Sheet">
        <SheetPanel title="Sheet panel">
          <Stepper value={ml} onChange={setMl} step={10} unit="mL" accessibilityLabel="Amount" />
          <Button label="Save" onPress={() => {}} />
        </SheetPanel>
        <Button
          label="Open sheet with input"
          variant="secondary"
          onPress={() => setSheetOpen(true)}
        />
        <Sheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          closeLabel="Close"
          title="Note"
        >
          <TextInput
            style={[theme.text.body, s.input]}
            placeholder="Type to check the keyboard"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
          <Button label="Done" onPress={() => setSheetOpen(false)} />
        </Sheet>
      </Group>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.group}>
      <Text accessibilityRole="header" style={theme.text.title}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function State({ name, children }: { name: string; children: ReactNode }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.state}>
      <Text style={[theme.text.caption, s.muted]}>{name}</Text>
      {children}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    section: { backgroundColor: t.colors.background, padding: t.spacing.xl, gap: t.spacing.xxl },
    group: { gap: t.spacing.lg },
    state: { gap: t.spacing.xs },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
    muted: { color: t.colors.textMuted },
    invalidText: { color: t.colors.invalid },
    input: {
      minHeight: t.size.touchTarget * 2,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: t.size.borderThin,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.background,
      color: t.colors.text,
      textAlignVertical: 'top',
    },
  });
