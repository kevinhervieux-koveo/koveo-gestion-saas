import { describe, it, expect } from '@jest/globals';
import { sortBills } from '../../client/src/pages/manager/bills-sort';

type SortableBill = {
  id: string;
  totalAmount?: string | number | null;
};

const fixture: SortableBill[] = [
  { id: 'a', totalAmount: '250.00' },
  { id: 'b', totalAmount: null },
  { id: 'c', totalAmount: '50.00' },
  { id: 'd', totalAmount: undefined },
  { id: 'e', totalAmount: 1200 },
  { id: 'f', totalAmount: null },
];

describe('sortBills by amount', () => {
  it('sorts ascending by amount with NULLs last', () => {
    const result = sortBills(fixture, 'amount', 'asc');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['c', 'a', 'e']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });

  it('sorts descending by amount with NULLs still last', () => {
    const result = sortBills(fixture, 'amount', 'desc');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['e', 'a', 'c']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });

  it('keeps NULL amounts at the end even when all values are equal', () => {
    const sameAmount: SortableBill[] = [
      { id: 'x1', totalAmount: '100.00' },
      { id: 'n1', totalAmount: null },
      { id: 'x2', totalAmount: 100 },
      { id: 'n2', totalAmount: undefined },
    ];

    const asc = sortBills(sameAmount, 'amount', 'asc').map((b) => b.id);
    const desc = sortBills(sameAmount, 'amount', 'desc').map((b) => b.id);

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
      { id: 'a', totalAmount: '250.00' },
      { id: 'b', totalAmount: '50.00' },
    ];
    const snapshot = input.map((b) => b.id);

    sortBills(input, 'amount', 'asc');

    expect(input.map((b) => b.id)).toEqual(snapshot);
  });

  it('defaults to ascending when sortDirection is omitted', () => {
    const result = sortBills(fixture, 'amount');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['c', 'a', 'e']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });
});
