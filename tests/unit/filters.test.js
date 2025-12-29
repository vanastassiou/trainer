import { describe, it, expect, beforeEach } from 'vitest';
import {
  filterExercises,
  getUniqueValues,
  getAvailableFilterOptions
} from '../../js/filters.js';
import { exercisesDBObject } from '../fixtures/exercises.js';
import { state, resetState } from '../../js/state.js';

// =============================================================================
// filterExercises
// =============================================================================

// Use state.exercisesDB to get flattened exercise properties
let exercises;

beforeEach(() => {
  resetState();
  state.exercisesDB = exercisesDBObject;
  exercises = state.exercisesDB;
});

describe('filterExercises', () => {
  it('returns all exercises with no filters', () => {
    const result = filterExercises(exercises, {});
    expect(result).toHaveLength(exercises.length);
  });

  it('returns all exercises with empty filters', () => {
    const result = filterExercises(exercises, {
      searchTerm: '',
      muscleGroup: '',
      movementPattern: '',
      equipment: '',
      difficulty: ''
    });
    expect(result).toHaveLength(exercises.length);
  });

  it('filters by search term (case-insensitive)', () => {
    const result = filterExercises(exercises, { searchTerm: 'barbell' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.name.toLowerCase().includes('barbell'))).toBe(true);
  });

  it('filters by search term with different case', () => {
    const result = filterExercises(exercises, { searchTerm: 'BARBELL' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.name.toLowerCase().includes('barbell'))).toBe(true);
  });

  it('filters by muscle group', () => {
    const result = filterExercises(exercises, { muscleGroup: 'back' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.muscle_group === 'back')).toBe(true);
  });

  it('filters by movement pattern', () => {
    const result = filterExercises(exercises, { movementPattern: 'horizontal_pull' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.movement_pattern === 'horizontal_pull')).toBe(true);
  });

  it('filters by equipment', () => {
    const result = filterExercises(exercises, { equipment: 'bodyweight' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.equipment === 'bodyweight')).toBe(true);
  });

  it('filters by difficulty', () => {
    const result = filterExercises(exercises, { difficulty: 'beginner' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.difficulty === 'beginner')).toBe(true);
  });

  it('combines multiple filters', () => {
    const result = filterExercises(exercises, {
      muscleGroup: 'back',
      equipment: 'barbell'
    });
    expect(result.every(ex =>
      ex.muscle_group === 'back' && ex.equipment === 'barbell'
    )).toBe(true);
  });

  it('returns empty array when no matches', () => {
    const result = filterExercises(exercises, {
      searchTerm: 'nonexistent'
    });
    expect(result).toEqual([]);
  });

  it('returns empty array for empty exercise list', () => {
    const result = filterExercises([], { muscleGroup: 'back' });
    expect(result).toEqual([]);
  });
});

// =============================================================================
// getUniqueValues
// =============================================================================

describe('getUniqueValues', () => {
  it('extracts unique values for a field', () => {
    const result = getUniqueValues(exercises, 'muscle_group');
    expect(result).toContain('back');
    expect(result).toContain('chest');
    expect(new Set(result).size).toBe(result.length); // All unique
  });

  it('returns sorted values', () => {
    const result = getUniqueValues(exercises, 'muscle_group');
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it('handles empty array', () => {
    expect(getUniqueValues([], 'muscle_group')).toEqual([]);
  });

  it('extracts unique equipment values', () => {
    const result = getUniqueValues(exercises, 'equipment');
    expect(result).toContain('barbell');
    expect(result).toContain('dumbbell');
    expect(result).toContain('bodyweight');
  });

  it('extracts unique difficulty values', () => {
    const result = getUniqueValues(exercises, 'difficulty');
    expect(result).toContain('beginner');
    expect(result).toContain('intermediate');
  });

  it('skips null/undefined values', () => {
    const testExercises = [
      { id: '1', name: 'Ex1', muscle_group: 'back' },
      { id: '2', name: 'Ex2', muscle_group: null },
      { id: '3', name: 'Ex3' }
    ];
    const result = getUniqueValues(testExercises, 'muscle_group');
    expect(result).toEqual(['back']);
  });
});

// =============================================================================
// getAvailableFilterOptions
// =============================================================================

describe('getAvailableFilterOptions', () => {
  it('returns options available given other filters', () => {
    const result = getAvailableFilterOptions(
      exercises,
      'equipment',
      { muscleGroup: 'back' }
    );
    // Should only include equipment used by back exercises
    expect(result).toContain('barbell');
    expect(result).toContain('bodyweight');
  });

  it('returns all options with no other filters', () => {
    const result = getAvailableFilterOptions(
      exercises,
      'muscle_group',
      {}
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty when no exercises match filters', () => {
    const result = getAvailableFilterOptions(
      exercises,
      'equipment',
      { muscleGroup: 'nonexistent' }
    );
    expect(result).toEqual([]);
  });

  it('filters by multiple criteria', () => {
    const result = getAvailableFilterOptions(
      exercises,
      'difficulty',
      { muscleGroup: 'chest', equipment: 'barbell' }
    );
    // Should only include difficulty levels for chest+barbell exercises
    expect(result.length).toBeGreaterThan(0);
  });
});
