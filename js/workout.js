// =============================================================================
// WORKOUT MODULE
// =============================================================================
// Handles workout logging, exercise cards, and exercise picker.

import { state } from './state.js';
import { fetchJSON, formatLabel, renderListItems, swapVisibility, toImperial } from './utils.js';
import { createModalController, showConfirmDialog, showToast } from './ui.js';
import { filterExercises, getExerciseFilterValues, resetExerciseFilters, getUniqueValues } from './filters.js';
import { hasUnsavedWorkoutData, collectWorkoutData } from './validation.js';
import {
  db,
  getJournalForDate,
  saveJournalForDate,
  getMostRecentWorkout,
  getActiveProgram,
  setActiveProgram,
  getProgram,
  getProgramDayCount,
  getNextDayNumber
} from './db.js';

// =============================================================================
// EXERCISE DATABASE
// =============================================================================

export async function loadExercisesDB() {
  const data = await fetchJSON('data/exercises.json', { exercises: [] });
  state.exercisesDB = data.exercises || [];
}

export function getExerciseByName(name) {
  return state.exercisesDB.find(ex =>
    ex.name.toLowerCase() === name.toLowerCase()
  );
}

// =============================================================================
// WORKOUT SWITCH DIALOG
// =============================================================================

export async function showWorkoutSwitchDialogPromise() {
  return showConfirmDialog(state.workoutSwitchDialog.dialog, {
    '.dialog-save-btn': 'save',
    '.dialog-discard-btn': 'discard',
    '.dialog-cancel-btn': 'cancel'
  });
}

// =============================================================================
// WORKOUT FORM
// =============================================================================

export function initWorkoutForm(callbacks) {
  const { onProgramChange, onDayChange, updateChart, loadTemplate, renderProgramsList } = callbacks;

  const form = document.getElementById('workout-form');
  const container = document.getElementById('exercises-container');
  const addBtn = document.getElementById('add-exercise');
  const programSelect = document.getElementById('current-program');
  const programName = document.getElementById('current-program-name');
  const changeProgramBtn = document.getElementById('change-program-btn');
  const changeDayBtn = document.getElementById('change-day-btn');
  const daySelect = document.getElementById('current-day');
  const suggestedDay = document.getElementById('suggested-day');

  // Initialize workout switch dialog
  state.workoutSwitchDialog = createModalController(
    document.getElementById('workout-switch-dialog')
  );

  addBtn.addEventListener('click', () => {
    addExerciseCard(container);
  });

  changeProgramBtn.addEventListener('click', () => {
    if (programSelect.classList.contains('hidden')) {
      swapVisibility(programSelect, programName.parentElement);
    } else {
      confirmProgramChange();
    }
  });

  programSelect.addEventListener('change', () => {
    if (state.isInitializing) return;
    confirmProgramChange();
  });

  async function confirmProgramChange() {
    const previousProgramId = localStorage.getItem('activeProgramId');

    if (hasUnsavedWorkoutData(container)) {
      const result = await showWorkoutSwitchDialogPromise();
      if (result === 'cancel') {
        programSelect.value = previousProgramId || '';
        swapVisibility(programName.parentElement, programSelect);
        return;
      }
      if (result === 'save') {
        form.requestSubmit();
      }
    }

    swapVisibility(programName.parentElement, programSelect);
    const selectedOption = programSelect.options[programSelect.selectedIndex];
    programName.textContent = selectedOption.text;

    await setActiveProgram(programSelect.value || null);
    await onProgramChange();

    container.innerHTML = '';
    if (programSelect.value) {
      await loadTemplate();
    }
  }

  changeDayBtn.addEventListener('click', () => {
    if (daySelect.classList.contains('hidden')) {
      swapVisibility(daySelect, suggestedDay.parentElement);
    } else {
      confirmDayChange();
    }
  });

  daySelect.addEventListener('change', () => {
    if (state.isInitializing) return;
    confirmDayChange();
  });

  async function confirmDayChange() {
    const newDay = daySelect.value;

    if (hasUnsavedWorkoutData(container)) {
      const result = await showWorkoutSwitchDialogPromise();
      if (result === 'cancel') {
        daySelect.value = suggestedDay.dataset.day;
        swapVisibility(suggestedDay.parentElement, daySelect);
        return;
      }
      if (result === 'save') {
        form.requestSubmit();
      }
    }

    swapVisibility(suggestedDay.parentElement, daySelect);
    suggestedDay.textContent = `Day ${newDay}`;
    suggestedDay.dataset.day = newDay;

    container.innerHTML = '';
    if (programSelect.value) {
      await loadTemplate();
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const exercises = collectWorkoutData(container);
    const programId = document.getElementById('current-program').value || null;
    const dayNumber = getCurrentDayNumber();

    const journal = await getJournalForDate(state.selectedDate);
    journal.workout = { programId, dayNumber, exercises };
    await saveJournalForDate(journal);
    if (updateChart) await updateChart();
  });
}

export function getCurrentDayNumber() {
  const programSelect = document.getElementById('current-program');
  if (!programSelect.value) return null;

  const daySelect = document.getElementById('current-day');
  const suggestedDay = document.getElementById('suggested-day');

  if (!daySelect.classList.contains('hidden')) {
    return parseInt(daySelect.value, 10) || 1;
  }
  return parseInt(suggestedDay.dataset.day, 10) || 1;
}

// =============================================================================
// EXERCISE CARDS
// =============================================================================

export function addExerciseCard(container, existingData = null, options = {}) {
  const { fromProgram = false, placeholderData = null } = options;
  const card = document.createElement('div');
  card.className = 'exercise-card card';
  if (fromProgram) card.dataset.fromProgram = 'true';

  const unitPreference = state.unitPreference;
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';

  const getPlaceholder = (setIndex, field) => {
    if (!placeholderData?.sets?.[setIndex]) {
      return '-';
    }
    let value = placeholderData.sets[setIndex][field];
    if (value !== null && value !== undefined) {
      // Convert weight for display if imperial
      if (field === 'weight' && unitPreference === 'imperial') {
        value = toImperial(value, 'weight').toFixed(1);
      }
      return value;
    }
    return '-';
  };

  card.innerHTML = `
    <div class="exercise-header">
      <input type="text" class="exercise-name ${fromProgram ? 'tappable' : ''}" placeholder="Exercise name" ${fromProgram ? 'readonly' : ''}>
      <button type="button" class="exercise-info-btn" title="Exercise info">?</button>
      ${fromProgram ? '' : '<button type="button" class="btn danger remove-btn">Remove</button>'}
    </div>
    <div class="sets-container">
      <div class="set-row set-header">
        <span class="set-label"></span>
        <span class="col-label">Reps<button type="button" class="term-info-btn" data-term="repetition">?</button></span>
        <span class="col-label">Weight (${weightUnit})<button type="button" class="term-info-btn" data-term="intensity">?</button></span>
        <span class="col-label col-label-rpe">RPE<button type="button" class="term-info-btn" data-term="RPE">?</button></span>
      </div>
      <div class="set-row">
        <span class="set-label">Set 1</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(0, 'reps')}" inputmode="numeric" min="0">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(0, 'weight')}" inputmode="decimal" step="0.1" min="0">
        <input type="number" class="rpe-input" placeholder="${getPlaceholder(0, 'rpe')}" inputmode="decimal" step="0.5" min="1" max="10">
      </div>
      <div class="set-row">
        <span class="set-label">Set 2</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(1, 'reps')}" inputmode="numeric" min="0">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(1, 'weight')}" inputmode="decimal" step="0.1" min="0">
        <input type="number" class="rpe-input" placeholder="${getPlaceholder(1, 'rpe')}" inputmode="decimal" step="0.5" min="1" max="10">
      </div>
      <div class="set-row">
        <span class="set-label">Set 3</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(2, 'reps')}" inputmode="numeric" min="0">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(2, 'weight')}" inputmode="decimal" step="0.1" min="0">
        <input type="number" class="rpe-input" placeholder="${getPlaceholder(2, 'rpe')}" inputmode="decimal" step="0.5" min="1" max="10">
      </div>
    </div>
  `;

  if (existingData) {
    card.querySelector('.exercise-name').value = existingData.name || '';
    const setRows = card.querySelectorAll('.set-row:not(.set-header)');
    if (existingData.sets) {
      existingData.sets.forEach((set, i) => {
        if (setRows[i]) {
          if (set.reps !== null) setRows[i].querySelector('.reps-input').value = set.reps;
          if (set.weight !== null) {
            let displayWeight = set.weight;
            if (unitPreference === 'imperial') {
              displayWeight = toImperial(set.weight, 'weight').toFixed(1);
            }
            setRows[i].querySelector('.weight-input').value = displayWeight;
          }
          if (set.rpe !== null) setRows[i].querySelector('.rpe-input').value = set.rpe;
        }
      });
    }
  }

  const nameInput = card.querySelector('.exercise-name');
  if (fromProgram) {
    nameInput.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (name) {
        showExerciseInfo(name);
      }
    });
  }

  const infoBtn = card.querySelector('.exercise-info-btn');
  infoBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
      showExerciseInfo(name);
    } else {
      showToast('Enter an exercise name first');
    }
  });

  const removeBtn = card.querySelector('.remove-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      card.remove();
    });
  }

  container.appendChild(card);
}

// =============================================================================
// TEMPLATE LOADING
// =============================================================================

export async function loadTemplate() {
  const programId = document.getElementById('current-program').value || null;
  const dayNumber = getCurrentDayNumber();
  const container = document.getElementById('exercises-container');

  if (!programId || !dayNumber) {
    return;
  }

  const program = await getProgram(programId);
  if (!program?.days?.[dayNumber - 1]) {
    return;
  }

  const previousJournal = await getMostRecentWorkout(programId, dayNumber);
  const previousExercises = previousJournal?.workout?.exercises || [];

  container.innerHTML = '';
  const templateExercises = program.days[dayNumber - 1].exercises;

  templateExercises.forEach(name => {
    const previousData = previousExercises.find(e => e.name === name);
    addExerciseCard(container, { name, sets: [] }, {
      fromProgram: true,
      placeholderData: previousData
    });
  });
}

// =============================================================================
// EXERCISE PICKER
// =============================================================================

export function initExercisePicker() {
  state.exercisePickerDialog = createModalController(
    document.getElementById('exercise-picker-modal')
  );

  const searchInput = document.getElementById('exercise-search');
  const muscleFilter = document.getElementById('filter-muscle-group');
  const movementFilter = document.getElementById('filter-movement');
  const equipmentFilter = document.getElementById('filter-equipment');
  const list = document.getElementById('exercise-picker-list');

  searchInput.addEventListener('input', updateExercisePicker);
  muscleFilter.addEventListener('change', updateExercisePicker);
  movementFilter.addEventListener('change', updateExercisePicker);
  equipmentFilter.addEventListener('change', updateExercisePicker);

  // Use event delegation for exercise selection
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.exercise-picker-item');
    if (item) {
      const name = item.dataset.name;
      if (state.exercisePickerCallback) {
        state.exercisePickerCallback(name);
      }
      closeExercisePicker();
    }
  });
}

function updateFilterDropdown(selectId, field, currentFilters) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;

  const otherFilters = { ...currentFilters };
  delete otherFilters[field];

  // Map filter keys to match filterExercises expected keys
  const mappedFilters = {
    searchTerm: otherFilters.searchTerm || '',
    muscleGroup: otherFilters.muscle_group || '',
    movementPattern: otherFilters.movement_pattern || '',
    equipment: otherFilters.equipment || ''
  };

  const matchingExercises = filterExercises(state.exercisesDB, mappedFilters);
  const availableValues = getUniqueValues(matchingExercises, field);

  const defaultLabel = {
    'muscle_group': 'All muscle groups',
    'movement_pattern': 'All movements',
    'equipment': 'All equipment'
  }[field];

  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  availableValues.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = formatLabel(value);
    if (value === currentValue) option.selected = true;
    select.appendChild(option);
  });

  if (currentValue && !availableValues.includes(currentValue)) {
    select.value = '';
  }
}

function updateExercisePicker() {
  const filters = getExerciseFilterValues();

  const currentFilters = {
    searchTerm: filters.searchTerm || null,
    muscle_group: filters.muscleGroup || null,
    movement_pattern: filters.movementPattern || null,
    equipment: filters.equipment || null
  };

  updateFilterDropdown('filter-muscle-group', 'muscle_group', currentFilters);
  updateFilterDropdown('filter-movement', 'movement_pattern', currentFilters);
  updateFilterDropdown('filter-equipment', 'equipment', currentFilters);

  renderExerciseList();
}

export function openExercisePicker(callback) {
  state.exercisePickerCallback = callback;
  resetExerciseFilters();
  updateExercisePicker();
  state.exercisePickerDialog.open();
}

function closeExercisePicker() {
  state.exercisePickerDialog.close();
  state.exercisePickerCallback = null;
}

function renderExerciseList() {
  const list = document.getElementById('exercise-picker-list');
  const filters = getExerciseFilterValues();
  const filtered = filterExercises(state.exercisesDB, filters);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="exercise-picker-empty">No exercises found</div>';
    return;
  }

  list.innerHTML = filtered.map(ex => `
    <div class="exercise-picker-item" data-name="${ex.name}">
      <span class="exercise-picker-name">${ex.name}</span>
      <div class="exercise-picker-meta">
        <span class="exercise-picker-tag muscle">${formatLabel(ex.muscle_group)}</span>
        <span class="exercise-picker-tag movement">${formatLabel(ex.movement_pattern)}</span>
        <span class="exercise-picker-tag equipment">${formatLabel(ex.equipment)}</span>
      </div>
    </div>
  `).join('');
}

// =============================================================================
// EXERCISE INFO MODAL
// =============================================================================

export function initExerciseInfoModal() {
  state.exerciseInfoDialog = createModalController(
    document.getElementById('exercise-info-modal')
  );
}

export function showExerciseInfo(exerciseName) {
  const exercise = getExerciseByName(exerciseName);
  if (!exercise) {
    showToast('Exercise info not found');
    return;
  }

  const nameEl = document.getElementById('exercise-info-name');
  const contentEl = document.getElementById('exercise-info-content');

  nameEl.textContent = exercise.name;

  let html = '';

  if (exercise.instructions?.length) {
    html += `
      <div class="exercise-info-section instructions">
        <h4>Instructions</h4>
        <ol>${renderListItems(exercise.instructions)}</ol>
      </div>
    `;
  }

  if (exercise.tips?.length) {
    html += `
      <div class="exercise-info-section tips">
        <h4>Tips</h4>
        <ul>${renderListItems(exercise.tips)}</ul>
      </div>
    `;
  }

  if (exercise.avoid?.length) {
    html += `
      <div class="exercise-info-section mistakes">
        <h4>Avoid</h4>
        <ul>${renderListItems(exercise.avoid)}</ul>
      </div>
    `;
  }

  contentEl.innerHTML = html;
  state.exerciseInfoDialog.open();
}
