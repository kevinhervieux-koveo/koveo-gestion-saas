import { describe, it, expect } from '@jest/globals';
import { sortBills } from '../../client/src/pages/manager/bills-sort';

type SortableBill = {
  id: string;
  startDate?: string | null;
};

const fixture: SortableBill[] = [
  { id: 'a', startDate: '2026-03-15' },
  { id: 'b', startDate: null },
  { id: 'c', startDate: '2026-01-10' },
  { id: 'd', startDate: undefined },
  { id: 'e', startDate: '2026-05-22' },
  { id: 'f', startDate: null },
];

describe('sortBills by dueDate', () => {
  it('sorts ascending by due date with NULLs last', () => {
    const result = sortBills(fixture, 'dueDate', 'asc');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['c', 'a', 'e']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });

  it('sorts descending by due date with NULLs still last', () => {
    const result = sortBills(fixture, 'dueDate', 'desc');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['e', 'a', 'c']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });

  it('keeps NULL due dates at the end even when all dated bills are equal', () => {
    const sameDate: SortableBill[] = [
      { id: 'x1', startDate: '2026-02-01' },
      { id: 'n1', startDate: null },
      { id: 'x2', startDate: '2026-02-01' },
      { id: 'n2', startDate: undefined },
    ];

    const asc = sortBills(sameDate, 'dueDate', 'asc').map((b) => b.id);
    const desc = sortBills(sameDate, 'dueDate', 'desc').map((b) => b.id);

    expect(asc.slice(0, 2).sort()).toEqual(['x1', 'x2']);
    expect(asc.slice(2).sort()).toEqual(['n1', 'n2']);
    expect(desc.slice(0, 2).sort()).toEqual(['x1', 'x2']);
    expect(desc.slice(2).sort()).toEqual(['n1', 'n2']);
  });

  it('returns the original ordering when sortField is empty (e.g. after Clear Filters)', () => {
    const original = fixture.map((b) => b.id);

    const cleared = sortBills(fixture, '', 'asc').map((b) => b.id);
    const undef = sortBills(fixture, undefined, 'desc').map((b) => b.id);

    expect(cleared).toEqual(original);
    expect(undef).toEqual(original);
  });

  it('does not mutate the input array', () => {
    const input: SortableBill[] = [
      { id: 'a', startDate: '2026-03-15' },
      { id: 'b', startDate: '2026-01-10' },
    ];
    const snapshot = input.map((b) => b.id);

    sortBills(input, 'dueDate', 'asc');

    expect(input.map((b) => b.id)).toEqual(snapshot);
  });

  it('defaults to ascending when sortDirection is omitted', () => {
    const result = sortBills(fixture, 'dueDate');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['c', 'a', 'e']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });
});
