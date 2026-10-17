import { formatCode, groupCode, inviteLink } from './invites';

describe('groupCode', () => {
  it('splits a code into two groups of four for reading', () => {
    expect(groupCode('K7Q4M2XP')).toBe('K7Q4 M2XP');
  });

  it('cleans the code first, as the other formats do', () => {
    expect(groupCode(' k7q4-m2xp ')).toBe('K7Q4 M2XP');
  });

  it('leaves a code of four or fewer characters as one group', () => {
    expect(groupCode('K7Q')).toBe('K7Q');
    expect(groupCode('K7Q4')).toBe('K7Q4');
    expect(groupCode('')).toBe('');
  });

  it('changes only the display: the link and the typed form keep their own shape', () => {
    expect(inviteLink('K7Q4 M2XP')).toMatch(/\/K7Q4M2XP$/);
    expect(formatCode('K7Q4 M2XP')).toBe('K7Q4-M2XP');
  });
});
