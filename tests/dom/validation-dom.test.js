import { describe, it, expect, beforeEach } from 'vitest';
import { hasUnsavedWorkoutData, collectWorkoutData, collectProgramDays } from '../../js/validation.js';
import { state, resetState } from '../../js/state.js';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  resetState();
  document.body.innerHTML = '';
});

// =============================================================================
// hasUnsavedWorkoutData
// =============================================================================

describe('hasUnsavedWorkoutData', () => {
  it('returns false when all inputs are empty', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card">
          <input class="reps-input" value="">
          <input class="weight-input" value="">
          <input class="rir-input" value="">
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    expect(hasUnsavedWorkoutData(container)).toBe(false);
  });

  it('returns true when reps input has value', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card">
          <input class="reps-input" value="10">
          <input class="weight-input" value="">
          <input class="rir-input" value="">
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    expect(hasUnsavedWorkoutData(container)).toBe(true);
  });

  it('returns true when weight input has value', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card">
          <input class="reps-input" value="">
          <input class="weight-input" value="50">
          <input class="rir-input" value="">
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    expect(hasUnsavedWorkoutData(container)).toBe(true);
  });

  it('returns true when rir input has value', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card">
          <input class="reps-input" value="">
          <input class="weight-input" value="">
          <input class="rir-input" value="2">
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    expect(hasUnsavedWorkoutData(container)).toBe(true);
  });

  it('returns false for whitespace-only values', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card">
          <input class="reps-input" value="   ">
          <input class="weight-input" value="  ">
          <input class="rir-input" value=" ">
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    expect(hasUnsavedWorkoutData(container)).toBe(false);
  });

  it('checks all exercise cards', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card">
          <input class="reps-input" value="">
        </div>
        <div class="exercise-card">
          <input class="reps-input" value="">
        </div>
        <div class="exercise-card">
          <input class="reps-input" value="8">
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    expect(hasUnsavedWorkoutData(container)).toBe(true);
  });

  it('returns false for empty container', () => {
    document.body.innerHTML = '<div id="exercises-container"></div>';
    const container = document.getElementById('exercises-container');
    expect(hasUnsavedWorkoutData(container)).toBe(false);
  });
});

// =============================================================================
// collectWorkoutData
// =============================================================================

describe('collectWorkoutData', () => {
  beforeEach(() => {
    state.unitPreference = 'metric';
  });

  it('collects exercise data from cards', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card" data-exercise-id="bench-press">
          <input class="exercise-name" value="Bench press">
          <div class="set-row">
            <input class="reps-input" value="10">
            <input class="weight-input" value="80">
            <input class="rir-input" value="2">
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    const exercises = collectWorkoutData(container);

    expect(exercises).toHaveLength(1);
    expect(exercises[0].id).toBe('bench-press');
    expect(exercises[0].name).toBe('Bench press');
    expect(exercises[0].sets).toHaveLength(1);
    expect(exercises[0].sets[0].reps).toBe(10);
    expect(exercises[0].sets[0].weight).toBe(80);
    expect(exercises[0].sets[0].rir).toBe(2);
  });

  it('ignores hidden set rows', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card" data-exercise-id="squat">
          <input class="exercise-name" value="Squat">
          <div class="set-row">
            <input class="reps-input" value="5">
            <input class="weight-input" value="100">
            <input class="rir-input" value="1">
          </div>
          <div class="set-row hidden">
            <input class="reps-input" value="5">
            <input class="weight-input" value="100">
            <input class="rir-input" value="2">
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    const exercises = collectWorkoutData(container);

    expect(exercises[0].sets).toHaveLength(1);
  });

  it('ignores set-header rows', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card" data-exercise-id="row">
          <input class="exercise-name" value="Barbell row">
          <div class="set-row set-header">
            <span>Set</span><span>Reps</span><span>Weight</span>
          </div>
          <div class="set-row">
            <input class="reps-input" value="8">
            <input class="weight-input" value="70">
            <input class="rir-input" value="2">
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    const exercises = collectWorkoutData(container);

    expect(exercises[0].sets).toHaveLength(1);
  });

  it('handles empty input values as null', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card" data-exercise-id="pullup">
          <input class="exercise-name" value="Pull-up">
          <div class="set-row">
            <input class="reps-input" value="10">
            <input class="weight-input" value="">
            <input class="rir-input" value="">
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    const exercises = collectWorkoutData(container);

    expect(exercises[0].sets[0].reps).toBe(10);
    expect(exercises[0].sets[0].weight).toBeNull();
    expect(exercises[0].sets[0].rir).toBeNull();
  });

  it('converts imperial weight to metric for storage', () => {
    state.unitPreference = 'imperial';

    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card" data-exercise-id="bench">
          <input class="exercise-name" value="Bench press">
          <div class="set-row">
            <input class="reps-input" value="10">
            <input class="weight-input" value="220">
            <input class="rir-input" value="2">
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    const exercises = collectWorkoutData(container);

    // 220 lbs should convert to approximately 100 kg
    expect(exercises[0].sets[0].weight).toBeCloseTo(99.79, 0);
  });

  it('collects multiple exercises', () => {
    document.body.innerHTML = `
      <div id="exercises-container">
        <div class="exercise-card" data-exercise-id="ex1">
          <input class="exercise-name" value="Exercise 1">
          <div class="set-row">
            <input class="reps-input" value="10">
            <input class="weight-input" value="50">
            <input class="rir-input" value="2">
          </div>
        </div>
        <div class="exercise-card" data-exercise-id="ex2">
          <input class="exercise-name" value="Exercise 2">
          <div class="set-row">
            <input class="reps-input" value="12">
            <input class="weight-input" value="40">
            <input class="rir-input" value="1">
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('exercises-container');
    const exercises = collectWorkoutData(container);

    expect(exercises).toHaveLength(2);
    expect(exercises[0].id).toBe('ex1');
    expect(exercises[1].id).toBe('ex2');
  });
});

// =============================================================================
// collectProgramDays
// =============================================================================

describe('collectProgramDays', () => {
  it('collects exercise IDs from program day cards', () => {
    document.body.innerHTML = `
      <div id="program-days">
        <div class="program-day-card">
          <div class="exercise-picker-item" data-exercise-id="bench-press"></div>
          <div class="exercise-picker-item" data-exercise-id="lateral-raise"></div>
          <div class="exercise-picker-item" data-exercise-id="tricep-pushdown"></div>
        </div>
      </div>
    `;

    const container = document.getElementById('program-days');
    const days = collectProgramDays(container);

    expect(days).toHaveLength(1);
    expect(days[0].exercises).toEqual(['bench-press', 'lateral-raise', 'tricep-pushdown']);
  });

  it('collects multiple days', () => {
    document.body.innerHTML = `
      <div id="program-days">
        <div class="program-day-card">
          <div class="exercise-picker-item" data-exercise-id="bench-press"></div>
          <div class="exercise-picker-item" data-exercise-id="shoulder-press"></div>
        </div>
        <div class="program-day-card">
          <div class="exercise-picker-item" data-exercise-id="barbell-row"></div>
          <div class="exercise-picker-item" data-exercise-id="pull-up"></div>
        </div>
      </div>
    `;

    const container = document.getElementById('program-days');
    const days = collectProgramDays(container);

    expect(days).toHaveLength(2);
    expect(days[0].exercises).toEqual(['bench-press', 'shoulder-press']);
    expect(days[1].exercises).toEqual(['barbell-row', 'pull-up']);
  });

  it('handles empty days', () => {
    document.body.innerHTML = `
      <div id="program-days">
        <div class="program-day-card"></div>
      </div>
    `;

    const container = document.getElementById('program-days');
    const days = collectProgramDays(container);

    expect(days).toHaveLength(1);
    expect(days[0].exercises).toEqual([]);
  });

  it('skips items without exercise ID', () => {
    document.body.innerHTML = `
      <div id="program-days">
        <div class="program-day-card">
          <div class="exercise-picker-item" data-exercise-id="bench-press"></div>
          <div class="exercise-picker-item"></div>
          <div class="exercise-picker-item" data-exercise-id=""></div>
          <div class="exercise-picker-item" data-exercise-id="squat"></div>
        </div>
      </div>
    `;

    const container = document.getElementById('program-days');
    const days = collectProgramDays(container);

    expect(days[0].exercises).toEqual(['bench-press', 'squat']);
  });

  it('returns empty array for empty container', () => {
    document.body.innerHTML = '<div id="program-days"></div>';
    const container = document.getElementById('program-days');
    const days = collectProgramDays(container);

    expect(days).toEqual([]);
  });
});
