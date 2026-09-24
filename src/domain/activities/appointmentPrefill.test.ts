import type { Event, EventType } from './contract';
import {
  appointmentForm,
  appointmentPayload,
  EMPTY_APPOINTMENT,
  nextAppointment,
} from './appointmentPrefill';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 12, 0);

let n = 0;
function ev<P>(type: EventType, occurredAt: number, payload: P, deletedAt: number | null = null) {
  n += 1;
  return {
    id: `e${n}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'u',
    updatedBy: 'u',
    clientCreatedAt: occurredAt,
    deletedAt,
  } satisfies Event<P>;
}
const visit = (
  at: number,
  payload: object = { title: 'Six week check' },
  deleted: number | null = null,
) => ev('appointment', at, payload, deleted);

describe('what the sheet saves', () => {
  it('leaves out what was left blank, rather than storing empty text', () => {
    expect(appointmentPayload({ ...EMPTY_APPOINTMENT, title: '  Six week check  ' })).toEqual({
      title: 'Six week check',
    });
  });

  it('keeps what was filled in, trimmed', () => {
    expect(
      appointmentPayload({
        title: 'Six week check',
        doctor: ' Dr Andreou ',
        clinic: 'Nicosia General',
        notes: ' bring the red book ',
        questions: ['  Is the rash normal?  ', '   ', 'How much should she weigh?'],
      }),
    ).toEqual({
      title: 'Six week check',
      doctor: 'Dr Andreou',
      clinic: 'Nicosia General',
      notes: 'bring the red book',
      // A blank question is dropped rather than saved as nothing.
      questions: ['Is the rash normal?', 'How much should she weigh?'],
    });
  });

  it('reads a saved one back, with the blanks as blanks', () => {
    expect(appointmentForm(visit(NOW, { title: 'Check', questions: ['Why?'] }))).toEqual({
      title: 'Check',
      doctor: '',
      clinic: '',
      notes: '',
      questions: ['Why?'],
    });
  });

  it('reads back nothing for a deleted one, or another kind of entry', () => {
    expect(appointmentForm(visit(NOW, { title: 'Gone' }, NOW))).toBe(null);
    expect(appointmentForm(ev('diaper', NOW, { kind: 'wet' }))).toBe(null);
    expect(appointmentForm(null)).toBe(null);
  });
});

describe('the next appointment', () => {
  it('is the soonest one still to come', () => {
    const soon = visit(NOW + DAY, { title: 'Tomorrow' });
    const later = visit(NOW + 5 * DAY, { title: 'Next week' });
    expect(nextAppointment([later, soon], NOW)?.payload.title).toBe('Tomorrow');
  });

  it('ignores one that has already happened', () => {
    expect(nextAppointment([visit(NOW - DAY, { title: 'Last week' })], NOW)).toBe(null);
  });

  it('ignores a cancelled one', () => {
    expect(nextAppointment([visit(NOW + DAY, { title: 'Cancelled' }, NOW)], NOW)).toBe(null);
  });

  it('is null when there are none', () => {
    expect(nextAppointment([ev('diaper', NOW, { kind: 'wet' })], NOW)).toBe(null);
  });
});
