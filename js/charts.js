// =============================================================================
// CHART RENDERING (Native Canvas)
// =============================================================================

import { getTodayDate, toImperial, getDisplayUnit } from './utils.js';
import { state } from './state.js';
import { getRecentJournals } from './db.js';

const EMPTY_DATA_MESSAGE = 'Not enough data';

/**
 * Draw centered message on canvas (for empty states)
 */
function drawEmptyMessage(ctx, width, height, message, options = {}) {
  ctx.fillStyle = options.textColor || '#7a7590';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
}

/**
 * Subtract days from a date string
 * @param {string} dateStr - YYYY-MM-DD format
 * @param {number} days - Number of days to subtract
 * @returns {string} YYYY-MM-DD format
 */
function subtractDays(dateStr, days) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Circumference fields that live under body.circumferences
const CIRCUMFERENCE_FIELDS = [
  'neck', 'chest', 'waist', 'hips',
  'leftBiceps', 'rightBiceps',
  'leftQuadriceps', 'rightQuadriceps',
  'leftCalf', 'rightCalf'
];

/**
 * Get metric value from journal based on category and metric name
 * Handles nested structure for body.circumferences
 */
function getMetricValue(journal, category, metric) {
  if (category === 'body') {
    // Check if it's a circumference field
    if (CIRCUMFERENCE_FIELDS.includes(metric)) {
      return journal.body?.circumferences?.[metric];
    }
    return journal.body?.[metric];
  }
  return journal[category]?.[metric];
}

/**
 * Get chart data for a specific metric over time
 * @param {string} metric - Field name (e.g., 'weight', 'calories')
 * @param {string} category - 'body', 'daily', or 'workout'
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of {date, value} objects
 */
export async function getChartData(metric, category, days = 30) {
  const endDate = getTodayDate();
  const startDate = subtractDays(endDate, days);

  const allJournals = await getRecentJournals(true);
  const journals = allJournals.filter(j => j.date >= startDate && j.date <= endDate);

  return journals
    .filter(j => getMetricValue(j, category, metric) != null)
    .map(j => ({ date: j.date, value: getMetricValue(j, category, metric) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get workout volume data over time
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of {date, value} objects
 */
export async function getWorkoutVolumeData(days = 30) {
  const endDate = getTodayDate();
  const startDate = subtractDays(endDate, days);

  const allJournals = await getRecentJournals(true);
  const journals = allJournals.filter(j => j.date >= startDate && j.date <= endDate);

  return journals
    .filter(j => j.workout?.exercises?.length > 0)
    .map(j => ({
      date: j.date,
      value: calculateWorkoutVolume(j.workout)
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate total workout volume (reps x weight)
 * @param {Object} workout - Workout object with exercises
 * @returns {number} Total volume
 */
function calculateWorkoutVolume(workout) {
  if (!workout?.exercises) return 0;
  return workout.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((setTotal, set) => {
      return setTotal + (set.reps || 0) * (set.weight || 0);
    }, 0);
  }, 0);
}

/**
 * Render a line chart on a canvas element
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} data - Array of {date, value} objects
 * @param {Object} options - Chart options
 */
export function renderLineChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Handle high-DPI displays
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = 15;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (data.length < 2) {
    drawEmptyMessage(ctx, width, height, EMPTY_DATA_MESSAGE, options);
    return;
  }

  // Calculate bounds
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Draw grid lines (subtle)
  ctx.strokeStyle = options.gridColor || 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (i / 4) * (height - 2 * padding);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = options.lineColor || '#c4b5fd';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  data.forEach((point, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((point.value - min) / range) * (height - 2 * padding);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  // Draw dots at start and end
  const dotColor = options.dotColor || '#fbbf24';
  [0, data.length - 1].forEach(i => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((data[i].value - min) / range) * (height - 2 * padding);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
  });
}

/**
 * Render a bar chart on a canvas element
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} data - Array of {date, value} objects
 * @param {Object} options - Chart options
 */
export function renderBarChart(canvas, data, options = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Handle high-DPI displays
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = 15;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (data.length === 0) {
    drawEmptyMessage(ctx, width, height, EMPTY_DATA_MESSAGE, options);
    return;
  }

  // Calculate bounds
  const values = data.map(d => d.value);
  const max = Math.max(...values);

  // Bar settings
  const barWidth = Math.min(20, (width - 2 * padding) / data.length - 4);
  const gap = (width - 2 * padding - barWidth * data.length) / (data.length + 1);

  // Draw bars
  ctx.fillStyle = options.barColor || '#c4b5fd';
  data.forEach((point, i) => {
    const x = padding + gap + i * (barWidth + gap);
    const barHeight = (point.value / max) * (height - 2 * padding);
    const y = height - padding - barHeight;

    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 3);
    ctx.fill();
  });
}

/**
 * Calculate summary statistics from chart data
 * @param {Array} data - Array of {date, value} objects
 * @returns {Object|null} Summary with start, end, change, changePercent
 */
export function getChartSummary(data) {
  if (data.length < 2) return null;

  const start = data[0].value;
  const end = data[data.length - 1].value;
  const change = end - start;
  const changePercent = start !== 0 ? (change / start) * 100 : 0;

  return { start, end, change, changePercent };
}

// Fields that need unit conversion
const CONVERTIBLE_FIELDS = [
  'weight', 'water',
  'neck', 'chest', 'waist', 'hips',
  'leftBiceps', 'rightBiceps',
  'leftQuadriceps', 'rightQuadriceps',
  'leftCalf', 'rightCalf'
];

/**
 * Format a chart summary as HTML
 * @param {Object} summary - Summary from getChartSummary
 * @param {string} unit - Unit label (e.g., 'kg', 'kcal')
 * @param {string} metric - Optional metric name for unit conversion
 * @returns {string} HTML string
 */
export function formatSummaryHTML(summary, unit = '', metric = null) {
  if (!summary) return '';

  let { start, end, change } = summary;
  let displayUnit = unit;

  // Convert if imperial and metric is convertible
  if (metric && state.unitPreference === 'imperial' && CONVERTIBLE_FIELDS.includes(metric)) {
    start = toImperial(start, metric);
    end = toImperial(end, metric);
    change = toImperial(change, metric);
    displayUnit = getDisplayUnit(metric, 'imperial');
  }

  const sign = change >= 0 ? '+' : '';
  const changeClass = change >= 0 ? 'change-positive' : 'change-negative';

  return `
    <span>${start.toFixed(1)}${displayUnit}</span>
    <span> → </span>
    <span>${end.toFixed(1)}${displayUnit}</span>
    <span class="${changeClass}"> (${sign}${change.toFixed(1)})</span>
  `;
}
