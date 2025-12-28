// =============================================================================
// GENERIC UTILITIES
// =============================================================================

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (str == null) return '';
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(str).replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * Standardized error handler with consistent logging.
 * @param {Error} error - Error object
 * @param {string} context - Description of what operation failed
 * @param {*} fallbackValue - Value to return on error
 * @returns {*} The fallback value
 */
export function handleError(error, context, fallbackValue = null) {
  console.error(`[Error] ${context}:`, error.message || error);
  return fallbackValue;
}

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
    return handleError(err, `Failed to load ${url}`, defaultValue);
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
 * Format authors array as citation string (e.g., "Smith et al." or "Smith").
 * @param {string[]} authors - Array of author names (e.g., ["Smith BJ", "Jones A"])
 * @returns {string} Citation format author string
 */
export function getCitationAuthor(authors) {
  if (!authors?.length) return '';
  // Extract last name (last word before any suffix like Jr, Sr, III)
  const firstAuthor = authors[0];
  const lastName = firstAuthor.split(/\s+/)[0];
  return authors.length > 1 ? `${lastName} et al.` : lastName;
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

// =============================================================================
// AGE AND VOLUME UTILITIES
// =============================================================================

/**
 * Calculate age from a birth date string.
 * @param {string} birthDate - ISO date string (YYYY-MM-DD)
 * @returns {number|null} Age in years, or null if invalid
 */
export function getAgeFromBirthDate(birthDate) {
  if (!birthDate) return null;

  const birth = new Date(birthDate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Get volume recommendations based on age.
 * Research indicates older adults (60+) need higher maintenance volume.
 * @param {number|null} age - Age in years
 * @returns {object} Volume recommendations
 */
export function getVolumeRecommendations(age) {
  // Default recommendations (for unknown age or young adults)
  const defaultRecs = {
    maintenance: { min: 3, max: 6, description: '3-6 sets per muscle per week' },
    growth: { min: 10, max: 20, description: '10-20 sets per muscle per week' },
    frequency: { min: 1, max: 2, description: '1-2 sessions per muscle per week' },
    perSession: { max: 11, description: 'Up to ~11 sets per muscle per session' },
    ageGroup: 'adult'
  };

  if (age == null) {
    return defaultRecs;
  }

  // Older adults (60+) need more volume to maintain
  if (age >= 60) {
    return {
      maintenance: { min: 6, max: 10, description: '6-10 sets per muscle per week' },
      growth: { min: 12, max: 20, description: '12-20 sets per muscle per week' },
      frequency: { min: 2, max: 3, description: '2-3 sessions per muscle per week' },
      perSession: { max: 10, description: 'Up to ~10 sets per muscle per session' },
      ageGroup: 'older-adult'
    };
  }

  // Young adults and middle-aged
  return defaultRecs;
}
