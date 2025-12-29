import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  escapeHtml,
  handleError,
  fetchJSON,
  renderListItems,
  formatLabel,
  getCitationAuthor,
  getTodayDate,
  parseInputValue,
  calculateAverage,
  toImperial,
  toMetric,
  convertForDisplay,
  convertForStorage,
  formatHeight,
  getDisplayUnit,
  getMetricValue,
  getAgeFromBirthDate,
  buildExerciseTagsHTML,
  getVolumeRecommendations,
  CIRCUMFERENCE_FIELDS,
  CONVERTIBLE_FIELDS,
  MIGRATED_TO_DAILY
} from '../../js/utils.js';

// =============================================================================
// escapeHtml
// =============================================================================

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("It's")).toBe('It&#39;s');
  });

  it('handles null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts numbers to strings', () => {
    expect(escapeHtml(123)).toBe('123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

// =============================================================================
// handleError
// =============================================================================

describe('handleError', () => {
  it('logs error and returns fallback value', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');
    const result = handleError(error, 'Test context', 'fallback');

    expect(result).toBe('fallback');
    expect(consoleSpy).toHaveBeenCalledWith('[Error] Test context:', 'Test error');
    consoleSpy.mockRestore();
  });

  it('returns null as default fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = handleError(new Error('Test'), 'context');
    expect(result).toBeNull();
  });
});

// =============================================================================
// fetchJSON
// =============================================================================

describe('fetchJSON', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    const mockData = { exercises: [] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    });

    const result = await fetchJSON('/data/test.json');
    expect(result).toEqual(mockData);
  });

  it('returns default value on HTTP error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const result = await fetchJSON('/data/missing.json', []);
    expect(result).toEqual([]);
  });

  it('returns default value on network error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchJSON('/data/test.json', { default: true });
    expect(result).toEqual({ default: true });
  });
});

// =============================================================================
// renderListItems
// =============================================================================

describe('renderListItems', () => {
  it('renders array as list items', () => {
    const result = renderListItems(['Item 1', 'Item 2']);
    expect(result).toBe('<li>Item 1</li><li>Item 2</li>');
  });

  it('handles empty array', () => {
    expect(renderListItems([])).toBe('');
  });
});

// =============================================================================
// formatLabel
// =============================================================================

describe('formatLabel', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatLabel('muscle_group')).toBe('Muscle Group');
  });

  it('capitalizes single words', () => {
    expect(formatLabel('beginner')).toBe('Beginner');
  });

  it('handles multiple underscores', () => {
    expect(formatLabel('left_biceps_circumference')).toBe('Left Biceps Circumference');
  });
});

// =============================================================================
// getCitationAuthor
// =============================================================================

describe('getCitationAuthor', () => {
  it('returns single author last name', () => {
    expect(getCitationAuthor(['Smith BJ'])).toBe('Smith');
  });

  it('returns "et al." for multiple authors', () => {
    expect(getCitationAuthor(['Smith BJ', 'Jones A'])).toBe('Smith et al.');
  });

  it('handles empty array', () => {
    expect(getCitationAuthor([])).toBe('');
  });

  it('handles undefined', () => {
    expect(getCitationAuthor(undefined)).toBe('');
  });

  it('handles null', () => {
    expect(getCitationAuthor(null)).toBe('');
  });
});

// =============================================================================
// getTodayDate
// =============================================================================

describe('getTodayDate', () => {
  it('returns ISO date string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T15:30:00Z'));
    expect(getTodayDate()).toBe('2025-06-15');
    vi.useRealTimers();
  });
});

// =============================================================================
// parseInputValue
// =============================================================================

describe('parseInputValue', () => {
  it('parses integers by default', () => {
    expect(parseInputValue('10')).toBe(10);
    expect(parseInputValue('10.5')).toBe(10);
  });

  it('parses floats when specified', () => {
    expect(parseInputValue('10.5', true)).toBe(10.5);
  });

  it('returns null for empty string', () => {
    expect(parseInputValue('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseInputValue(null)).toBeNull();
    expect(parseInputValue(undefined)).toBeNull();
  });
});

// =============================================================================
// calculateAverage
// =============================================================================

describe('calculateAverage', () => {
  it('calculates average of numbers', () => {
    expect(calculateAverage([10, 20, 30])).toBe(20);
  });

  it('ignores null values', () => {
    expect(calculateAverage([10, null, 30])).toBe(20);
  });

  it('returns null for empty array', () => {
    expect(calculateAverage([])).toBeNull();
  });

  it('returns null for all-null array', () => {
    expect(calculateAverage([null, null])).toBeNull();
  });

  it('handles single value', () => {
    expect(calculateAverage([42])).toBe(42);
  });
});

// =============================================================================
// toImperial
// =============================================================================

describe('toImperial', () => {
  it('converts kg to lbs for weight', () => {
    const result = toImperial(100, 'weight');
    expect(result).toBeCloseTo(220.462, 2);
  });

  it('converts cm to feet/inches for height', () => {
    const result = toImperial(180, 'height');
    expect(result.feet).toBe(5);
    expect(result.inches).toBeCloseTo(10.87, 1);
  });

  it('converts L to fl oz for water', () => {
    expect(toImperial(1, 'water')).toBeCloseTo(33.814, 2);
  });

  it('converts cm to inches for circumferences', () => {
    expect(toImperial(100, 'waist')).toBeCloseTo(39.37, 1);
    expect(toImperial(25, 'neck')).toBeCloseTo(9.84, 1);
  });

  it('returns null for null input', () => {
    expect(toImperial(null, 'weight')).toBeNull();
  });

  it('returns value unchanged for unknown metrics', () => {
    expect(toImperial(100, 'calories')).toBe(100);
  });
});

// =============================================================================
// toMetric
// =============================================================================

describe('toMetric', () => {
  it('converts lbs to kg for weight', () => {
    expect(toMetric(220.462, 'weight')).toBeCloseTo(100, 1);
  });

  it('converts feet/inches object to cm for height', () => {
    expect(toMetric({ feet: 6, inches: 0 }, 'height')).toBeCloseTo(182.88, 1);
  });

  it('handles numeric height input', () => {
    expect(toMetric(72, 'height')).toBeCloseTo(182.88, 1);
  });

  it('converts fl oz to L for water', () => {
    expect(toMetric(33.814, 'water')).toBeCloseTo(1, 2);
  });

  it('converts inches to cm for circumferences', () => {
    expect(toMetric(39.37, 'waist')).toBeCloseTo(100, 1);
  });

  it('returns null for null input', () => {
    expect(toMetric(null, 'weight')).toBeNull();
  });

  it('returns value unchanged for unknown metrics', () => {
    expect(toMetric(2000, 'calories')).toBe(2000);
  });
});

// =============================================================================
// convertForDisplay
// =============================================================================

describe('convertForDisplay', () => {
  it('returns value unchanged for metric preference', () => {
    expect(convertForDisplay(75, 'weight', 'metric')).toBe(75);
  });

  it('converts and formats for imperial preference', () => {
    const result = convertForDisplay(75, 'weight', 'imperial');
    expect(parseFloat(result)).toBeCloseTo(165.35, 0);
  });

  it('returns null for null input', () => {
    expect(convertForDisplay(null, 'weight', 'imperial')).toBeNull();
  });

  it('does not convert non-convertible fields', () => {
    expect(convertForDisplay(2000, 'calories', 'imperial')).toBe(2000);
  });
});

// =============================================================================
// convertForStorage
// =============================================================================

describe('convertForStorage', () => {
  it('returns value unchanged for metric preference', () => {
    expect(convertForStorage(75, 'weight', 'metric')).toBe(75);
  });

  it('converts imperial to metric for storage', () => {
    const result = convertForStorage(165.35, 'weight', 'imperial');
    expect(result).toBeCloseTo(75, 0);
  });

  it('returns null for null input', () => {
    expect(convertForStorage(null, 'weight', 'imperial')).toBeNull();
  });
});

// =============================================================================
// formatHeight
// =============================================================================

describe('formatHeight', () => {
  it('formats metric height', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm');
  });

  it('formats imperial height', () => {
    expect(formatHeight(180, 'imperial')).toBe("5'11\"");
  });

  it('returns -- for null', () => {
    expect(formatHeight(null, 'metric')).toBe('--');
  });
});

// =============================================================================
// getDisplayUnit
// =============================================================================

describe('getDisplayUnit', () => {
  it('returns metric units by default', () => {
    expect(getDisplayUnit('weight', 'metric')).toBe('kg');
    expect(getDisplayUnit('water', 'metric')).toBe('L');
    expect(getDisplayUnit('waist', 'metric')).toBe('cm');
  });

  it('returns imperial units when specified', () => {
    expect(getDisplayUnit('weight', 'imperial')).toBe('lbs');
    expect(getDisplayUnit('water', 'imperial')).toBe('fl oz');
    expect(getDisplayUnit('waist', 'imperial')).toBe('in');
  });

  it('returns empty string for unknown metric', () => {
    expect(getDisplayUnit('calories', 'metric')).toBe('');
    expect(getDisplayUnit('unknown', 'imperial')).toBe('');
  });
});

// =============================================================================
// getMetricValue
// =============================================================================

describe('getMetricValue', () => {
  const journal = {
    body: {
      bodyFat: 15,
      circumferences: { waist: 80, chest: 100 }
    },
    daily: { weight: 75, calories: 2000 }
  };

  it('gets body metrics', () => {
    expect(getMetricValue(journal, 'body', 'bodyFat')).toBe(15);
  });

  it('gets circumference metrics', () => {
    expect(getMetricValue(journal, 'body', 'waist')).toBe(80);
    expect(getMetricValue(journal, 'body', 'chest')).toBe(100);
  });

  it('gets daily metrics', () => {
    expect(getMetricValue(journal, 'daily', 'calories')).toBe(2000);
    expect(getMetricValue(journal, 'daily', 'weight')).toBe(75);
  });

  it('handles migrated fields (weight from body to daily)', () => {
    const oldJournal = { body: { weight: 70 }, daily: {} };
    expect(getMetricValue(oldJournal, 'daily', 'weight')).toBe(70);
  });

  it('returns undefined for missing values', () => {
    expect(getMetricValue(journal, 'body', 'unknown')).toBeUndefined();
  });
});

// =============================================================================
// getAgeFromBirthDate
// =============================================================================

describe('getAgeFromBirthDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates age for past birthday this year', () => {
    expect(getAgeFromBirthDate('1990-01-15')).toBe(35);
  });

  it('calculates age for birthday today', () => {
    expect(getAgeFromBirthDate('1990-06-15')).toBe(35);
  });

  it('calculates age for upcoming birthday this year', () => {
    expect(getAgeFromBirthDate('1990-12-15')).toBe(34);
  });

  it('returns null for null input', () => {
    expect(getAgeFromBirthDate(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getAgeFromBirthDate('')).toBeNull();
  });
});

// =============================================================================
// buildExerciseTagsHTML
// =============================================================================

describe('buildExerciseTagsHTML', () => {
  it('builds tags for exercise with all fields', () => {
    const exercise = {
      muscle_group: 'chest',
      movement_pattern: 'push',
      equipment: 'barbell',
      difficulty: 'intermediate'
    };
    const tags = buildExerciseTagsHTML(exercise);
    expect(tags).toHaveLength(4);
    expect(tags[0]).toContain('Chest');
    expect(tags[1]).toContain('Push');
    expect(tags[2]).toContain('Barbell');
    expect(tags[3]).toContain('Intermediate');
  });

  it('handles exercise with missing fields', () => {
    const exercise = { muscle_group: 'back' };
    const tags = buildExerciseTagsHTML(exercise);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('Back');
  });

  it('handles null/undefined', () => {
    expect(buildExerciseTagsHTML(null)).toEqual([]);
    expect(buildExerciseTagsHTML(undefined)).toEqual([]);
  });
});

// =============================================================================
// getVolumeRecommendations
// =============================================================================

describe('getVolumeRecommendations', () => {
  it('returns default recommendations for young adults', () => {
    const recs = getVolumeRecommendations(30);
    expect(recs.maintenance.min).toBe(3);
    expect(recs.maintenance.max).toBe(6);
    expect(recs.ageGroup).toBe('adult');
  });

  it('returns higher volume for older adults (60+)', () => {
    const recs = getVolumeRecommendations(65);
    expect(recs.maintenance.min).toBe(6);
    expect(recs.maintenance.max).toBe(10);
    expect(recs.ageGroup).toBe('older-adult');
  });

  it('returns default for age exactly 60', () => {
    const recs = getVolumeRecommendations(60);
    expect(recs.ageGroup).toBe('older-adult');
  });

  it('returns default for null age', () => {
    const recs = getVolumeRecommendations(null);
    expect(recs.ageGroup).toBe('adult');
  });
});

// =============================================================================
// Constants
// =============================================================================

describe('Constants', () => {
  it('exports CIRCUMFERENCE_FIELDS', () => {
    expect(CIRCUMFERENCE_FIELDS).toContain('waist');
    expect(CIRCUMFERENCE_FIELDS).toContain('chest');
    expect(CIRCUMFERENCE_FIELDS).toContain('leftBiceps');
    expect(CIRCUMFERENCE_FIELDS).toHaveLength(10);
  });

  it('exports CONVERTIBLE_FIELDS', () => {
    expect(CONVERTIBLE_FIELDS).toContain('weight');
    expect(CONVERTIBLE_FIELDS).toContain('water');
    expect(CONVERTIBLE_FIELDS).toContain('waist');
  });

  it('exports MIGRATED_TO_DAILY', () => {
    expect(MIGRATED_TO_DAILY).toContain('weight');
    expect(MIGRATED_TO_DAILY).toContain('restingHR');
  });
});
