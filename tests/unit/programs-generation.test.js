import { describe, it, expect, beforeEach } from 'vitest';
import { generateProgram } from '../../js/programs.js';
import { state, resetState } from '../../js/state.js';
import { exercisesDBObject, sampleExercises } from '../fixtures/exercises.js';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  resetState();
  // Set up exercise database with sample exercises
  state.exercisesDB = exercisesDBObject;
});

// =============================================================================
// generateProgram - Basic Validation
// =============================================================================

describe('generateProgram - validation', () => {
  it('throws for invalid days per week (0)', () => {
    expect(() => generateProgram(0, ['barbell'], 'beginner')).toThrow();
  });

  it('throws for invalid days per week (7)', () => {
    expect(() => generateProgram(7, ['barbell'], 'beginner')).toThrow();
  });

  it('throws for invalid days per week (negative)', () => {
    expect(() => generateProgram(-1, ['barbell'], 'beginner')).toThrow();
  });
});

// =============================================================================
// generateProgram - Days Generation
// =============================================================================

describe('generateProgram - days generation', () => {
  it('generates correct number of days for 1 day/week', () => {
    const program = generateProgram(1, ['barbell', 'dumbbell', 'bodyweight'], 'intermediate');
    expect(program.days).toHaveLength(1);
  });

  it('generates correct number of days for 3 days/week', () => {
    const program = generateProgram(3, ['barbell', 'dumbbell', 'bodyweight'], 'intermediate');
    expect(program.days).toHaveLength(3);
  });

  it('generates correct number of days for 6 days/week', () => {
    const program = generateProgram(6, ['barbell', 'dumbbell', 'bodyweight'], 'intermediate');
    expect(program.days).toHaveLength(6);
  });

  it('generates day names from template', () => {
    const program = generateProgram(3, ['barbell', 'dumbbell', 'bodyweight'], 'intermediate');

    expect(program.days[0].name).toBe('Push');
    expect(program.days[1].name).toBe('Pull');
    expect(program.days[2].name).toBe('Legs');
  });

  it('sets program name from template', () => {
    const program = generateProgram(3, ['barbell', 'dumbbell', 'bodyweight'], 'intermediate');
    expect(program.name).toBe('Push pull legs');
  });
});

// =============================================================================
// generateProgram - Equipment Filter
// =============================================================================

describe('generateProgram - equipment filter', () => {
  it('only includes exercises matching available equipment', () => {
    const program = generateProgram(1, ['bodyweight'], 'intermediate');

    // Flatten all exercise IDs
    const allExerciseIds = program.days.flatMap(d => d.exercises);

    // Check all selected exercises are bodyweight
    for (const id of allExerciseIds) {
      const exercise = state.exercisesById.get(id);
      if (exercise) {
        expect(exercise.equipment).toBe('bodyweight');
      }
    }
  });

  it('handles multiple equipment types', () => {
    const program = generateProgram(1, ['barbell', 'bodyweight'], 'intermediate');
    const allExerciseIds = program.days.flatMap(d => d.exercises);

    for (const id of allExerciseIds) {
      const exercise = state.exercisesById.get(id);
      if (exercise) {
        expect(['barbell', 'bodyweight']).toContain(exercise.equipment);
      }
    }
  });
});

// =============================================================================
// generateProgram - Difficulty Filter
// =============================================================================

describe('generateProgram - difficulty filter', () => {
  it('beginner only includes beginner exercises', () => {
    const program = generateProgram(1, ['barbell', 'dumbbell', 'bodyweight', 'machine'], 'beginner');
    const allExerciseIds = program.days.flatMap(d => d.exercises);

    for (const id of allExerciseIds) {
      const exercise = state.exercisesById.get(id);
      if (exercise) {
        expect(exercise.difficulty).toBe('beginner');
      }
    }
  });

  it('intermediate includes beginner and intermediate exercises', () => {
    const program = generateProgram(1, ['barbell', 'dumbbell', 'bodyweight', 'machine'], 'intermediate');
    const allExerciseIds = program.days.flatMap(d => d.exercises);

    for (const id of allExerciseIds) {
      const exercise = state.exercisesById.get(id);
      if (exercise) {
        expect(['beginner', 'intermediate']).toContain(exercise.difficulty);
      }
    }
  });

  it('advanced includes all difficulty levels', () => {
    const program = generateProgram(1, ['barbell', 'dumbbell', 'bodyweight', 'machine'], 'advanced');
    const allExerciseIds = program.days.flatMap(d => d.exercises);

    for (const id of allExerciseIds) {
      const exercise = state.exercisesById.get(id);
      if (exercise) {
        expect(['beginner', 'intermediate', 'advanced']).toContain(exercise.difficulty);
      }
    }
  });
});

// =============================================================================
// generateProgram - Exercise Count
// =============================================================================

describe('generateProgram - exercise count', () => {
  it('generates at least 3 exercises per day', () => {
    const program = generateProgram(3, ['barbell', 'dumbbell', 'bodyweight', 'machine'], 'intermediate');

    for (const day of program.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('generates at most 6 exercises per day', () => {
    const program = generateProgram(3, ['barbell', 'dumbbell', 'bodyweight', 'machine'], 'advanced');

    for (const day of program.days) {
      expect(day.exercises.length).toBeLessThanOrEqual(6);
    }
  });
});

// =============================================================================
// generateProgram - No Duplicates
// =============================================================================

describe('generateProgram - no duplicates', () => {
  it('does not duplicate exercises across days', () => {
    const program = generateProgram(3, ['barbell', 'dumbbell', 'bodyweight', 'machine'], 'intermediate');
    const allExercises = program.days.flatMap(d => d.exercises);
    const uniqueExercises = new Set(allExercises);

    expect(uniqueExercises.size).toBe(allExercises.length);
  });

  it('does not duplicate exercises within a day', () => {
    const program = generateProgram(1, ['barbell', 'dumbbell', 'bodyweight', 'machine'], 'advanced');

    for (const day of program.days) {
      const uniqueInDay = new Set(day.exercises);
      expect(uniqueInDay.size).toBe(day.exercises.length);
    }
  });
});

// =============================================================================
// generateProgram - Goal Effect
// =============================================================================

describe('generateProgram - goal effect', () => {
  it('maintenance goal can generate fewer exercises', () => {
    const maintenance = generateProgram(
      3,
      ['barbell', 'dumbbell', 'bodyweight', 'machine'],
      'intermediate',
      'maintenance'
    );
    const growth = generateProgram(
      3,
      ['barbell', 'dumbbell', 'bodyweight', 'machine'],
      'intermediate',
      'growth'
    );

    const maintenanceTotal = maintenance.days.reduce((sum, d) => sum + d.exercises.length, 0);
    const growthTotal = growth.days.reduce((sum, d) => sum + d.exercises.length, 0);

    // Maintenance should have equal or fewer exercises
    expect(maintenanceTotal).toBeLessThanOrEqual(growthTotal);
  });
});

// =============================================================================
// generateProgram - Edge Cases
// =============================================================================

describe('generateProgram - edge cases', () => {
  it('handles empty exercise database', () => {
    resetState();
    state.exercisesDB = {};

    const program = generateProgram(1, ['barbell'], 'intermediate');

    expect(program.days).toHaveLength(1);
    expect(program.days[0].exercises).toEqual([]);
  });

  it('handles no matching equipment', () => {
    const program = generateProgram(1, ['nonexistent-equipment'], 'intermediate');

    expect(program.days).toHaveLength(1);
    expect(program.days[0].exercises).toEqual([]);
  });
});
