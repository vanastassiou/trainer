import { describe, it, expect, beforeEach } from 'vitest';
import { state, resetState } from '../../js/state.js';
import { exercisesDBObject, sampleExercises } from '../fixtures/exercises.js';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  resetState();
});

// =============================================================================
// exercisesDB
// =============================================================================

describe('state.exercisesDB', () => {
  it('converts object to array with id property', () => {
    state.exercisesDB = exercisesDBObject;

    expect(Array.isArray(state.exercisesDB)).toBe(true);
    expect(state.exercisesDB.length).toBe(sampleExercises.length);
    expect(state.exercisesDB[0]).toHaveProperty('id');
  });

  it('builds exercisesById map', () => {
    state.exercisesDB = exercisesDBObject;

    expect(state.exercisesById.has('barbell-row')).toBe(true);
    expect(state.exercisesById.has('bench-press')).toBe(true);
    expect(state.exercisesById.get('barbell-row').name).toBe('Barbell row');
  });

  it('builds exerciseByName map with lowercase keys', () => {
    state.exercisesDB = exercisesDBObject;

    expect(state.exerciseByName.has('barbell row')).toBe(true);
    expect(state.exerciseByName.has('bench press')).toBe(true);
    expect(state.exerciseByName.get('barbell row').id).toBe('barbell-row');
  });
});

// =============================================================================
// articlesData / glossaryData
// =============================================================================

describe('state.articlesData', () => {
  it('gets and sets articlesData', () => {
    expect(state.articlesData).toBeNull();

    state.articlesData = [{ id: 'article1', title: 'Test' }];
    expect(state.articlesData).toHaveLength(1);
  });
});

describe('state.glossaryData', () => {
  it('gets and sets glossaryData', () => {
    expect(state.glossaryData).toBeNull();

    state.glossaryData = { term1: { definition: 'Test' } };
    expect(state.glossaryData).toHaveProperty('term1');
  });
});

// =============================================================================
// selectedDate
// =============================================================================

describe('state.selectedDate', () => {
  it('gets and sets selectedDate', () => {
    expect(state.selectedDate).toBeNull();

    state.selectedDate = '2025-06-15';
    expect(state.selectedDate).toBe('2025-06-15');
  });
});

// =============================================================================
// calendarMonth
// =============================================================================

describe('state.calendarMonth', () => {
  it('gets and sets calendarMonth', () => {
    expect(state.calendarMonth).toBeNull();

    state.calendarMonth = { year: 2025, month: 5 };
    expect(state.calendarMonth.year).toBe(2025);
    expect(state.calendarMonth.month).toBe(5);
  });
});

// =============================================================================
// journalDatesCache
// =============================================================================

describe('state.journalDatesCache', () => {
  it('adds and retrieves date completion', () => {
    state.addToJournalDatesCache('2025-06-15', 75);

    expect(state.getJournalDateCompletion('2025-06-15')).toBe(75);
  });

  it('returns null for non-cached date', () => {
    expect(state.getJournalDateCompletion('2025-06-15')).toBeNull();
  });

  it('clears cache', () => {
    state.addToJournalDatesCache('2025-06-15', 50);
    state.clearJournalDatesCache();

    expect(state.getJournalDateCompletion('2025-06-15')).toBeNull();
  });

  it('updates existing cache entry', () => {
    state.addToJournalDatesCache('2025-06-15', 50);
    state.addToJournalDatesCache('2025-06-15', 100);

    expect(state.getJournalDateCompletion('2025-06-15')).toBe(100);
  });
});

// =============================================================================
// unitPreference
// =============================================================================

describe('state.unitPreference', () => {
  it('defaults to metric', () => {
    expect(state.unitPreference).toBe('metric');
  });

  it('can be set to imperial', () => {
    state.unitPreference = 'imperial';
    expect(state.unitPreference).toBe('imperial');
  });
});

// =============================================================================
// editingProgramId
// =============================================================================

describe('state.editingProgramId', () => {
  it('gets and sets editingProgramId', () => {
    expect(state.editingProgramId).toBeNull();

    state.editingProgramId = 'prog123';
    expect(state.editingProgramId).toBe('prog123');
  });
});

// =============================================================================
// isInitializing
// =============================================================================

describe('state.isInitializing', () => {
  it('defaults to false', () => {
    expect(state.isInitializing).toBe(false);
  });

  it('can be set to true', () => {
    state.isInitializing = true;
    expect(state.isInitializing).toBe(true);
  });
});

// =============================================================================
// resetState
// =============================================================================

describe('resetState', () => {
  it('resets all state to defaults', () => {
    // Set various state values
    state.exercisesDB = exercisesDBObject;
    state.articlesData = [{ id: 'test' }];
    state.glossaryData = { term: 'def' };
    state.selectedDate = '2025-06-15';
    state.calendarMonth = { year: 2025, month: 5 };
    state.addToJournalDatesCache('2025-06-15', 50);
    state.unitPreference = 'imperial';
    state.editingProgramId = 'prog1';
    state.isInitializing = true;

    // Reset
    resetState();

    // Verify defaults
    expect(state.exercisesDB).toEqual([]);
    expect(state.exercisesById.size).toBe(0);
    expect(state.exerciseByName.size).toBe(0);
    expect(state.articlesData).toBeNull();
    expect(state.glossaryData).toBeNull();
    expect(state.selectedDate).toBeNull();
    expect(state.calendarMonth).toBeNull();
    expect(state.getJournalDateCompletion('2025-06-15')).toBeNull();
    expect(state.unitPreference).toBe('metric');
    expect(state.editingProgramId).toBeNull();
    expect(state.isInitializing).toBe(false);
  });
});
