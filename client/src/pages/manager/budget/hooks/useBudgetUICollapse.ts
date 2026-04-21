import { useEffect, useState } from 'react';

export type BudgetCardKey =
  | 'project'
  | 'bankAccount'
  | 'minimumRequirement'
  | 'revenue'
  | 'bills'
  | 'capitalInvestment';

export type BudgetCardsCollapsed = Record<BudgetCardKey, boolean>;

const FILTERS_KEY = 'budget-filters-collapsed';
const CARDS_KEY = 'budget-cards-collapsed';

const DEFAULT_CARDS_COLLAPSED: BudgetCardsCollapsed = {
  project: true,
  bankAccount: true,
  minimumRequirement: true,
  revenue: true,
  bills: true,
  capitalInvestment: true,
};

function readBool(key: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function readCards(): BudgetCardsCollapsed {
  try {
    const saved = localStorage.getItem(CARDS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_CARDS_COLLAPSED;
  } catch {
    return DEFAULT_CARDS_COLLAPSED;
  }
}

export function useBudgetUICollapse() {
  const [filtersCollapsed, setFiltersCollapsed] = useState<boolean>(() =>
    readBool(FILTERS_KEY, false)
  );

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filtersCollapsed));
  }, [filtersCollapsed]);

  const [cardsCollapsed, setCardsCollapsed] =
    useState<BudgetCardsCollapsed>(readCards);

  useEffect(() => {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cardsCollapsed));
  }, [cardsCollapsed]);

  const toggleCard = (cardName: BudgetCardKey) => {
    setCardsCollapsed((prev) => ({
      ...prev,
      [cardName]: !prev[cardName],
    }));
  };

  return {
    filtersCollapsed,
    setFiltersCollapsed,
    cardsCollapsed,
    setCardsCollapsed,
    toggleCard,
  };
}
