import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ActivityTile,
  Button,
  Card,
  ChoiceButtons,
  Chip,
  DateTimeField,
  EmptyState,
  Icon,
  IconButton,
  IconCircle,
  InlineError,
  Legend,
  ListGroup,
  ListRow,
  PillButton,
  Segmented,
  Sheet,
  SheetPanel,
  ScreenHeader,
  ScreenTitle,
  StatCell,
  StatusPill,
  Stepper,
  TabBar,
  TextButton,
  TextField,
  TimerText,
  Toast,
} from '../primitives';
import type { IconName } from '../icons';
import { ICONS } from '../icons';
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
const kinds = [
  { value: 'bottle', label: 'Bottle', tone: 'feed' },
  { value: 'breast', label: 'Breast', tone: 'sleep' },
  { value: 'mixed', label: 'Mixed', tone: 'pump' },
] as const;

function SchemeSection() {
  const theme = useTheme();
  const s = styles(theme);
  const [ml, setMl] = useState(90);
  const [side, setSide] = useState<'left' | 'right' | null>('left');
  const [kind, setKind] = useState<'wet' | 'dirty' | 'both' | null>(null);
  const [feeds, setFeeds] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedKind, setFeedKind] = useState<'bottle' | 'breast' | 'mixed' | null>('bottle');
  const [note, setNote] = useState('');
  const [grams, setGrams] = useState(3240);

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
        <State name="secondary with icon">
          <Button label="Invite" variant="secondary" icon="invite" onPress={() => {}} />
        </State>
        <State name="disabled">
          <Button label="Save" onPress={() => {}} disabled />
        </State>
        <State name="secondary disabled">
          <Button label="Cancel" variant="secondary" onPress={() => {}} disabled />
        </State>
        <State name="busy">
          <Button label="Save" onPress={() => {}} busy />
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
          <InlineError prefix="Error" message="Enter an amount" />
        </State>
        <State name="compact (interactive)">
          <Stepper
            value={grams}
            onChange={setGrams}
            step={10}
            unit="g"
            accessibilityLabel="Grams"
            size="compact"
          />
        </State>
      </Group>

      <Group title="ChoiceButtons">
        <State name="default (interactive)">
          <ChoiceButtons
            options={kinds}
            value={feedKind}
            onChange={setFeedKind}
            accessibilityLabel="Kind"
          />
        </State>
        <State name="pressed">
          <ChoiceButtons
            options={kinds}
            value="bottle"
            onChange={() => {}}
            accessibilityLabel="Kind"
            testOnly_pressedValue="breast"
          />
        </State>
        <State name="disabled">
          <ChoiceButtons
            options={kinds}
            value="bottle"
            onChange={() => {}}
            accessibilityLabel="Kind"
            disabled
          />
        </State>
      </Group>

      <Group title="TextField">
        <TextField label="Note (interactive)" value={note} onChangeText={setNote} hint="0 of 500" />
        <TextField label="Email" value="parent@example.com" onChangeText={() => {}} icon="mail" />
        <TextField
          label="Weight"
          value="32400"
          onChangeText={() => {}}
          suffix="g"
          invalid
          message="enter a weight between 500 and 10,000 g."
          errorPrefix="Error"
        />
        <TextField label="Disabled" value="Baby" onChangeText={() => {}} disabled />
        <TextField label="Multiline" value="" onChangeText={() => {}} multiline />
      </Group>

      <Group title="InlineError">
        <InlineError prefix="Error" message="enter an amount above 0 ml." />
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
          {kind === null ? <InlineError prefix="Error" message="Choose one" /> : null}
        </State>
      </Group>

      <Group title="Chip">
        <View style={s.wrapRow}>
          <Chip label="Feeds" selected={feeds} onPress={() => setFeeds(!feeds)} />
          <Chip label="Diapers" selected={false} onPress={() => {}} />
          <Chip label="Sleep" selected={false} onPress={() => {}} testOnly_pressed />
          <Chip label="Health" selected={false} onPress={() => {}} disabled />
          <Chip label="Pump" selected onPress={() => {}} disabled />
          <Chip label="Card fill" selected={false} fill="card" onPress={() => {}} />
        </View>
      </Group>

      <Group title="Card">
        <Card>
          <Text style={theme.type.cardTitle}>Card</Text>
          <Text style={[theme.type.body, s.muted]}>card, corner 26</Text>
        </Card>
        <Card variant="hero" tone="feed">
          <Text style={theme.type.cardTitle}>Hero variant</Text>
        </Card>
        <Card tone="warning" icon="alert" message="Warning tone with an icon and one line.">
          <Button label="Outlined action" variant="secondary" onPress={() => {}} />
        </Card>
        <Card icon="feed" iconTone="feed" message="A card with a tinted badge." />
      </Group>

      <Group title="IconCircle">
        <View style={s.row}>
          <IconCircle icon="feed" tone="feed" size="row" />
          <IconCircle icon="sleep" tone="sleep" size="card" />
          <IconCircle icon="diaper" tone="diaper" size="sheet" />
          <IconCircle icon="visit" tone="pump" size="control" />
          <IconCircle icon="pump" tone="card" size="tile" />
          <IconCircle icon="tab-history" tone="chip" size="empty" iconColour="soft" />
        </View>
      </Group>

      <Group title="StatCell">
        <View style={s.cells}>
          <StatCell value="6" label="feeds" tone="feed" />
          <StatCell value="5" label="diapers" tone="diaper" />
          <StatCell value="11.5" label="h sleep" tone="sleep" />
          <StatCell value="520" label="ml bottle" tone="pump" />
        </View>
        <View style={s.cells}>
          <StatCell value="240 ml" label="Fridge" tone="pump" layout="labelFirst" />
          <StatCell value="600 ml" label="Freezer" tone="pump" layout="labelFirst" />
        </View>
      </Group>

      <Group title="PillButton">
        <View style={s.row}>
          <PillButton label="Log a feed" onPress={() => {}} />
          <PillButton label="Adjust" variant="outlined" onPress={() => {}} />
          <PillButton label="Pressed" onPress={() => {}} testOnly_pressed />
          <PillButton label="Disabled" onPress={() => {}} disabled />
        </View>
      </Group>

      <Group title="TextButton">
        <TextButton label="Review consent" onPress={() => {}} />
        <TextButton label="Revoke" tone="destructive" onPress={() => {}} />
        <TextButton label="Not now" align="center" onPress={() => {}} />
        <Button label="Delete account" variant="destructive" onPress={() => {}} />
      </Group>

      <Group title="Toast">
        <View style={s.toastFrame}>
          <Toast message="Feed saved" actionLabel="Undo" onAction={() => {}} />
        </View>
      </Group>

      <Group title="Legend">
        <Legend items={[{ label: 'Clinic' }, { label: 'Home', shape: 'hollow' }]} />
      </Group>

      <Group title="DateTimeField">
        <DateTimeField
          label="Time"
          value={0}
          onChange={() => {}}
          display="Today, 22:40 · now"
          openLabel="Set exact time"
        />
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

      <Group title="Sage icons">
        <View style={s.row}>
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <Icon key={name} name={name} />
          ))}
          <Icon name="back" />
          <Icon name="close" />
          <Icon name="plus" />
          <Icon name="check" />
        </View>
      </Group>

      <Group title="Sage tiles">
        <View style={s.row}>
          <ActivityTile
            colour="feed"
            icon="feed"
            title="Feed"
            detail="Detail line"
            onPress={() => {}}
            accessibilityLabel="Log"
          />
          <ActivityTile
            colour="sleep"
            icon="sleep"
            title="Sleep"
            detail="Detail line"
            onPress={() => {}}
            accessibilityLabel="Log"
          />
        </View>
        <View style={s.row}>
          <ActivityTile
            colour="diaper"
            icon="diaper"
            title="Diaper"
            onPress={() => {}}
            accessibilityLabel="Log"
          />
          <ActivityTile
            colour="pump"
            icon="pump"
            title="Pump"
            onPress={() => {}}
            accessibilityLabel="Log"
          />
        </View>
      </Group>

      <Group title="ListRow">
        <ListGroup>
          <ListRow grouped title="Health note" icon="health" badge="sleep" onPress={() => {}} />
          <ListRow
            grouped
            title="Medication"
            detail="Detail line"
            icon="health"
            badge="pump"
            onPress={() => {}}
          />
        </ListGroup>
        <ListRow
          title="List row"
          detail="Pressable"
          icon="visit"
          badge="diaper"
          onPress={() => {}}
        />
        <ListRow
          title="List row"
          detail="With a button"
          icon="health"
          trailing={
            <IconButton icon="plus" tone="line" onPress={() => {}} accessibilityLabel="Add" />
          }
        />
        <View style={s.row}>
          <IconButton icon="back" onPress={() => {}} accessibilityLabel="Back" />
          <IconButton icon="close" tone="chip" onPress={() => {}} accessibilityLabel="Close" />
          <StatusPill label="Status pill" />
          <StatusPill label="Running" live />
        </View>
      </Group>

      <Group title="Sage empty state">
        <EmptyState
          icon="tab-history"
          title="Empty title"
          body="One warm line."
          action={<PillButton label="Log a feed" onPress={() => {}} />}
        />
      </Group>

      <Group title="Screen title and header">
        <ScreenTitle title="Trends" subtitle="Last 7 days" />
        <ScreenHeader title="About Moraki" onBack={() => {}} backLabel="Back" />
      </Group>

      <Group title="Tab bar">
        <View style={s.tabBarFrame}>
          <TabBar
            items={[
              { key: 'a', label: 'Home', icon: 'tab-home', selected: true, onPress: () => {} },
              {
                key: 'b',
                label: 'History',
                icon: 'tab-history',
                selected: false,
                onPress: () => {},
              },
              {
                key: 'c',
                label: 'Insights',
                icon: 'tab-insights',
                selected: false,
                onPress: () => {},
              },
              {
                key: 'd',
                label: 'Settings',
                icon: 'tab-settings',
                selected: false,
                onPress: () => {},
              },
            ]}
          />
        </View>
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
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.spacing.md },
    cells: { flexDirection: 'row', gap: t.spacing.sm },
    toastFrame: { height: t.size.toast + t.size.navBar + t.size.navBottom + t.spacing.xl },
    tabBarFrame: { height: t.size.navBar + t.size.navBottom },
    muted: { color: t.colors.textMuted },
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
