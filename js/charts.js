// =============================================================================
// CHART RENDERING (Native Canvas)
// =============================================================================

import { getTodayDate, toImperial, getDisplayUnit, CIRCUMFERENCE_FIELDS, CONVERTIBLE_FIELDS, getMetricValue } from './utils.js';
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

/**
 * Get chart data for a specific metric over time
 * @param {string} metric - Field name (e.g., 'weight', 'calories')
 * @param {string} category - 'body', 'daily', or 'workout'
 * @param {number|null} days - Number of days to look back, or null for all time
 * @param {Array|null} cachedJournals - Optional pre-fetched journals to avoid redundant DB calls
 * @returns {Promise<Array>} Array of {date, value} objects
 */
export async function getChartData(metric, category, days = 28, cachedJournals = null) {
  const endDate = getTodayDate();
  const allJournals = cachedJournals || await getRecentJournals(true);

  let journals;
  if (days === null) {
    // All time
    journals = allJournals;
  } else {
    const startDate = subtractDays(endDate, days);
    journals = allJournals.filter(j => j.date >= startDate && j.date <= endDate);
  }

  return journals
    .filter(j => getMetricValue(j, category, metric) != null)
    .map(j => ({ date: j.date, value: getMetricValue(j, category, metric) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get unique exercises from workouts in a time period
 * @param {number} days - Number of days to look back
 * @param {Array|null} cachedJournals - Optional pre-fetched journals to avoid redundant DB calls
 * @returns {Promise<Array>} Sorted array of {id, name} objects
 */
export async function getExercisesInPeriod(days = 30, cachedJournals = null) {
  const endDate = getTodayDate();
  const startDate = subtractDays(endDate, days);

  const allJournals = cachedJournals || await getRecentJournals(true);
  const journals = allJournals.filter(j => j.date >= startDate && j.date <= endDate);

  const exercisesMap = new Map();
  for (const journal of journals) {
    if (journal.workout?.exercises) {
      for (const ex of journal.workout.exercises) {
        if (ex.id && !exercisesMap.has(ex.id)) {
          exercisesMap.set(ex.id, { id: ex.id, name: ex.name || ex.id });
        }
      }
    }
  }

  return [...exercisesMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get average weight per rep for a specific exercise over time
 * @param {string} exerciseId - ID of the exercise
 * @param {number|null} days - Number of days to look back, or null for all time
 * @param {Array|null} cachedJournals - Optional pre-fetched journals to avoid redundant DB calls
 * @returns {Promise<Array>} Array of {date, value} objects
 */
export async function getExerciseAvgWeightData(exerciseId, days = 28, cachedJournals = null) {
  const endDate = getTodayDate();
  const allJournals = cachedJournals || await getRecentJournals(true);

  let journals;
  if (days === null) {
    journals = allJournals;
  } else {
    const startDate = subtractDays(endDate, days);
    journals = allJournals.filter(j => j.date >= startDate && j.date <= endDate);
  }

  return journals
    .filter(j => j.workout?.exercises?.some(ex => ex.id === exerciseId))
    .map(j => {
      const exercise = j.workout.exercises.find(ex => ex.id === exerciseId);
      let totalWeight = 0;
      let totalReps = 0;
      exercise.sets.forEach(set => {
        const reps = set.reps || 0;
        const weight = set.weight || 0;
        totalWeight += reps * weight;
        totalReps += reps;
      });
      return { date: j.date, value: totalReps > 0 ? totalWeight / totalReps : 0 };
    })
    .filter(d => d.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format date for axis label based on data range
 */
function formatDateLabel(dateStr, isLongRange) {
  const date = new Date(dateStr + 'T00:00:00');
  if (isLongRange) {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Calculate nice axis bounds with padding
 */
function getNiceAxisBounds(min, max) {
  const range = max - min || 1;
  const padding = range * 0.1;
  const niceMin = min - padding;
  const niceMax = max + padding;
  return { min: niceMin, max: niceMax, range: niceMax - niceMin };
}

/**
 * Calculate linear regression for trend line
 * @param {Array} data - Array of {date, value} objects
 * @returns {Object} {slope, intercept} for y = slope * x + intercept
 */
function calculateLinearRegression(data) {
  const n = data.length;
  if (n < 2) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  data.forEach((point, i) => {
    sumX += i;
    sumY += point.value;
    sumXY += i * point.value;
    sumX2 += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Format value for Y-axis label
 */
function formatYLabel(value, unit) {
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1) + 'k';
  }
  if (Number.isInteger(value) || Math.abs(value) >= 100) {
    return Math.round(value).toString();
  }
  return value.toFixed(1);
}

/**
 * Render a line chart on a canvas element
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} data - Array of {date, value} objects
 * @param {Object} options - Chart options (unit, metric, lineColor, etc.)
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

  // Margins for axes
  const marginLeft = 45;
  const marginRight = 10;
  const marginTop = 10;
  const marginBottom = 25;

  const chartWidth = width - marginLeft - marginRight;
  const chartHeight = height - marginTop - marginBottom;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (data.length < 2) {
    drawEmptyMessage(ctx, width, height, EMPTY_DATA_MESSAGE, options);
    return;
  }

  // Get unit for display (handle imperial conversion)
  let displayUnit = options.unit || '';
  let displayData = data;
  if (options.metric && state.unitPreference === 'imperial' && CONVERTIBLE_FIELDS.includes(options.metric)) {
    displayUnit = getDisplayUnit(options.metric, 'imperial');
    displayData = data.map(d => ({ ...d, value: toImperial(d.value, options.metric) }));
  }

  // Calculate bounds with padding
  const values = displayData.map(d => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const { min, max, range } = getNiceAxisBounds(rawMin, rawMax);

  // Determine if long range (> 60 days between first and last)
  const firstDate = new Date(data[0].date);
  const lastDate = new Date(data[data.length - 1].date);
  const daySpan = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
  const isLongRange = daySpan > 60;

  // Colors
  const textColor = options.textColor || '#9a95a8';
  const gridColor = options.gridColor || 'rgba(255,255,255,0.08)';
  const lineColor = options.lineColor || '#c4b5fd';
  const dotColor = options.dotColor || '#fbbf24';

  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textBaseline = 'middle';

  // Draw Y-axis labels and grid lines
  const yTickCount = 4;
  for (let i = 0; i <= yTickCount; i++) {
    const value = min + (i / yTickCount) * range;
    const y = marginTop + chartHeight - (i / yTickCount) * chartHeight;

    // Grid line
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(width - marginRight, y);
    ctx.stroke();

    // Y label
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.fillText(formatYLabel(value, displayUnit), marginLeft - 5, y);
  }

  // Draw unit label at top of Y-axis
  if (displayUnit) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText(displayUnit, marginLeft, marginTop - 2);
  }

  // Draw X-axis labels (show ~4-5 labels)
  const xLabelCount = Math.min(5, data.length);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < xLabelCount; i++) {
    const dataIndex = Math.floor(i * (data.length - 1) / (xLabelCount - 1));
    const x = marginLeft + (dataIndex / (data.length - 1)) * chartWidth;
    const label = formatDateLabel(data[dataIndex].date, isLongRange);

    ctx.fillStyle = textColor;
    ctx.fillText(label, x, height - marginBottom + 5);
  }

  // Draw trend line
  const trendColor = options.trendColor || 'rgba(251, 191, 36, 0.4)';
  const regression = calculateLinearRegression(displayData);
  if (regression) {
    const startY = regression.intercept;
    const endY = regression.slope * (displayData.length - 1) + regression.intercept;

    const x1 = marginLeft;
    const y1 = marginTop + chartHeight - ((startY - min) / range) * chartHeight;
    const x2 = marginLeft + chartWidth;
    const y2 = marginTop + chartHeight - ((endY - min) / range) * chartHeight;

    ctx.beginPath();
    ctx.strokeStyle = trendColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  displayData.forEach((point, i) => {
    const x = marginLeft + (i / (displayData.length - 1)) * chartWidth;
    const y = marginTop + chartHeight - ((point.value - min) / range) * chartHeight;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  // Draw dots at start and end
  [0, displayData.length - 1].forEach(i => {
    const x = marginLeft + (i / (displayData.length - 1)) * chartWidth;
    const y = marginTop + chartHeight - ((displayData[i].value - min) / range) * chartHeight;
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

/**
 * Format a chart summary as HTML
 * @param {Object} summary - Summary from getChartSummary
 * @param {string} unit - Unit label (e.g., 'kg', 'kcal')
 * @param {string} metric - Optional metric name for unit conversion
 * @returns {string} HTML string
 */
export function formatSummaryHTML(summary, unit = '', metric = null) {
  if (!summary) return '';

  let { start, end } = summary;
  let displayUnit = unit;

  // Convert if imperial and metric is convertible
  if (metric && state.unitPreference === 'imperial' && CONVERTIBLE_FIELDS.includes(metric)) {
    start = toImperial(start, metric);
    end = toImperial(end, metric);
    displayUnit = getDisplayUnit(metric, 'imperial');
  }

  return `
    <span>${start.toFixed(1)}${displayUnit}</span>
    <span> → </span>
    <span>${end.toFixed(1)}${displayUnit}</span>
  `;
}
