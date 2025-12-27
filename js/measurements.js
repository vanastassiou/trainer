// =============================================================================
// MEASUREMENTS MODULE
// =============================================================================
// Handles body measurements and daily tracking forms.

import { state } from './state.js';
import { parseInputValue, toImperial, toMetric, getDisplayUnit } from './utils.js';
import {
  getJournalForDate,
  saveJournalForDate,
  getRecentJournals
} from './db.js';
import { getChartData, renderLineChart, getChartSummary, formatSummaryHTML } from './charts.js';

// =============================================================================
// CONSTANTS
// =============================================================================

// Body measurement fields (top-level in body object)
export const BODY_FIELDS = ['bodyFat'];

// Circumference fields (nested in body.circumferences)
export const CIRCUMFERENCE_FIELDS = [
  'neck', 'chest', 'waist', 'hips',
  'leftBiceps', 'rightBiceps',
  'leftQuadriceps', 'rightQuadriceps',
  'leftCalf', 'rightCalf'
];

// All body-related fields for display/labels
export const BODY_LABELS = {
  weight: 'Weight',
  bodyFat: 'Body fat',
  restingHR: 'Resting HR',
  neck: 'Neck',
  chest: 'Chest',
  leftBiceps: 'L Biceps',
  rightBiceps: 'R Biceps',
  waist: 'Waist',
  hips: 'Hips',
  leftQuadriceps: 'L Quad',
  rightQuadriceps: 'R Quad',
  leftCalf: 'L Calf',
  rightCalf: 'R Calf'
};

// Daily tracking fields
export const DAILY_FIELDS = ['weight', 'restingHR', 'calories', 'protein', 'fibre', 'water', 'steps', 'sleep', 'recovery'];

export const DAILY_LABELS = {
  weight: 'Weight',
  restingHR: 'Resting HR',
  calories: 'Calories',
  protein: 'Protein',
  fibre: 'Fibre',
  water: 'Water',
  steps: 'Steps',
  sleep: 'Sleep',
  recovery: 'Recovery'
};

// Form field configurations for HTML generation
export const DAILY_FIELD_CONFIG = [
  { id: 'weight', label: 'Weight', unit: 'kg', inputmode: 'decimal', step: '0.1', group: 'body' },
  { id: 'restingHR', label: 'Resting HR', unit: 'bpm', inputmode: 'numeric', min: '20', max: '200', group: 'body' },
  { id: 'calories', label: 'Calories', unit: 'kcal', inputmode: 'numeric', group: 'nutrition' },
  { id: 'protein', label: 'Protein', unit: 'g', inputmode: 'decimal', step: '0.1', group: 'nutrition' },
  { id: 'fibre', label: 'Fibre', unit: 'g', inputmode: 'decimal', step: '0.1', group: 'nutrition' },
  { id: 'water', label: 'Water', unit: 'L', inputmode: 'decimal', step: '0.1', group: 'nutrition' },
  { id: 'steps', label: 'Steps', unit: '', inputmode: 'numeric', group: 'activity' },
  { id: 'sleep', label: 'Sleep', unit: 'hrs', inputmode: 'decimal', step: '0.25', max: '24', group: 'activity' },
  { id: 'recovery', label: 'Recovery', unit: '/10', inputmode: 'numeric', min: '1', max: '10', group: 'activity' }
];

const DAILY_GROUP_LABELS = {
  body: 'Body',
  nutrition: 'Nutrition',
  activity: 'Activity & recovery'
};

export const MEASUREMENT_FIELD_CONFIG = [
  { id: 'bodyFat', label: 'Body fat', type: 'full', inputmode: 'decimal', step: '0.1', max: '100' },
  { id: 'neck', label: 'Neck', pair: 'torso-upper', inputmode: 'decimal', step: '0.1' },
  { id: 'chest', label: 'Chest', pair: 'torso-upper', inputmode: 'decimal', step: '0.1' },
  { id: 'leftBiceps', label: 'L Biceps', pair: 'biceps', inputmode: 'decimal', step: '0.1' },
  { id: 'rightBiceps', label: 'R Biceps', pair: 'biceps', inputmode: 'decimal', step: '0.1' },
  { id: 'hips', label: 'Hips', pair: 'torso-lower', inputmode: 'decimal', step: '0.1' },
  { id: 'waist', label: 'Waist', pair: 'torso-lower', inputmode: 'decimal', step: '0.1' },
  { id: 'leftQuadriceps', label: 'L Quad', pair: 'quads', inputmode: 'decimal', step: '0.1' },
  { id: 'rightQuadriceps', label: 'R Quad', pair: 'quads', inputmode: 'decimal', step: '0.1' },
  { id: 'leftCalf', label: 'L Calf', pair: 'calves', inputmode: 'decimal', step: '0.1' },
  { id: 'rightCalf', label: 'R Calf', pair: 'calves', inputmode: 'decimal', step: '0.1' }
];

// Metric units for charts
export const METRIC_UNITS = {
  // Daily metrics
  calories: 'kcal',
  protein: 'g',
  fibre: 'g',
  water: 'L',
  steps: '',
  sleep: 'hrs',
  recovery: '/10',
  // Body metrics
  weight: 'kg',
  bodyFat: '%',
  restingHR: 'bpm',
  // Circumferences
  neck: 'cm',
  chest: 'cm',
  waist: 'cm',
  hips: 'cm',
  leftBiceps: 'cm',
  rightBiceps: 'cm',
  leftQuadriceps: 'cm',
  rightQuadriceps: 'cm',
  leftCalf: 'cm',
  rightCalf: 'cm'
};

// Fields that need unit conversion (weight, water, circumferences)
const CONVERTIBLE_FIELDS = ['weight', 'water', ...CIRCUMFERENCE_FIELDS];

// Get unit for a metric based on current preference
export function getUnitForDisplay(metric) {
  return getDisplayUnit(metric, state.unitPreference) || METRIC_UNITS[metric] || '';
}

// Update unit labels in forms based on current preference
export function updateFormUnits() {
  const unitPreference = state.unitPreference;

  // Fields that need unit updates
  const fieldsToUpdate = ['weight', 'water', ...CIRCUMFERENCE_FIELDS];

  fieldsToUpdate.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    if (!input) return;

    const label = input.closest('.data-row')?.querySelector('label');
    if (!label) return;

    const newUnit = getDisplayUnit(fieldId, unitPreference);
    const fieldConfig = [...DAILY_FIELD_CONFIG, ...MEASUREMENT_FIELD_CONFIG].find(f => f.id === fieldId);
    const fieldLabel = fieldConfig?.label || BODY_LABELS[fieldId] || fieldId;

    // Find and preserve the tooltip button if present
    const tooltipBtn = label.querySelector('.term-info-btn');

    // Update label text (preserve tooltip button)
    if (tooltipBtn) {
      label.innerHTML = `${fieldLabel} (${newUnit})`;
      label.appendChild(tooltipBtn);
    } else {
      label.textContent = `${fieldLabel} (${newUnit})`;
    }
  });
}

// =============================================================================
// FORM UTILITIES
// =============================================================================

// Load field values from data object into form inputs
// Converts metric values to imperial for display if needed
export function loadFieldsToForm(fields, data, getter = (d, f) => d?.[f]) {
  const unitPreference = state.unitPreference;

  fields.forEach(field => {
    const input = document.getElementById(field);
    if (input) {
      let value = getter(data, field);

      // Convert for display if imperial and convertible
      if (value != null && unitPreference === 'imperial' && CONVERTIBLE_FIELDS.includes(field)) {
        value = toImperial(value, field);
        if (typeof value === 'number') {
          value = value.toFixed(1);
        }
      }

      input.value = value ?? '';
    }
  });
}

// Collect field values from form inputs into data object
// Converts imperial values to metric for storage if needed
export function collectFieldsFromForm(fields, transform = parseFloat) {
  const unitPreference = state.unitPreference;
  const data = {};

  fields.forEach(field => {
    const input = document.getElementById(field);
    const value = input?.value;
    if (value !== '' && value !== null && value !== undefined) {
      let numValue = transform(value);

      // Convert to metric for storage if imperial
      if (unitPreference === 'imperial' && CONVERTIBLE_FIELDS.includes(field)) {
        numValue = toMetric(numValue, field);
      }

      data[field] = numValue;
    }
  });
  return data;
}

// Generate a single form row input element
function createInputAttrs(field) {
  const attrs = [
    `type="number"`,
    `id="${field.id}"`,
    `name="${field.id}"`,
    `inputmode="${field.inputmode}"`,
    `min="${field.min || '0'}"`
  ];
  if (field.step) attrs.push(`step="${field.step}"`);
  if (field.max) attrs.push(`max="${field.max}"`);
  return attrs.join(' ');
}

// Generate daily/nutrition form rows with grouping
export function generateDailyFormRows(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Group fields by their group property
  const groups = {};
  for (const field of DAILY_FIELD_CONFIG) {
    const group = field.group || 'other';
    if (!groups[group]) groups[group] = [];
    groups[group].push(field);
  }

  let html = '';
  for (const [groupId, fields] of Object.entries(groups)) {
    const label = DAILY_GROUP_LABELS[groupId] || groupId;
    html += `<div class="label-muted field-group-label">${label}</div>`;
    html += `<div class="field-group">`;
    html += fields.map(field => {
      const unitDisplay = field.unit ? ` (${field.unit})` : '';
      return `
      <div class="data-row row row--gap-md">
        <label for="${field.id}">${field.label}${unitDisplay}<button type="button" class="term-info-btn" data-term="${field.id}">?</button></label>
        <input ${createInputAttrs(field)}>
      </div>
    `;
    }).join('');
    html += `</div>`;
  }

  container.insertAdjacentHTML('afterbegin', html);
}

// Generate measurement form rows with pair grouping
export function generateMeasurementFormRows(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '';
  const processedPairs = new Set();

  for (const field of MEASUREMENT_FIELD_CONFIG) {
    const unit = METRIC_UNITS[field.id] || '';
    const unitDisplay = unit ? ` (${unit})` : '';

    if (field.pair) {
      if (processedPairs.has(field.pair)) continue;
      processedPairs.add(field.pair);

      // Find both fields in this pair
      const pairFields = MEASUREMENT_FIELD_CONFIG.filter(f => f.pair === field.pair);
      html += `
        <div class="measurement-pair">
          ${pairFields.map(f => {
            const pairUnit = METRIC_UNITS[f.id] || '';
            const pairUnitDisplay = pairUnit ? ` (${pairUnit})` : '';
            return `
            <div class="data-row row">
              <label for="${f.id}">${f.label}${pairUnitDisplay}</label>
              <input ${createInputAttrs(f)}>
            </div>
          `;
          }).join('')}
        </div>
      `;
    } else {
      html += `
        <div class="data-row row">
          <label for="${field.id}">${field.label}${unitDisplay}</label>
          <input ${createInputAttrs(field)}>
        </div>
        <div class="grid-spacer"></div>
      `;
    }
  }

  container.insertAdjacentHTML('afterbegin', html);
}

// =============================================================================
// FORM INITIALIZATION
// =============================================================================

export function initMeasurementsForm(updateChart) {
  const form = document.getElementById('measurements-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect form data using utilities
    const body = collectFieldsFromForm(BODY_FIELDS);
    const circumferences = collectFieldsFromForm(CIRCUMFERENCE_FIELDS);

    if (Object.keys(circumferences).length > 0) {
      body.circumferences = circumferences;
    }

    const journal = await getJournalForDate(state.selectedDate);
    journal.body = body;
    await saveJournalForDate(journal);
    if (updateChart) await updateChart();
  });
}

export function initDailyForm(updateChart) {
  const form = document.getElementById('daily-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectFieldsFromForm(DAILY_FIELDS);

    // Also collect notes
    const notesInput = document.getElementById('notes');
    const notes = notesInput?.value?.trim() || null;

    const journal = await getJournalForDate(state.selectedDate);
    journal.daily = data;
    journal.notes = notes;
    await saveJournalForDate(journal);
    if (updateChart) await updateChart();
  });
}

// =============================================================================
// DATA LOADING
// =============================================================================

export function loadMeasurementsData(journal) {
  loadFieldsToForm(BODY_FIELDS, journal.body);
  loadFieldsToForm(CIRCUMFERENCE_FIELDS, journal.body, (d, f) => d?.circumferences?.[f]);
}

// Fields that moved from body to daily (for backwards compatibility)
const MIGRATED_TO_DAILY = ['weight', 'restingHR'];

export function loadDailyData(journal) {
  // Load daily fields, with fallback to body for migrated fields
  loadFieldsToForm(DAILY_FIELDS, journal.daily, (d, f) => {
    const value = d?.[f];
    if (value != null) return value;
    // Check body for migrated fields (backwards compatibility)
    if (MIGRATED_TO_DAILY.includes(f)) {
      return journal.body?.[f];
    }
    return value;
  });

  const notesInput = document.getElementById('notes');
  if (notesInput) {
    notesInput.value = journal.notes ?? '';
  }
}
