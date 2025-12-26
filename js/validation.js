// =============================================================================
// VALIDATION LOGIC
// =============================================================================

import { state } from './state.js';
import { toMetric } from './utils.js';

/**
 * Validate a workout program.
 * @param {string} name - Program name
 * @param {Object[]} days - Array of day objects with exercises
 * @returns {Object} Validation result with isValid and error message
 */
export function validateProgram(name, days) {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Please enter a program name' };
  }

  if (!days || days.length === 0) {
    return { isValid: false, error: 'Please add at least one day' };
  }

  const hasEmptyDay = days.some(day => !day.exercises || day.exercises.length === 0);
  if (hasEmptyDay) {
    return { isValid: false, error: 'Each day must have at least one exercise' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate measurement data.
 * @param {Object} data - Measurement data object
 * @param {string[]} fields - Expected field names
 * @returns {Object} Validation result with isValid and parsed data
 */
export function validateMeasurements(data, fields) {
  const parsed = {};
  let hasValue = false;

  for (const field of fields) {
    const value = data[field];
    if (value !== '' && value !== null && value !== undefined) {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        return {
          isValid: false,
          error: `Invalid value for ${field}`,
          data: null
        };
      }
      parsed[field] = num;
      hasValue = true;
    }
  }

  return { isValid: true, error: null, data: parsed };
}

/**
 * Check if workout form has unsaved data.
 * @param {HTMLElement} container - Exercise cards container
 * @returns {boolean} True if any inputs have values
 */
export function hasUnsavedWorkoutData(container) {
  const cards = container.querySelectorAll('.exercise-card');

  for (const card of cards) {
    const inputs = card.querySelectorAll('.reps-input, .weight-input, .rpe-input');
    for (const input of inputs) {
      if (input.value.trim() !== '') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Collect workout data from exercise cards.
 * @param {HTMLElement} container - Exercise cards container
 * @returns {Object[]} Array of exercise objects with sets
 */
export function collectWorkoutData(container) {
  const exercises = [];
  const cards = container.querySelectorAll('.exercise-card');
  const unitPreference = state.unitPreference;

  cards.forEach(card => {
    const name = card.querySelector('.exercise-name').value.trim();
    const sets = [];

    card.querySelectorAll('.set-row:not(.set-header)').forEach(row => {
      const reps = row.querySelector('.reps-input')?.value;
      const weightStr = row.querySelector('.weight-input')?.value;
      const rpe = row.querySelector('.rpe-input')?.value;

      let weight = weightStr !== '' ? parseFloat(weightStr) : null;

      // Convert weight to metric for storage if imperial
      if (weight !== null && unitPreference === 'imperial') {
        weight = toMetric(weight, 'weight');
      }

      sets.push({
        reps: reps !== '' ? parseInt(reps, 10) : null,
        weight,
        rpe: rpe !== '' ? parseFloat(rpe) : null
      });
    });

    if (name) {
      exercises.push({ name, sets });
    }
  });

  return exercises;
}

/**
 * Collect program days data from container.
 * @param {HTMLElement} container - Program days container
 * @returns {Object[]} Array of day objects with exercises
 */
export function collectProgramDays(container) {
  const days = [];
  container.querySelectorAll('.program-day-card').forEach(card => {
    const exercises = [];
    card.querySelectorAll('.exercise-tag span').forEach(span => {
      exercises.push(span.textContent);
    });
    days.push({ exercises });
  });
  return days;
}
