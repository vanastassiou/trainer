// =============================================================================
// GENERIC UTILITIES
// =============================================================================

/**
 * Fetch JSON with error handling and default value fallback.
 * @param {string} url - URL to fetch
 * @param {*} defaultValue - Value to return on error
 * @returns {Promise<*>} Parsed JSON or default value
 */
export async function fetchJSON(url, defaultValue = null) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`Failed to load ${url}:`, err);
    return defaultValue;
  }
}

/**
 * Swap visibility between two elements (show one, hide other).
 * @param {HTMLElement} showEl - Element to show
 * @param {HTMLElement} hideEl - Element to hide
 */
export function swapVisibility(showEl, hideEl) {
  showEl.classList.remove('hidden');
  hideEl.classList.add('hidden');
}

/**
 * Render an array of items as HTML list items.
 * @param {string[]} items - Array of strings
 * @returns {string} HTML string of <li> elements
 */
export function renderListItems(items) {
  return items.map(item => `<li>${item}</li>`).join('');
}

/**
 * Format a snake_case or lowercase value as Title Case.
 * @param {string} value - Value to format
 * @returns {string} Formatted string
 */
export function formatLabel(value) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get today's date as ISO string (YYYY-MM-DD).
 * @returns {string} Today's date
 */
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parse a form input value to number or null if empty.
 * @param {string} value - Input value
 * @param {boolean} isFloat - Whether to parse as float
 * @returns {number|null} Parsed number or null
 */
export function parseInputValue(value, isFloat = false) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  return isFloat ? parseFloat(value) : parseInt(value, 10);
}

// =============================================================================
// UNIT CONVERSION
// =============================================================================

const CONVERSION_FACTORS = {
  kg_to_lb: 2.20462,
  cm_to_in: 0.393701,
  L_to_floz: 33.814
};

const CIRCUMFERENCE_FIELDS = [
  'neck', 'chest', 'waist', 'hips',
  'leftBiceps', 'rightBiceps',
  'leftQuadriceps', 'rightQuadriceps',
  'leftCalf', 'rightCalf'
];

/**
 * Convert metric value to imperial for display.
 * @param {number} value - Metric value
 * @param {string} metric - Metric name (weight, height, water, circumference fields)
 * @returns {number|object} Converted value (or {feet, inches} for height)
 */
export function toImperial(value, metric) {
  if (value == null) return null;

  if (metric === 'weight') {
    return value * CONVERSION_FACTORS.kg_to_lb;
  }

  if (metric === 'height') {
    const totalInches = value * CONVERSION_FACTORS.cm_to_in;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return { feet, inches };
  }

  if (metric === 'water') {
    return value * CONVERSION_FACTORS.L_to_floz;
  }

  if (CIRCUMFERENCE_FIELDS.includes(metric)) {
    return value * CONVERSION_FACTORS.cm_to_in;
  }

  return value;
}

/**
 * Convert imperial value to metric for storage.
 * @param {number|object} value - Imperial value (or {feet, inches} for height)
 * @param {string} metric - Metric name
 * @returns {number} Metric value
 */
export function toMetric(value, metric) {
  if (value == null) return null;

  if (metric === 'weight') {
    return value / CONVERSION_FACTORS.kg_to_lb;
  }

  if (metric === 'height') {
    if (typeof value === 'object' && value.feet != null) {
      const totalInches = (value.feet * 12) + (value.inches || 0);
      return totalInches / CONVERSION_FACTORS.cm_to_in;
    }
    return value / CONVERSION_FACTORS.cm_to_in;
  }

  if (metric === 'water') {
    return value / CONVERSION_FACTORS.L_to_floz;
  }

  if (CIRCUMFERENCE_FIELDS.includes(metric)) {
    return value / CONVERSION_FACTORS.cm_to_in;
  }

  return value;
}

/**
 * Format height for display.
 * @param {number} cmValue - Height in cm
 * @param {string} unitPreference - 'metric' or 'imperial'
 * @returns {string} Formatted height string
 */
export function formatHeight(cmValue, unitPreference) {
  if (cmValue == null) return '--';

  if (unitPreference === 'imperial') {
    const { feet, inches } = toImperial(cmValue, 'height');
    return `${feet}'${Math.round(inches)}"`;
  }
  return `${cmValue} cm`;
}

/**
 * Get display unit for a metric based on preference.
 * @param {string} metric - Metric name
 * @param {string} unitPreference - 'metric' or 'imperial'
 * @returns {string} Unit string
 */
export function getDisplayUnit(metric, unitPreference) {
  const metricUnits = {
    weight: 'kg',
    water: 'L',
    height: 'cm',
    neck: 'cm', chest: 'cm', waist: 'cm', hips: 'cm',
    leftBiceps: 'cm', rightBiceps: 'cm',
    leftQuadriceps: 'cm', rightQuadriceps: 'cm',
    leftCalf: 'cm', rightCalf: 'cm'
  };

  const imperialUnits = {
    weight: 'lbs',
    water: 'fl oz',
    height: 'ft/in',
    neck: 'in', chest: 'in', waist: 'in', hips: 'in',
    leftBiceps: 'in', rightBiceps: 'in',
    leftQuadriceps: 'in', rightQuadriceps: 'in',
    leftCalf: 'in', rightCalf: 'in'
  };

  if (unitPreference === 'imperial') {
    return imperialUnits[metric] || '';
  }
  return metricUnits[metric] || '';
}
