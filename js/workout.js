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

export function getExerciseById(id) {
  return state.exercisesById.get(id) || null;
}

export function getExerciseByName(name) {
  return state.exerciseByName.get(name.toLowerCase()) || null;
}

function isBodyweightExercise(name) {
  const exercise = getExerciseByName(name);
  return exercise?.equipment === 'bodyweight';
}

function updateWeightVisibility(card) {
  const name = card.querySelector('.exercise-name').value.trim();
  if (name && isBodyweightExercise(name)) {
    card.classList.add('bodyweight');
  } else {
    card.classList.remove('bodyweight');
  }
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

  // Initialize set notes modal
  const setNotesModal = document.getElementById('set-notes-modal');
  const setNotesInput = document.getElementById('set-notes-input');
  const setNotesSaveBtn = document.getElementById('set-notes-save-btn');
  const setNotesTitle = document.getElementById('set-notes-title');
  let currentNotesRow = null;

  setNotesModal.querySelector('.modal-close').addEventListener('click', () => {
    setNotesModal.close();
  });

  setNotesSaveBtn.addEventListener('click', () => {
    if (currentNotesRow) {
      currentNotesRow.dataset.notes = setNotesInput.value;
      // Update button appearance based on whether notes exist
      const notesBtn = currentNotesRow.querySelector('.notes-btn');
      if (setNotesInput.value.trim()) {
        notesBtn.classList.add('has-notes');
      } else {
        notesBtn.classList.remove('has-notes');
      }
    }
    setNotesModal.close();
  });

  // Event delegation for exercise cards (attach once, not per card)
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.exercise-card');
    if (!card) return;

    // Handle collapse toggle
    if (e.target.closest('.collapse-toggle')) {
      card.classList.toggle('collapsed');
      return;
    }

    // Handle edit button click
    if (e.target.closest('.edit-exercise-btn')) {
      openExerciseEditModal(card);
      return;
    }

    // Handle notes button click
    if (e.target.closest('.notes-btn')) {
      const row = e.target.closest('.set-row');
      const setNum = parseInt(row.dataset.set, 10) + 1;
      const exerciseName = card.querySelector('.exercise-name').value || 'Exercise';
      currentNotesRow = row;
      setNotesTitle.textContent = `${exerciseName} - Set ${setNum}`;
      setNotesInput.value = row.dataset.notes || '';
      setNotesModal.showModal();
      return;
    }

    // Handle exercise name click (show info)
    if (e.target.closest('.exercise-name')) {
      const nameInput = card.querySelector('.exercise-name');
      const name = nameInput.value.trim();
      if (name) {
        showExerciseInfo(name);
      }
    }
  });

  // Handle blur events for weight visibility updates (non-program cards)
  container.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('exercise-name')) {
      const card = e.target.closest('.exercise-card');
      if (card && !card.dataset.fromProgram) {
        updateWeightVisibility(card);
      }
    }
  });

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
  if (existingData?.id) card.dataset.exerciseId = existingData.id;

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

  card.classList.add('collapsed');

  card.innerHTML = `
    <div class="exercise-header">
      <button type="button" class="collapse-toggle" aria-label="Toggle exercise details">
        <span class="collapse-icon"></span>
      </button>
      <input type="text" class="exercise-name" placeholder="Exercise name" ${fromProgram ? 'readonly' : ''}>
      <button type="button" class="btn secondary edit-exercise-btn">Edit</button>
    </div>
    <div class="sets-container">
      <div class="set-row set-header">
        <span class="set-label"></span>
        <span class="col-label" data-term="repetition">Reps</span>
        <span class="col-label" data-term="intensity">Weight (${weightUnit})</span>
        <span class="col-label col-label-rir" data-term="reps in reserve">RIR</span>
        <span class="col-label col-label-notes">Notes</span>
      </div>
      <div class="set-row" data-set="0">
        <span class="set-label">Set 1</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(0, 'reps')}" inputmode="numeric" min="0">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(0, 'weight')}" inputmode="decimal" step="0.1" min="0">
        <input type="number" class="rir-input" placeholder="${getPlaceholder(0, 'rir')}" inputmode="numeric" min="0" max="5">
        <button type="button" class="notes-btn" aria-label="Add notes for set 1">📝</button>
      </div>
      <div class="set-row" data-set="1">
        <span class="set-label">Set 2</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(1, 'reps')}" inputmode="numeric" min="0">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(1, 'weight')}" inputmode="decimal" step="0.1" min="0">
        <input type="number" class="rir-input" placeholder="${getPlaceholder(1, 'rir')}" inputmode="numeric" min="0" max="5">
        <button type="button" class="notes-btn" aria-label="Add notes for set 2">📝</button>
      </div>
      <div class="set-row" data-set="2">
        <span class="set-label">Set 3</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(2, 'reps')}" inputmode="numeric" min="0">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(2, 'weight')}" inputmode="decimal" step="0.1" min="0">
        <input type="number" class="rir-input" placeholder="${getPlaceholder(2, 'rir')}" inputmode="numeric" min="0" max="5">
        <button type="button" class="notes-btn" aria-label="Add notes for set 3">📝</button>
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
          if (set.rir !== null) setRows[i].querySelector('.rir-input').value = set.rir;
          if (set.notes) {
            setRows[i].dataset.notes = set.notes;
            setRows[i].querySelector('.notes-btn').classList.add('has-notes');
          }
        }
      });
    }
  }

  // Update weight visibility based on exercise type
  updateWeightVisibility(card);

  // Event listeners are handled by container-level delegation in initWorkoutForm()

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
  const templateExercises = program.days[dayNumber - 1].exercises || [];

  templateExercises.forEach(exerciseId => {
    // Look up exercise by ID to get display name
    const exercise = getExerciseById(exerciseId);
    const name = exercise?.name || exerciseId;
    if (!name) return;
    const previousData = previousExercises.find(e => e.id === exerciseId);
    addExerciseCard(container, { id: exerciseId, name, sets: [] }, {
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
  const difficultyFilter = document.getElementById('filter-difficulty');
  const list = document.getElementById('exercise-picker-list');

  searchInput.addEventListener('input', updateExercisePicker);
  muscleFilter.addEventListener('change', updateExercisePicker);
  movementFilter.addEventListener('change', updateExercisePicker);
  equipmentFilter.addEventListener('change', updateExercisePicker);
  difficultyFilter.addEventListener('change', updateExercisePicker);

  // Use event delegation for exercise selection and info
  list.addEventListener('click', (e) => {
    // Show exercise info when clicking the name
    if (e.target.closest('.exercise-picker-name')) {
      const item = e.target.closest('.exercise-picker-item');
      if (item) {
        showExerciseInfo(item.dataset.name);
      }
      return;
    }

    // Select exercise when clicking elsewhere on the item
    const item = e.target.closest('.exercise-picker-item');
    if (item) {
      const id = item.dataset.id;
      const name = item.dataset.name;
      if (state.exercisePickerCallback) {
        state.exercisePickerCallback({ id, name });
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
    equipment: otherFilters.equipment || '',
    difficulty: otherFilters.difficulty || ''
  };

  const matchingExercises = filterExercises(state.exercisesDB, mappedFilters);
  const availableValues = getUniqueValues(matchingExercises, field);

  const defaultLabel = {
    'muscle_group': 'All muscle groups',
    'movement_pattern': 'All movements',
    'equipment': 'All equipment',
    'difficulty': 'All levels'
  }[field];

  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  availableValues.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = formatLabel(value);
    select.appendChild(option);
  });

  // Restore selection if value is still available, otherwise reset
  select.value = availableValues.includes(currentValue) ? currentValue : '';
}

function updateExercisePicker() {
  const filters = getExerciseFilterValues();

  const currentFilters = {
    searchTerm: filters.searchTerm || null,
    muscle_group: filters.muscleGroup || null,
    movement_pattern: filters.movementPattern || null,
    equipment: filters.equipment || null,
    difficulty: filters.difficulty || null
  };

  updateFilterDropdown('filter-muscle-group', 'muscle_group', currentFilters);
  updateFilterDropdown('filter-movement', 'movement_pattern', currentFilters);
  updateFilterDropdown('filter-equipment', 'equipment', currentFilters);
  updateFilterDropdown('filter-difficulty', 'difficulty', currentFilters);

  renderExerciseList();
}

export function openExercisePicker(callback, options = {}) {
  const { exerciseName, muscleGroup, movementPattern, swapMode = false } = options;
  state.exercisePickerCallback = callback;
  resetExerciseFilters();

  const muscleSelect = document.getElementById('filter-muscle-group');
  const movementSelect = document.getElementById('filter-movement');
  const titleEl = document.getElementById('exercise-picker-title');

  // Build dropdowns first (with no filters applied)
  updateExercisePicker();

  // Now set filter values after dropdowns are populated
  if (muscleGroup) {
    muscleSelect.value = muscleGroup;
  }
  if (movementPattern) {
    movementSelect.value = movementPattern;
  }

  if (swapMode) {
    muscleSelect.classList.add('hidden');
    movementSelect.classList.add('hidden');
    titleEl.innerHTML = `Swap ${exerciseName} <span class="exercise-picker-tag muscle">${formatLabel(muscleGroup)}</span> <span class="exercise-picker-tag movement">${formatLabel(movementPattern)}</span>`;
  } else {
    titleEl.textContent = 'Select exercise';
  }

  // Re-render list with the applied filters
  renderExerciseList();
  state.exercisePickerDialog.open();
}

function closeExercisePicker() {
  state.exercisePickerDialog.close();
  state.exercisePickerCallback = null;

  // Reset UI that may have been modified in swap mode
  document.getElementById('filter-muscle-group').classList.remove('hidden');
  document.getElementById('filter-movement').classList.remove('hidden');
  document.getElementById('exercise-picker-title').textContent = 'Select exercise';
}

function renderExerciseList() {
  const list = document.getElementById('exercise-picker-list');
  const filters = getExerciseFilterValues();
  const filtered = filterExercises(state.exercisesDB, filters);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="exercise-picker-empty">No exercises found</div>';
    return;
  }

  // Only show equipment/difficulty tags when "all" is selected
  const showEquipment = !filters.equipment;
  const showDifficulty = !filters.difficulty;

  list.innerHTML = filtered.map(ex => {
    const tags = [];
    if (showEquipment) {
      tags.push(`<span class="exercise-picker-tag equipment">${formatLabel(ex.equipment)}</span>`);
    }
    if (showDifficulty) {
      tags.push(`<span class="exercise-picker-tag difficulty">${formatLabel(ex.difficulty)}</span>`);
    }
    const metaHtml = tags.length ? `<div class="exercise-picker-meta">${tags.join('')}</div>` : '';
    return `
      <div class="exercise-picker-item" data-id="${ex.id}" data-name="${ex.name}">
        <span class="exercise-picker-name">${ex.name}</span>
        ${metaHtml}
      </div>
    `;
  }).join('');
}

// =============================================================================
// EXERCISE INFO MODAL
// =============================================================================

export function initExerciseInfoModal() {
  state.exerciseInfoDialog = createModalController(
    document.getElementById('exercise-info-modal')
  );
}

export function showExerciseInfo(exerciseNameOrId) {
  // Try lookup by name first, then by ID
  let exercise = getExerciseByName(exerciseNameOrId);
  if (!exercise) {
    exercise = getExerciseById(exerciseNameOrId);
  }
  if (!exercise) {
    showToast('Exercise info not found');
    return;
  }

  const nameEl = document.getElementById('exercise-info-name');
  const contentEl = document.getElementById('exercise-info-content');

  nameEl.textContent = exercise.name;

  let html = '';

  // Metadata section
  html += '<div class="exercise-info-meta">';
  if (exercise.role) {
    html += `<span class="exercise-meta-tag">${formatLabel(exercise.role)}</span>`;
  }
  if (exercise.movement_pattern) {
    html += `<span class="exercise-meta-tag">${formatLabel(exercise.movement_pattern)}</span>`;
  }
  if (exercise.difficulty) {
    html += `<span class="exercise-meta-tag">${formatLabel(exercise.difficulty)}</span>`;
  }
  if (exercise.muscle_group) {
    html += `<span class="exercise-meta-tag">${formatLabel(exercise.muscle_group)}</span>`;
  }
  html += '</div>';

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

// =============================================================================
// EXERCISE EDIT MODAL
// =============================================================================

let currentEditCard = null;

export function initExerciseEditModal() {
  state.exerciseEditDialog = createModalController(
    document.getElementById('exercise-edit-modal')
  );

  const swapBtn = document.getElementById('exercise-swap-btn');
  const removeBtn = document.getElementById('exercise-remove-btn');

  swapBtn.addEventListener('click', () => {
    if (!currentEditCard) return;
    const nameInput = currentEditCard.querySelector('.exercise-name');
    const exerciseName = nameInput.value.trim();
    const exercise = getExerciseByName(exerciseName);
    const muscleGroup = exercise?.muscle_group || '';
    const movementPattern = exercise?.movement_pattern || '';

    state.exerciseEditDialog.close();

    openExercisePicker(({ id, name }) => {
      if (!confirm(`Swap out ${exerciseName} for ${name}?`)) return;

      nameInput.value = name;
      currentEditCard.dataset.exerciseId = id;
      updateWeightVisibility(currentEditCard);
      currentEditCard = null;
    }, { exerciseName, muscleGroup, movementPattern, swapMode: true });
  });

  removeBtn.addEventListener('click', () => {
    if (!currentEditCard) return;
    const nameInput = currentEditCard.querySelector('.exercise-name');
    const exerciseName = nameInput.value.trim();

    if (!confirm(`Remove ${exerciseName} from today's workout?`)) return;

    state.exerciseEditDialog.close();
    currentEditCard.remove();
    currentEditCard = null;
  });
}

function openExerciseEditModal(card) {
  currentEditCard = card;
  const nameInput = card.querySelector('.exercise-name');
  const exerciseName = nameInput.value.trim() || 'Exercise';
  document.getElementById('exercise-edit-name').textContent = `Edit ${exerciseName}`;
  state.exerciseEditDialog.open();
}

