import { describe, it, expect } from 'vitest';
import { calculateDailyCompletion, getProgramDayCount } from '../../js/db.js';
import {
  completeJournal,
  partialJournal,
  emptyJournal
} from '../fixtures/journals.js';

// DAILY_FIELDS = ['weight', 'restingHR', 'calories', 'protein', 'fibre', 'water', 'steps', 'sleep', 'recovery']
// Total: 9 fields

// =============================================================================
// calculateDailyCompletion
// =============================================================================

describe('calculateDailyCompletion', () => {
  it('returns 0 for null journal', () => {
    expect(calculateDailyCompletion(null)).toBe(0);
  });

  it('returns 0 for undefined journal', () => {
    expect(calculateDailyCompletion(undefined)).toBe(0);
  });

  it('returns 0 for journal without daily', () => {
    expect(calculateDailyCompletion({ body: {} })).toBe(0);
  });

  it('returns 0 for journal with null daily', () => {
    expect(calculateDailyCompletion({ daily: null })).toBe(0);
  });

  it('returns 0 for journal with empty daily', () => {
    expect(calculateDailyCompletion(emptyJournal)).toBe(0);
  });

  it('calculates percentage for partial completion', () => {
    // partialJournal has: weight, calories, protein (3 of 9 fields)
    const completion = calculateDailyCompletion(partialJournal);
    expect(completion).toBe(33); // 3/9 = 33.3% rounded
  });

  it('returns 100 for all fields filled', () => {
    expect(calculateDailyCompletion(completeJournal)).toBe(100);
  });

  it('ignores empty string values', () => {
    const journal = {
      daily: {
        weight: 75,
        calories: '',
        protein: null
      }
    };
    expect(calculateDailyCompletion(journal)).toBe(11); // 1/9 = 11.1%
  });

  it('ignores null values', () => {
    const journal = {
      daily: {
        weight: 75,
        calories: null,
        protein: undefined
      }
    };
    expect(calculateDailyCompletion(journal)).toBe(11); // 1/9
  });

  it('counts 0 as a valid value', () => {
    const journal = {
      daily: {
        weight: 0,
        calories: 0
      }
    };
    expect(calculateDailyCompletion(journal)).toBe(22); // 2/9 = 22.2%
  });

  it('handles realistic partial journal', () => {
    const journal = {
      daily: {
        weight: 74.8,
        calories: 2100,
        protein: 145,
        sleep: 8,
        steps: 10000
        // Missing: restingHR, fibre, water, recovery (5 of 9)
      }
    };
    expect(calculateDailyCompletion(journal)).toBe(56); // 5/9 = 55.5%
  });
});

// =============================================================================
// getProgramDayCount
// =============================================================================

describe('getProgramDayCount', () => {
  it('returns days array length', () => {
    const program = { days: [{}, {}, {}] };
    expect(getProgramDayCount(program)).toBe(3);
  });

  it('returns days.length for realistic program', () => {
    const program = {
      id: 'prog1',
      name: 'Test',
      days: [
        { exercises: ['ex1', 'ex2', 'ex3'] },
        { exercises: ['ex4', 'ex5', 'ex6'] }
      ]
    };
    expect(getProgramDayCount(program)).toBe(2);
  });

  it('falls back to dayCount property if days missing', () => {
    const program = { dayCount: 5 };
    expect(getProgramDayCount(program)).toBe(5);
  });

  it('returns 0 for undefined days and no dayCount', () => {
    expect(getProgramDayCount({})).toBe(0);
  });

  it('returns 0 for null days', () => {
    expect(getProgramDayCount({ days: null })).toBe(0);
  });

  it('returns 0 for empty days array', () => {
    expect(getProgramDayCount({ days: [] })).toBe(0);
  });

  it('prefers days.length over dayCount', () => {
    const program = { days: [{}, {}], dayCount: 5 };
    expect(getProgramDayCount(program)).toBe(2);
  });
});
