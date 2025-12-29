import { describe, it, expect } from 'vitest';
import {
  filterExercises,
  getUniqueValues,
  getAvailableFilterOptions
} from '../../js/filters.js';
import { sampleExercises } from '../fixtures/exercises.js';

// =============================================================================
// filterExercises
// =============================================================================

describe('filterExercises', () => {
  it('returns all exercises with no filters', () => {
    const result = filterExercises(sampleExercises, {});
    expect(result).toHaveLength(sampleExercises.length);
  });

  it('returns all exercises with empty filters', () => {
    const result = filterExercises(sampleExercises, {
      searchTerm: '',
      muscleGroup: '',
      movementPattern: '',
      equipment: '',
      difficulty: ''
    });
    expect(result).toHaveLength(sampleExercises.length);
  });

  it('filters by search term (case-insensitive)', () => {
    const result = filterExercises(sampleExercises, { searchTerm: 'barbell' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.name.toLowerCase().includes('barbell'))).toBe(true);
  });

  it('filters by search term with different case', () => {
    const result = filterExercises(sampleExercises, { searchTerm: 'BARBELL' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.name.toLowerCase().includes('barbell'))).toBe(true);
  });

  it('filters by muscle group', () => {
    const result = filterExercises(sampleExercises, { muscleGroup: 'back' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.muscle_group === 'back')).toBe(true);
  });

  it('filters by movement pattern', () => {
    const result = filterExercises(sampleExercises, { movementPattern: 'pull' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.movement_pattern === 'pull')).toBe(true);
  });

  it('filters by equipment', () => {
    const result = filterExercises(sampleExercises, { equipment: 'bodyweight' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.equipment === 'bodyweight')).toBe(true);
  });

  it('filters by difficulty', () => {
    const result = filterExercises(sampleExercises, { difficulty: 'beginner' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(ex => ex.difficulty === 'beginner')).toBe(true);
  });

  it('combines multiple filters', () => {
    const result = filterExercises(sampleExercises, {
      muscleGroup: 'back',
      equipment: 'barbell'
    });
    expect(result.every(ex =>
      ex.muscle_group === 'back' && ex.equipment === 'barbell'
    )).toBe(true);
  });

  it('returns empty array when no matches', () => {
    const result = filterExercises(sampleExercises, {
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
    const result = getUniqueValues(sampleExercises, 'muscle_group');
    expect(result).toContain('back');
    expect(result).toContain('chest');
    expect(new Set(result).size).toBe(result.length); // All unique
  });

  it('returns sorted values', () => {
    const result = getUniqueValues(sampleExercises, 'muscle_group');
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it('handles empty array', () => {
    expect(getUniqueValues([], 'muscle_group')).toEqual([]);
  });

  it('extracts unique equipment values', () => {
    const result = getUniqueValues(sampleExercises, 'equipment');
    expect(result).toContain('barbell');
    expect(result).toContain('dumbbell');
    expect(result).toContain('bodyweight');
  });

  it('extracts unique difficulty values', () => {
    const result = getUniqueValues(sampleExercises, 'difficulty');
    expect(result).toContain('beginner');
    expect(result).toContain('intermediate');
  });

  it('skips null/undefined values', () => {
    const exercises = [
      { id: '1', name: 'Ex1', muscle_group: 'back' },
      { id: '2', name: 'Ex2', muscle_group: null },
      { id: '3', name: 'Ex3' }
    ];
    const result = getUniqueValues(exercises, 'muscle_group');
    expect(result).toEqual(['back']);
  });
});

// =============================================================================
// getAvailableFilterOptions
// =============================================================================

describe('getAvailableFilterOptions', () => {
  it('returns options available given other filters', () => {
    const result = getAvailableFilterOptions(
      sampleExercises,
      'equipment',
      { muscleGroup: 'back' }
    );
    // Should only include equipment used by back exercises
    expect(result).toContain('barbell');
    expect(result).toContain('bodyweight');
  });

  it('returns all options with no other filters', () => {
    const result = getAvailableFilterOptions(
      sampleExercises,
      'muscle_group',
      {}
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty when no exercises match filters', () => {
    const result = getAvailableFilterOptions(
      sampleExercises,
      'equipment',
      { muscleGroup: 'nonexistent' }
    );
    expect(result).toEqual([]);
  });

  it('filters by multiple criteria', () => {
    const result = getAvailableFilterOptions(
      sampleExercises,
      'difficulty',
      { muscleGroup: 'chest', equipment: 'barbell' }
    );
    // Should only include difficulty levels for chest+barbell exercises
    expect(result.length).toBeGreaterThan(0);
  });
});
