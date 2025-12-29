import { describe, it, expect } from 'vitest';
import { WORKOUT, CHART, PROGRAM } from '../../js/config.js';

// =============================================================================
// WORKOUT configuration
// =============================================================================

describe('WORKOUT config', () => {
  it('has maxSetsPerExercise set to 3', () => {
    expect(WORKOUT.maxSetsPerExercise).toBe(3);
  });

  it('has minExercisesPerDay set to 3', () => {
    expect(WORKOUT.minExercisesPerDay).toBe(3);
  });

  it('has maxExercisesPerDay set to 6', () => {
    expect(WORKOUT.maxExercisesPerDay).toBe(6);
  });

  it('has defaultSetCount set to 3', () => {
    expect(WORKOUT.defaultSetCount).toBe(3);
  });
});

// =============================================================================
// CHART configuration
// =============================================================================

describe('CHART config', () => {
  it('has margins object with all required properties', () => {
    expect(CHART.margins).toHaveProperty('left');
    expect(CHART.margins).toHaveProperty('right');
    expect(CHART.margins).toHaveProperty('top');
    expect(CHART.margins).toHaveProperty('bottom');
  });

  it('has specific margin values', () => {
    expect(CHART.margins.left).toBe(45);
    expect(CHART.margins.right).toBe(10);
    expect(CHART.margins.top).toBe(10);
    expect(CHART.margins.bottom).toBe(25);
  });

  it('has yTickCount set to 4', () => {
    expect(CHART.yTickCount).toBe(4);
  });

  it('has xLabelCount set to 5', () => {
    expect(CHART.xLabelCount).toBe(5);
  });
});

// =============================================================================
// PROGRAM configuration
// =============================================================================

describe('PROGRAM config', () => {
  it('has minExercisesPerDay set to 3', () => {
    expect(PROGRAM.minExercisesPerDay).toBe(3);
  });

  it('has maxExercisesPerDay set to 6', () => {
    expect(PROGRAM.maxExercisesPerDay).toBe(6);
  });

  it('matches WORKOUT exercise constraints', () => {
    expect(PROGRAM.minExercisesPerDay).toBe(WORKOUT.minExercisesPerDay);
    expect(PROGRAM.maxExercisesPerDay).toBe(WORKOUT.maxExercisesPerDay);
  });
});
