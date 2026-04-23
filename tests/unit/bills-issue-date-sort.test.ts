import { describe, it, expect } from '@jest/globals';
import { sortBillsByIssueDate } from '../../client/src/pages/manager/bills-sort';

type SortableBill = {
  id: string;
  issueDate?: string | null;
};

const fixture: SortableBill[] = [
  { id: 'a', issueDate: '2026-03-15' },
  { id: 'b', issueDate: null },
  { id: 'c', issueDate: '2026-01-10' },
  { id: 'd', issueDate: undefined },
  { id: 'e', issueDate: '2026-05-22' },
  { id: 'f', issueDate: null },
];

describe('sortBillsByIssueDate', () => {
  it('sorts ascending by issue date with NULLs last', () => {
    const result = sortBillsByIssueDate(fixture, 'issueDate', 'asc');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['c', 'a', 'e']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });

  it('sorts descending by issue date with NULLs still last', () => {
    const result = sortBillsByIssueDate(fixture, 'issueDate', 'desc');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['e', 'a', 'c']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });

  it('keeps NULL issue dates at the end even when all dated bills are equal', () => {
    const sameDate: SortableBill[] = [
      { id: 'x1', issueDate: '2026-02-01' },
      { id: 'n1', issueDate: null },
      { id: 'x2', issueDate: '2026-02-01' },
      { id: 'n2', issueDate: undefined },
    ];

    const asc = sortBillsByIssueDate(sameDate, 'issueDate', 'asc').map((b) => b.id);
    const desc = sortBillsByIssueDate(sameDate, 'issueDate', 'desc').map((b) => b.id);

    expect(asc.slice(0, 2).sort()).toEqual(['x1', 'x2']);
    expect(asc.slice(2).sort()).toEqual(['n1', 'n2']);
    expect(desc.slice(0, 2).sort()).toEqual(['x1', 'x2']);
    expect(desc.slice(2).sort()).toEqual(['n1', 'n2']);
  });

  it('returns the original ordering when sortField is empty (e.g. after Clear Filters)', () => {
    const original = fixture.map((b) => b.id);

    const cleared = sortBillsByIssueDate(fixture, '', 'asc').map((b) => b.id);
    const undef = sortBillsByIssueDate(fixture, undefined, 'desc').map((b) => b.id);

    expect(cleared).toEqual(original);
    expect(undef).toEqual(original);
  });

  it('does not mutate the input array', () => {
    const input: SortableBill[] = [
      { id: 'a', issueDate: '2026-03-15' },
      { id: 'b', issueDate: '2026-01-10' },
    ];
    const snapshot = input.map((b) => b.id);

    sortBillsByIssueDate(input, 'issueDate', 'asc');

    expect(input.map((b) => b.id)).toEqual(snapshot);
  });

  it('defaults to ascending when sortDirection is omitted', () => {
    const result = sortBillsByIssueDate(fixture, 'issueDate');
    const ids = result.map((b) => b.id);

    expect(ids.slice(0, 3)).toEqual(['c', 'a', 'e']);
    expect(ids.slice(3).sort()).toEqual(['b', 'd', 'f']);
  });
});
