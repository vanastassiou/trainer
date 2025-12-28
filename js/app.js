// =============================================================================
// HEALTH TRACKER - MAIN APPLICATION
// =============================================================================
// Thin orchestrator that initializes and coordinates domain modules.

import { state } from './state.js';
import { getTodayDate } from './utils.js';
import { createTabController, createModalController } from './ui.js';
import { getChartData, getExercisesInPeriod, getExerciseAvgWeightData, renderLineChart, getChartSummary, formatSummaryHTML } from './charts.js';

// Domain modules
import {
  getJournalForDate,
  exportAllData,
  importData,
  loadJournalDatesForMonth,
  getRecentJournals
} from './db.js';

import {
  BODY_FIELDS,
  CIRCUMFERENCE_FIELDS,
  DAILY_FIELDS,
  METRIC_UNITS,
  generateDailyFormRows,
  generateMeasurementFormRows,
  loadMeasurementsData,
  loadDailyData,
  initMeasurementsForm,
  initDailyForm
} from './measurements.js';

import {
  loadExercisesDB,
  initWorkoutForm,
  initExercisePicker,
  initExerciseInfoModal,
  initExerciseEditModal,
  addExerciseCard,
  loadTemplate
} from './workout.js';

import {
  initProgramsPage,
  populateProgramSelector,
  updateDaySelector,
  renderProgramsList,
  refreshProgramUI
} from './programs.js';

import { initProfile, renderGoalsList, DIRECTION_CONFIG } from './goals.js';
import { initLearnPage, initGlossaryModal } from './learn.js';

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Generate dynamic form rows first (sync, fast)
  generateDailyFormRows('daily-fields-container');
  generateMeasurementFormRows('measurement-fields-container');

  // Start non-blocking operations
  requestPersistentStorage();
  registerServiceWorker();

  // Initialize UI (sync, no data needed)
  initTabs();
  initDateNavigation();
  initMeasurementsForm(async () => {
    await updateMeasurementsChart();
    await renderGoalsList();
  });
  initWorkoutForm({
    onProgramChange: async () => {
      await renderProgramsList(refreshProgramUI);
      await updateDaySelector();
    },
    onDayChange: () => {},
    updateChart: updateWorkoutsChart,
    loadTemplate,
    renderProgramsList
  });
  initProgramsPage({ refreshProgramUI });
  initExportButton();
  initDailyForm(async () => {
    await updateDailyChart();
    await renderGoalsList();
  });
  initCharts();

  // Load data - exercises must complete before picker init to avoid race
  await loadExercisesDB();
  initExercisePicker();
  initExerciseInfoModal();
  initExerciseEditModal();

  // Remaining data loads in parallel (glossary/profile not needed for UI init)
  await Promise.all([
    initLearnPage(),
    initProfile()
  ]);
  initGlossaryModal();

  await loadDataForDate(getTodayDate());
  await populateWorkoutsSelect();
  await refreshAllCharts();
});

async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const persistent = await navigator.storage.persist();
    console.log('Persistent storage:', persistent ? 'granted' : 'denied');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.log('Service worker registration failed:', err);
    });
  }
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

function initTabs() {
  // Main tabs: metrics, workouts, learn, profile
  createTabController('.tabs > .tab', 'main > section.page', {
    storageKey: 'activeTab',
    tabAttr: 'data-tab',
    onActivate: (tabId) => {
      if (tabId === 'metrics') {
        updateDailyChart();
        updateMeasurementsChart();
      }
    }
  });

  // Sub-tabs: Metrics
  createTabController(
    '#metrics > .sub-tabs > .sub-tab',
    '#metrics > .sub-page',
    {
      tabAttr: 'data-subtab',
      onActivate: (tabId) => {
        if (tabId === 'daily') updateDailyChart();
        else if (tabId === 'measurements') updateMeasurementsChart();
      }
    }
  );

  // Sub-tabs: Learn
  createTabController(
    '#learn > .sub-tabs > .sub-tab',
    '#learn > .sub-page',
    { tabAttr: 'data-subtab' }
  );
}

// =============================================================================
// DATE NAVIGATION
// =============================================================================

function initDateNavigation() {
  state.calendarDialog = createModalController(document.getElementById('calendar-modal'));

  // Date header navigation buttons
  document.querySelectorAll('.date-nav.prev').forEach(btn => {
    btn.addEventListener('click', () => navigateDate(-1));
  });

  document.querySelectorAll('.date-nav.next').forEach(btn => {
    btn.addEventListener('click', () => navigateDate(1));
  });

  // Open calendar on date display click
  document.querySelectorAll('.date-display').forEach(btn => {
    btn.addEventListener('click', openCalendar);
  });

  // Calendar grid click delegation (attach once, not on every render)
  const calendarGrid = document.querySelector('.calendar-grid');
  calendarGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.calendar-day:not([disabled])');
    if (btn && btn.dataset.date) {
      selectDate(btn.dataset.date);
      state.calendarDialog.close();
    }
  });

  // Calendar month navigation
  const calendarModal = document.getElementById('calendar-modal');
  calendarModal.querySelector('.month-nav.prev').addEventListener('click', async () => {
    state.calendarMonth.month--;
    if (state.calendarMonth.month < 0) {
      state.calendarMonth.month = 11;
      state.calendarMonth.year--;
    }
    await loadJournalDatesForMonth(state.calendarMonth.year, state.calendarMonth.month);
    renderCalendar();
  });

  calendarModal.querySelector('.month-nav.next').addEventListener('click', async () => {
    const today = new Date();
    const nextMonth = new Date(state.calendarMonth.year, state.calendarMonth.month + 1, 1);
    if (nextMonth <= new Date(today.getFullYear(), today.getMonth() + 1, 1)) {
      state.calendarMonth.month++;
      if (state.calendarMonth.month > 11) {
        state.calendarMonth.month = 0;
        state.calendarMonth.year++;
      }
      await loadJournalDatesForMonth(state.calendarMonth.year, state.calendarMonth.month);
      renderCalendar();
    }
  });

  // Today button
  calendarModal.querySelector('.today-btn').addEventListener('click', () => {
    selectDate(getTodayDate());
    state.calendarDialog.close();
  });
}

function navigateDate(delta) {
  const current = new Date(state.selectedDate + 'T00:00:00');
  current.setDate(current.getDate() + delta);

  const today = getTodayDate();
  const newDate = current.toISOString().split('T')[0];

  if (newDate <= today) {
    selectDate(newDate);
  }
}

async function openCalendar() {
  const dateStr = state.selectedDate || getTodayDate();
  const date = new Date(dateStr + 'T00:00:00');
  state.calendarMonth = { year: date.getFullYear(), month: date.getMonth() };
  await loadJournalDatesForMonth(state.calendarMonth.year, state.calendarMonth.month);
  renderCalendar();
  state.calendarDialog.open();
}

function renderCalendar() {
  const grid = document.querySelector('.calendar-grid');
  const monthYearLabel = document.querySelector('.month-year');

  const year = state.calendarMonth.year;
  const month = state.calendarMonth.month;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const today = getTodayDate();
  const todayObj = new Date(today + 'T00:00:00');

  const nextBtn = document.querySelector('#calendar-modal .month-nav.next');
  nextBtn.disabled = (year === todayObj.getFullYear() && month === todayObj.getMonth());

  let html = '';

  for (let i = 0; i < startDayOfWeek; i++) {
    html += '<button class="calendar-day other-month" disabled></button>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const isSelected = dateStr === state.selectedDate;
    const hasData = state.journalDatesCache.has(dateStr);
    const completion = state.getJournalDateCompletion(dateStr);
    const isFuture = dateStr > today;

    const classes = ['calendar-day'];
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');
    if (hasData) classes.push('has-data');
    if (isFuture) classes.push('future');

    // Add completion indicator emoji
    let indicator = '';
    if (hasData && completion !== null) {
      if (completion === 100) {
        indicator = '<span class="completion-indicator">⭐</span>';
      } else if (completion >= 75) {
        indicator = '<span class="completion-indicator">😁</span>';
      } else if (completion >= 50) {
        indicator = '<span class="completion-indicator">😊</span>';
      }
    }

    html += `<button class="${classes.join(' ')}" data-date="${dateStr}" ${isFuture ? 'disabled' : ''}>${day}${indicator}</button>`;
  }

  grid.innerHTML = html;
}

async function selectDate(date) {
  await loadDataForDate(date);
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadDataForDate(date) {
  state.isInitializing = true;
  state.selectedDate = date;
  const journal = await getJournalForDate(date);

  updateDateHeaders(date);

  // Load form data using measurement utilities
  loadMeasurementsData(journal);
  loadDailyData(journal);

  await populateProgramSelector();
  await updateDaySelector();

  if (journal.workout?.programId) {
    const programSelect = document.getElementById('current-program');
    const programName = document.getElementById('current-program-name');

    const savedProgramExists = Array.from(programSelect.options).some(
      opt => opt.value === journal.workout.programId
    );

    if (savedProgramExists) {
      programSelect.value = journal.workout.programId;

      const selectedOption = programSelect.options[programSelect.selectedIndex];
      if (selectedOption) {
        programName.textContent = selectedOption.text;
      }

      await updateDaySelector();

      if (journal.workout.dayNumber) {
        const suggestedDay = document.getElementById('suggested-day');
        const daySelect = document.getElementById('current-day');
        suggestedDay.textContent = `Day ${journal.workout.dayNumber}`;
        suggestedDay.dataset.day = journal.workout.dayNumber;
        daySelect.value = journal.workout.dayNumber;
      }
    }
  }

  const container = document.getElementById('exercises-container');
  container.innerHTML = '';

  if (journal.workout?.exercises?.length > 0) {
    journal.workout.exercises.forEach(exercise => {
      addExerciseCard(container, exercise);
    });
  } else {
    const programSelect = document.getElementById('current-program');
    if (programSelect.value) {
      await loadTemplate();
    }
  }

  const programSelect = document.getElementById('current-program');
  const programName = document.getElementById('current-program-name');

  if (programSelect.value && programSelect.selectedIndex >= 0) {
    const selectedOption = programSelect.options[programSelect.selectedIndex];
    if (selectedOption) {
      programName.textContent = selectedOption.text;
    }
  }

  state.isInitializing = false;
}

function updateDateHeaders(date) {
  const dateObj = new Date(date + 'T00:00:00');
  const formatted = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  document.querySelectorAll('.date-text').forEach(el => {
    el.textContent = formatted;
  });

  const today = getTodayDate();
  document.querySelectorAll('.date-nav.next').forEach(btn => {
    btn.disabled = date >= today;
  });
}

// =============================================================================
// CHARTS
// =============================================================================

function initCharts() {
  const dailyMetricSelect = document.getElementById('daily-metric-select');
  const dailyTimespanSelect = document.getElementById('daily-timespan-select');
  const measurementsMetricSelect = document.getElementById('measurements-metric-select');
  const measurementsTimespanSelect = document.getElementById('measurements-timespan-select');
  const workoutsMetricSelect = document.getElementById('workouts-metric-select');
  const workoutsTimespanSelect = document.getElementById('workouts-timespan-select');

  if (dailyMetricSelect) {
    dailyMetricSelect.addEventListener('change', () => updateDailyChart());
  }
  if (dailyTimespanSelect) {
    dailyTimespanSelect.addEventListener('change', () => updateDailyChart());
  }

  if (measurementsMetricSelect) {
    measurementsMetricSelect.addEventListener('change', () => updateMeasurementsChart());
  }
  if (measurementsTimespanSelect) {
    measurementsTimespanSelect.addEventListener('change', () => updateMeasurementsChart());
  }

  if (workoutsMetricSelect) {
    workoutsMetricSelect.addEventListener('change', () => updateWorkoutsChart());
  }
  if (workoutsTimespanSelect) {
    workoutsTimespanSelect.addEventListener('change', async () => {
      await populateWorkoutsSelect();
      await updateWorkoutsChart();
    });
  }
}

async function populateWorkoutsSelect() {
  const select = document.getElementById('workouts-metric-select');
  const timespanSelect = document.getElementById('workouts-timespan-select');
  if (!select) return;

  const timespanValue = timespanSelect?.value || '28';
  const days = timespanValue === 'all' ? 365 : parseInt(timespanValue, 10);
  const exercises = await getExercisesInPeriod(days);

  select.innerHTML = '';
  for (const name of exercises) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
}

async function updateDailyChart(cachedJournals = null) {
  const chartSection = document.getElementById('daily-chart');
  if (!chartSection) return;

  const canvas = chartSection.querySelector('.chart-canvas');
  const summaryEl = chartSection.querySelector('.chart-summary');
  const metricSelect = document.getElementById('daily-metric-select');
  const timespanSelect = document.getElementById('daily-timespan-select');
  const metric = metricSelect?.value || 'calories';
  const timespanValue = timespanSelect?.value || '28';
  const days = timespanValue === 'all' ? null : parseInt(timespanValue, 10);

  const unit = METRIC_UNITS[metric] || '';
  const data = await getChartData(metric, 'daily', days, cachedJournals);
  renderLineChart(canvas, data, { unit, metric });

  const summary = getChartSummary(data);
  summaryEl.innerHTML = formatSummaryHTML(summary, unit, metric);
}

async function updateMeasurementsChart(cachedJournals = null) {
  const chartSection = document.getElementById('measurements-chart');
  if (!chartSection) return;

  const canvas = chartSection.querySelector('.chart-canvas');
  const summaryEl = chartSection.querySelector('.chart-summary');
  const metricSelect = document.getElementById('measurements-metric-select');
  const timespanSelect = document.getElementById('measurements-timespan-select');
  const metric = metricSelect?.value || 'bodyFat';
  const timespanValue = timespanSelect?.value || '28';
  const days = timespanValue === 'all' ? null : parseInt(timespanValue, 10);

  const unit = METRIC_UNITS[metric] || '';
  const data = await getChartData(metric, 'body', days, cachedJournals);
  renderLineChart(canvas, data, { unit, metric });

  const summary = getChartSummary(data);
  summaryEl.innerHTML = formatSummaryHTML(summary, unit, metric);
}

async function updateWorkoutsChart(cachedJournals = null) {
  const chartSection = document.getElementById('workouts-chart');
  if (!chartSection) return;

  const canvas = chartSection.querySelector('.chart-canvas');
  const summaryEl = chartSection.querySelector('.chart-summary');
  const metricSelect = document.getElementById('workouts-metric-select');
  const timespanSelect = document.getElementById('workouts-timespan-select');
  const exercise = metricSelect?.value;
  const timespanValue = timespanSelect?.value || '28';
  const days = timespanValue === 'all' ? null : parseInt(timespanValue, 10);

  if (!exercise) {
    summaryEl.innerHTML = '';
    return;
  }

  const data = await getExerciseAvgWeightData(exercise, days, cachedJournals);
  renderLineChart(canvas, data, { unit: 'kg', metric: 'weight' });

  const summary = getChartSummary(data);
  summaryEl.innerHTML = formatSummaryHTML(summary, 'kg', 'weight');
}

async function refreshAllCharts() {
  // Fetch journals once for all charts
  const journals = await getRecentJournals(true);
  await Promise.all([
    updateDailyChart(journals),
    updateMeasurementsChart(journals),
    updateWorkoutsChart(journals)
  ]);
}

// =============================================================================
// DATA IMPORT/EXPORT
// =============================================================================

function initExportButton() {
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');

  exportBtn.addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `health-tracker-backup-${getTodayDate()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (confirm('This will replace all existing data. Continue?')) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importData(data);
        location.reload();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    }
    importFile.value = '';
  });
}
