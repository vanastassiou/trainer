// =============================================================================
// PROGRAMS MODULE
// =============================================================================
// Handles program creation, editing, and listing.

import { state } from './state.js';
import { swapVisibility } from './utils.js';
import { createModalController, showToast } from './ui.js';
import { createTabController } from './ui.js';
import { validateProgram, hasUnsavedWorkoutData, collectProgramDays } from './validation.js';
import {
  createProgram,
  getAllPrograms,
  getProgram,
  updateProgram,
  deleteProgram,
  getActiveProgram,
  setActiveProgram,
  getProgramDayCount,
  getNextDayNumber
} from './db.js';
import { showExerciseInfo, openExercisePicker, showWorkoutSwitchDialogPromise, loadTemplate } from './workout.js';

// =============================================================================
// PROGRAM TEMPLATES
// =============================================================================

// Store generation settings for regeneration
let generatorSettings = null;

// Muscle groups in order: large → small → core
const MUSCLE_ORDER = [
  'quadriceps', 'hamstrings', 'glutes', 'back', 'chest',
  'shoulders', 'biceps', 'triceps', 'calves', 'core'
];

// Compound movement patterns (preferred over isolation)
const COMPOUND_PATTERNS = ['push', 'pull', 'squat', 'hinge', 'lunge'];

// Exercise selection priority (per NSCA guidelines):
// 1. Compound movements before isolation
// 2. Basic (core) exercises before auxiliary (assistance)
// 3. Large muscle groups before small

// Program templates by days per week
const PROGRAM_TEMPLATES = {
  1: {
    name: 'Full body',
    days: [
      { name: 'Full body', muscles: ['quadriceps', 'hamstrings', 'back', 'chest', 'shoulders', 'core'] }
    ]
  },
  2: {
    name: 'Full body',
    days: [
      { name: 'Full body A', muscles: ['quadriceps', 'hamstrings', 'back', 'chest', 'shoulders', 'core'] },
      { name: 'Full body B', muscles: ['quadriceps', 'hamstrings', 'back', 'chest', 'shoulders', 'core'] }
    ]
  },
  3: {
    name: 'Push pull legs',
    days: [
      { name: 'Push', muscles: ['chest', 'shoulders', 'triceps', 'core'] },
      { name: 'Pull', muscles: ['back', 'biceps', 'core'] },
      { name: 'Legs', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] }
    ]
  },
  4: {
    name: 'Upper lower',
    days: [
      { name: 'Upper A', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
      { name: 'Lower A', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] },
      { name: 'Upper B', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
      { name: 'Lower B', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] }
    ]
  },
  5: {
    name: 'PPL upper lower',
    days: [
      { name: 'Push', muscles: ['chest', 'shoulders', 'triceps', 'core'] },
      { name: 'Pull', muscles: ['back', 'biceps', 'core'] },
      { name: 'Legs', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] },
      { name: 'Upper', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
      { name: 'Lower', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] }
    ]
  },
  6: {
    name: 'Push pull legs',
    days: [
      { name: 'Push A', muscles: ['chest', 'shoulders', 'triceps', 'core'] },
      { name: 'Pull A', muscles: ['back', 'biceps', 'core'] },
      { name: 'Legs A', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] },
      { name: 'Push B', muscles: ['chest', 'shoulders', 'triceps', 'core'] },
      { name: 'Pull B', muscles: ['back', 'biceps', 'core'] },
      { name: 'Legs B', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'core'] }
    ]
  }
};

// =============================================================================
// PROGRAM GENERATION
// =============================================================================

/**
 * Generate a workout program based on user preferences.
 * @param {number} daysPerWeek - Number of workout days (1-6)
 * @param {string[]} equipment - Array of available equipment types
 * @param {string} difficulty - User's difficulty level
 * @param {string} goal - Training goal ('maintenance' or 'growth')
 * @returns {Object} Generated program object (not yet saved)
 */
export function generateProgram(daysPerWeek, equipment, difficulty, goal = 'growth') {
  const template = PROGRAM_TEMPLATES[daysPerWeek];
  if (!template) {
    throw new Error(`Invalid days per week: ${daysPerWeek}`);
  }

  const exercises = state.exercisesDB;
  const usedExercises = new Set();

  const days = template.days.map(dayTemplate => {
    const dayExercises = [];

    // Sort muscles by the defined order
    const sortedMuscles = [...dayTemplate.muscles].sort(
      (a, b) => MUSCLE_ORDER.indexOf(a) - MUSCLE_ORDER.indexOf(b)
    );

    // Target based on goal and muscle count (see docs/volume-guidelines.md)
    const muscleCount = dayTemplate.muscles.length;
    const targetExercises = goal === 'maintenance'
      ? Math.max(3, muscleCount)
      : Math.min(6, muscleCount + 2);
    const maxExercises = 6;

    // First pass: select compound/basic exercises for each muscle group
    for (const muscle of sortedMuscles) {
      if (dayExercises.length >= maxExercises) break;

      const exercise = selectExercise(
        exercises,
        muscle,
        equipment,
        difficulty,
        usedExercises
      );

      if (exercise) {
        dayExercises.push(exercise.name);
        usedExercises.add(exercise.id);
      }
    }

    // Second pass: fill to target with auxiliary/isolation exercises
    let muscleIndex = 0;
    while (dayExercises.length < targetExercises && dayExercises.length < maxExercises) {
      const muscle = sortedMuscles[muscleIndex % sortedMuscles.length];
      const exercise = selectAuxiliaryExercise(
        exercises,
        muscle,
        equipment,
        difficulty,
        usedExercises
      );

      if (exercise) {
        dayExercises.push(exercise.name);
        usedExercises.add(exercise.id);
      }
      muscleIndex++;

      // Prevent infinite loop if no more exercises available
      if (muscleIndex >= sortedMuscles.length * 3) break;
    }

    return { name: dayTemplate.name, exercises: dayExercises };
  });

  return {
    name: template.name,
    days
  };
}

/**
 * Select the best exercise for a muscle group based on criteria.
 */
function selectExercise(exercises, muscleGroup, equipment, difficulty, usedExercises) {
  // Filter by muscle group and equipment
  let candidates = exercises.filter(ex =>
    ex.muscle_group === muscleGroup &&
    equipment.includes(ex.equipment) &&
    !usedExercises.has(ex.id)
  );

  if (candidates.length === 0) return null;

  // Filter by difficulty (include easier levels)
  const difficultyLevels = getDifficultyLevels(difficulty);
  candidates = candidates.filter(ex => difficultyLevels.includes(ex.difficulty));

  // No fallback to harder exercises - return null if none match
  if (candidates.length === 0) return null;

  // Sort: compound first, then basic over auxiliary, then alphabetically
  candidates.sort((a, b) => {
    const aCompound = COMPOUND_PATTERNS.includes(a.movement_pattern) ? 0 : 1;
    const bCompound = COMPOUND_PATTERNS.includes(b.movement_pattern) ? 0 : 1;
    if (aCompound !== bCompound) return aCompound - bCompound;

    const aBasic = a.role === 'basic' ? 0 : 1;
    const bBasic = b.role === 'basic' ? 0 : 1;
    if (aBasic !== bBasic) return aBasic - bBasic;

    return a.name.localeCompare(b.name);
  });

  return candidates[0];
}

/**
 * Select an auxiliary/isolation exercise for a muscle group.
 * Prefers isolation movements over compound, and auxiliary role over basic.
 */
function selectAuxiliaryExercise(exercises, muscleGroup, equipment, difficulty, usedExercises) {
  let candidates = exercises.filter(ex =>
    ex.muscle_group === muscleGroup &&
    equipment.includes(ex.equipment) &&
    !usedExercises.has(ex.id)
  );

  if (candidates.length === 0) return null;

  const difficultyLevels = getDifficultyLevels(difficulty);
  candidates = candidates.filter(ex => difficultyLevels.includes(ex.difficulty));

  if (candidates.length === 0) return null;

  // Sort: isolation first, then auxiliary over basic, then alphabetically
  candidates.sort((a, b) => {
    const aIsolation = COMPOUND_PATTERNS.includes(a.movement_pattern) ? 1 : 0;
    const bIsolation = COMPOUND_PATTERNS.includes(b.movement_pattern) ? 1 : 0;
    if (aIsolation !== bIsolation) return aIsolation - bIsolation;

    const aAux = a.role === 'auxiliary' ? 0 : 1;
    const bAux = b.role === 'auxiliary' ? 0 : 1;
    if (aAux !== bAux) return aAux - bAux;

    return a.name.localeCompare(b.name);
  });

  return candidates[0];
}

/**
 * Get allowed difficulty levels based on user selection.
 */
function getDifficultyLevels(difficulty) {
  switch (difficulty) {
    case 'beginner':
      return ['beginner'];
    case 'intermediate':
      return ['beginner', 'intermediate'];
    case 'advanced':
      return ['beginner', 'intermediate', 'advanced'];
    default:
      return ['beginner', 'intermediate', 'advanced'];
  }
}

/**
 * Get form values for program generation.
 */
function getGeneratorFormValues() {
  const daysPerWeek = parseInt(document.getElementById('program-days-per-week').value, 10);

  const equipmentCheckboxes = document.querySelectorAll('input[name="equipment"]:checked');
  const equipment = Array.from(equipmentCheckboxes).map(cb => cb.value);

  const difficultyRadio = document.querySelector('input[name="difficulty"]:checked');
  const difficulty = difficultyRadio ? difficultyRadio.value : 'beginner';

  const goalRadio = document.querySelector('input[name="goal"]:checked');
  const goal = goalRadio ? goalRadio.value : 'growth';

  return { daysPerWeek, equipment, difficulty, goal };
}

// =============================================================================
// PROGRAMS PAGE
// =============================================================================

export function initProgramsPage(callbacks) {
  const { refreshProgramUI } = callbacks;

  // Initialize sub-tabs using createTabController
  createTabController(
    '#programs > .sub-tabs > .sub-tab',
    '#programs > .sub-page',
    { tabAttr: 'data-subtab' }
  );

  initEditProgramModal(refreshProgramUI);

  // Wire up generate program button
  const generateBtn = document.getElementById('generate-program-btn');
  generateBtn.addEventListener('click', () => {
    const { daysPerWeek, equipment, difficulty, goal } = getGeneratorFormValues();

    if (equipment.length === 0) {
      showToast('Select at least one equipment type');
      return;
    }

    // Store settings for regeneration
    generatorSettings = { daysPerWeek, equipment, difficulty, goal };

    try {
      const program = generateProgram(daysPerWeek, equipment, difficulty, goal);
      openEditProgramModalWithGenerated(program);
    } catch (err) {
      showToast(err.message);
    }
  });

  renderProgramsList(refreshProgramUI);
}

export function switchToProgramsSubTab(tabId) {
  const programsPage = document.getElementById('programs');
  if (!programsPage) return;

  const tabs = programsPage.querySelectorAll(':scope > .sub-tabs > .sub-tab');
  const pages = programsPage.querySelectorAll(':scope > .sub-page');

  tabs.forEach(t => t.classList.remove('active'));
  pages.forEach(p => p.classList.remove('active'));

  const tab = programsPage.querySelector(`.sub-tab[data-subtab="${tabId}"]`);
  const page = document.getElementById(tabId);
  if (tab && page) {
    tab.classList.add('active');
    page.classList.add('active');
  }
}

// =============================================================================
// EDIT PROGRAM MODAL
// =============================================================================

function openEditProgramModal(program) {
  state.editingProgramId = program.id;
  populateEditModal(program, false);
  state.editProgramDialog.open();
}

function openEditProgramModalWithGenerated(program) {
  state.editingProgramId = null;
  populateEditModal(program, true);
  state.editProgramDialog.open();
}

function populateEditModal(program, isGeneratorMode) {
  const nameInput = document.getElementById('edit-program-name');
  const daysContainer = document.getElementById('edit-program-days-container');
  const deleteBtn = document.getElementById('delete-program-btn');
  const regenerateBtn = document.getElementById('regenerate-program-btn');
  const modalTitle = document.querySelector('#edit-program-modal .modal-header h3');

  nameInput.value = program.name;
  daysContainer.innerHTML = '';

  if (program.days) {
    program.days.forEach(day => {
      addProgramDayCard(daysContainer, day.exercises, { showLockButtons: isGeneratorMode });
    });
  }

  // Update UI based on mode
  modalTitle.textContent = isGeneratorMode ? 'Review program' : 'Edit program';
  deleteBtn.classList.toggle('hidden', isGeneratorMode);
  regenerateBtn.classList.toggle('hidden', !isGeneratorMode);

  // Clear generator settings when editing existing program
  if (!isGeneratorMode) {
    generatorSettings = null;
  }
}

function closeEditProgramModal() {
  state.editProgramDialog.close();
  state.editingProgramId = null;
}

function initEditProgramModal(refreshProgramUI) {
  state.editProgramDialog = createModalController(
    document.getElementById('edit-program-modal')
  );

  const addDayBtn = document.getElementById('edit-add-day-btn');
  const saveBtn = document.getElementById('save-program-btn');
  const deleteBtn = document.getElementById('delete-program-btn');
  const regenerateBtn = document.getElementById('regenerate-program-btn');
  const daysContainer = document.getElementById('edit-program-days-container');

  addDayBtn.addEventListener('click', () => {
    addProgramDayCard(daysContainer, null, { showLockButtons: !!generatorSettings });
  });

  regenerateBtn.addEventListener('click', () => {
    if (!generatorSettings) return;

    const lockedExercises = collectLockedExercises(daysContainer);
    const program = regenerateWithLocks(generatorSettings, lockedExercises);

    // Re-populate with new exercises, preserving locks
    const nameInput = document.getElementById('edit-program-name');
    nameInput.value = program.name;
    daysContainer.innerHTML = '';

    program.days.forEach(day => {
      addProgramDayCardWithLocks(daysContainer, day.exercises, day.locked);
    });

    showToast('Program regenerated');
  });

  saveBtn.addEventListener('click', async () => {
    const name = document.getElementById('edit-program-name').value.trim();
    const days = collectProgramDays(daysContainer);

    const validation = validateProgram(name, days);
    if (!validation.isValid) {
      showToast(validation.error);
      return;
    }

    if (state.editingProgramId) {
      // Update existing program
      await updateProgram(state.editingProgramId, name, days);
      showToast('Program updated');
    } else {
      // Create new program
      await createProgram(name, days);
      showToast('Program created');
      switchToProgramsSubTab('list-programs');
    }

    closeEditProgramModal();
    await refreshProgramUI();
  });

  deleteBtn.addEventListener('click', async () => {
    if (confirm('Delete this program?')) {
      await deleteProgram(state.editingProgramId);
      showToast('Program deleted');
      closeEditProgramModal();
      await refreshProgramUI();
    }
  });
}

// =============================================================================
// PROGRAM DAY CARDS
// =============================================================================

function addProgramDayCard(container, existingExercises = null, options = {}) {
  const { showLockButtons = false } = options;
  const dayNumber = container.children.length + 1;
  const card = document.createElement('div');
  card.className = 'program-day-card card card--inset';

  card.innerHTML = `
    <div class="program-day-header">
      <span class="program-day-label">Day ${dayNumber}</span>
      <button type="button" class="btn danger sm">Remove</button>
    </div>
    <div class="program-day-exercises"></div>
    <button type="button" class="btn outline-accent full add-exercise-btn">+ Add exercise</button>
  `;

  const exercisesContainer = card.querySelector('.program-day-exercises');
  const addExerciseBtn = card.querySelector('.add-exercise-btn');

  const addExerciseTag = (exerciseName, locked = false) => {
    const currentExercises = Array.from(exercisesContainer.querySelectorAll('.exercise-tag .exercise-name'))
      .map(span => span.textContent.toLowerCase());
    if (currentExercises.includes(exerciseName.toLowerCase())) {
      showToast('Exercise already added');
      return false;
    }

    // Look up exercise details
    const exerciseData = state.exercisesDB.find(
      ex => ex.name.toLowerCase() === exerciseName.toLowerCase()
    );

    const exerciseTag = document.createElement('div');
    exerciseTag.className = 'exercise-tag exercise-tag--detailed tappable';
    if (locked) exerciseTag.classList.add('locked');

    const lockButton = showLockButtons
      ? `<button type="button" class="lock-exercise-btn" title="Lock exercise">${locked ? '🔒' : '🔓'}</button>`
      : '';

    // Build detail rows if exercise data found
    let detailsHtml = '';
    if (exerciseData) {
      const muscleGroup = exerciseData.muscle_group || '';
      const primaryMuscles = (exerciseData.primary_muscles || []).join(', ');
      const secondaryMuscles = (exerciseData.secondary_muscles || []).join(', ');
      const movementPattern = exerciseData.movement_pattern || '';
      const role = exerciseData.role || '';
      const typeLabel = [movementPattern, role].filter(Boolean).join(', ');

      detailsHtml = `
        <div class="exercise-details">
          <div class="exercise-detail"><span class="detail-label">Group:</span> ${muscleGroup}</div>
          <div class="exercise-detail"><span class="detail-label">Primary:</span> ${primaryMuscles}</div>
          ${secondaryMuscles ? `<div class="exercise-detail"><span class="detail-label">Secondary:</span> ${secondaryMuscles}</div>` : ''}
          <div class="exercise-detail"><span class="detail-label">Type:</span> ${typeLabel}</div>
        </div>
      `;
    }

    exerciseTag.innerHTML = `
      <div class="exercise-tag-header">
        ${lockButton}
        <span class="exercise-name">${exerciseName}</span>
        <button type="button" class="remove-exercise-btn">&times;</button>
      </div>
      ${detailsHtml}
    `;

    const nameSpan = exerciseTag.querySelector('.exercise-name');
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      showExerciseInfo(exerciseName);
    });

    if (showLockButtons) {
      const lockBtn = exerciseTag.querySelector('.lock-exercise-btn');
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exerciseTag.classList.toggle('locked');
        lockBtn.textContent = exerciseTag.classList.contains('locked') ? '🔒' : '🔓';
      });
    }

    exerciseTag.querySelector('.remove-exercise-btn').addEventListener('click', () => {
      exerciseTag.remove();
    });

    exercisesContainer.appendChild(exerciseTag);
    return true;
  };

  if (existingExercises) {
    existingExercises.forEach(name => addExerciseTag(name, false));
  }

  addExerciseBtn.addEventListener('click', () => {
    openExercisePicker((name) => {
      addExerciseTag(name, false);
    });
  });

  card.querySelector('.btn.danger').addEventListener('click', () => {
    card.remove();
    renumberProgramDays(container);
  });

  container.appendChild(card);
}

function renumberProgramDays(container) {
  container.querySelectorAll('.program-day-card').forEach((card, index) => {
    card.querySelector('.program-day-label').textContent = `Day ${index + 1}`;
  });
}

/**
 * Add a program day card with lock state for each exercise.
 */
function addProgramDayCardWithLocks(container, exercises, lockedStates) {
  const dayNumber = container.children.length + 1;
  const card = document.createElement('div');
  card.className = 'program-day-card card card--inset';

  card.innerHTML = `
    <div class="program-day-header">
      <span class="program-day-label">Day ${dayNumber}</span>
      <button type="button" class="btn danger sm">Remove</button>
    </div>
    <div class="program-day-exercises"></div>
    <button type="button" class="btn outline-accent full add-exercise-btn">+ Add exercise</button>
  `;

  const exercisesContainer = card.querySelector('.program-day-exercises');
  const addExerciseBtn = card.querySelector('.add-exercise-btn');

  const addExerciseTag = (exerciseName, locked) => {
    // Look up exercise details
    const exerciseData = state.exercisesDB.find(
      ex => ex.name.toLowerCase() === exerciseName.toLowerCase()
    );

    const exerciseTag = document.createElement('div');
    exerciseTag.className = 'exercise-tag exercise-tag--detailed tappable';
    if (locked) exerciseTag.classList.add('locked');

    // Build detail rows if exercise data found
    let detailsHtml = '';
    if (exerciseData) {
      const muscleGroup = exerciseData.muscle_group || '';
      const primaryMuscles = (exerciseData.primary_muscles || []).join(', ');
      const secondaryMuscles = (exerciseData.secondary_muscles || []).join(', ');
      const movementPattern = exerciseData.movement_pattern || '';
      const role = exerciseData.role || '';
      const typeLabel = [movementPattern, role].filter(Boolean).join(', ');

      detailsHtml = `
        <div class="exercise-details">
          <div class="exercise-detail"><span class="detail-label">Group:</span> ${muscleGroup}</div>
          <div class="exercise-detail"><span class="detail-label">Primary:</span> ${primaryMuscles}</div>
          ${secondaryMuscles ? `<div class="exercise-detail"><span class="detail-label">Secondary:</span> ${secondaryMuscles}</div>` : ''}
          <div class="exercise-detail"><span class="detail-label">Type:</span> ${typeLabel}</div>
        </div>
      `;
    }

    exerciseTag.innerHTML = `
      <div class="exercise-tag-header">
        <button type="button" class="lock-exercise-btn" title="Lock exercise">${locked ? '🔒' : '🔓'}</button>
        <span class="exercise-name">${exerciseName}</span>
        <button type="button" class="remove-exercise-btn">&times;</button>
      </div>
      ${detailsHtml}
    `;

    const nameSpan = exerciseTag.querySelector('.exercise-name');
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      showExerciseInfo(exerciseName);
    });

    const lockBtn = exerciseTag.querySelector('.lock-exercise-btn');
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exerciseTag.classList.toggle('locked');
      lockBtn.textContent = exerciseTag.classList.contains('locked') ? '🔒' : '🔓';
    });

    exerciseTag.querySelector('.remove-exercise-btn').addEventListener('click', () => {
      exerciseTag.remove();
    });

    exercisesContainer.appendChild(exerciseTag);
  };

  exercises.forEach((name, i) => {
    addExerciseTag(name, lockedStates[i] || false);
  });

  addExerciseBtn.addEventListener('click', () => {
    openExercisePicker((name) => {
      addExerciseTag(name, false);
    });
  });

  card.querySelector('.btn.danger').addEventListener('click', () => {
    card.remove();
    renumberProgramDays(container);
  });

  container.appendChild(card);
}

/**
 * Collect locked exercises from the current modal state.
 * Returns array of { exercises: string[], locked: boolean[] } per day.
 */
function collectLockedExercises(container) {
  const days = [];
  container.querySelectorAll('.program-day-card').forEach(card => {
    const exercises = [];
    const locked = [];
    card.querySelectorAll('.exercise-tag').forEach(tag => {
      const name = tag.querySelector('.exercise-name').textContent;
      exercises.push(name);
      locked.push(tag.classList.contains('locked'));
    });
    days.push({ exercises, locked });
  });
  return days;
}

/**
 * Regenerate program keeping locked exercises in place.
 */
function regenerateWithLocks(settings, lockedDays) {
  const { daysPerWeek, equipment, difficulty, goal = 'growth' } = settings;
  const template = PROGRAM_TEMPLATES[daysPerWeek];
  if (!template) {
    throw new Error(`Invalid days per week: ${daysPerWeek}`);
  }

  const exercises = state.exercisesDB;
  const usedExercises = new Set();

  // First pass: collect all locked exercise IDs to exclude them from selection
  lockedDays.forEach(day => {
    day.exercises.forEach((name, i) => {
      if (day.locked[i]) {
        const ex = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
        if (ex) usedExercises.add(ex.id);
      }
    });
  });

  const days = template.days.map((dayTemplate, dayIndex) => {
    const existingDay = lockedDays[dayIndex] || { exercises: [], locked: [] };
    const dayExercises = [];
    const dayLocked = [];

    // Keep locked exercises in their positions
    const lockedPositions = new Map();
    existingDay.exercises.forEach((name, i) => {
      if (existingDay.locked[i]) {
        lockedPositions.set(i, name);
      }
    });

    // Sort muscles by the defined order
    const sortedMuscles = [...dayTemplate.muscles].sort(
      (a, b) => MUSCLE_ORDER.indexOf(a) - MUSCLE_ORDER.indexOf(b)
    );

    // Target based on goal and muscle count (see docs/volume-guidelines.md)
    const muscleCount = dayTemplate.muscles.length;
    const targetExercises = goal === 'maintenance'
      ? Math.max(3, muscleCount)
      : Math.min(6, muscleCount + 2);
    const maxExercises = 6;

    // First pass: select compound/basic exercises for each muscle group
    let positionIndex = 0;
    for (const muscle of sortedMuscles) {
      if (dayExercises.length >= maxExercises) break;

      // Check if this position has a locked exercise
      if (lockedPositions.has(positionIndex)) {
        dayExercises.push(lockedPositions.get(positionIndex));
        dayLocked.push(true);
        positionIndex++;
        continue;
      }

      const exercise = selectExercise(
        exercises,
        muscle,
        equipment,
        difficulty,
        usedExercises
      );

      if (exercise) {
        dayExercises.push(exercise.name);
        dayLocked.push(false);
        usedExercises.add(exercise.id);
      }
      positionIndex++;
    }

    // Second pass: fill to target with auxiliary/isolation exercises
    let muscleIndex = 0;
    while (dayExercises.length < targetExercises && dayExercises.length < maxExercises) {
      const muscle = sortedMuscles[muscleIndex % sortedMuscles.length];
      const exercise = selectAuxiliaryExercise(
        exercises,
        muscle,
        equipment,
        difficulty,
        usedExercises
      );

      if (exercise) {
        dayExercises.push(exercise.name);
        dayLocked.push(false);
        usedExercises.add(exercise.id);
      }
      muscleIndex++;

      // Prevent infinite loop if no more exercises available
      if (muscleIndex >= sortedMuscles.length * 3) break;
    }

    return { name: dayTemplate.name, exercises: dayExercises, locked: dayLocked };
  });

  return {
    name: template.name,
    days
  };
}

// =============================================================================
// PROGRAM SELECTOR
// =============================================================================

export async function populateProgramSelector() {
  const select = document.getElementById('current-program');
  const programName = document.getElementById('current-program-name');
  const workoutForm = document.getElementById('workout-form');
  const programSelector = document.querySelector('.program-selector');
  const noPrograms = document.getElementById('no-programs-message');
  const programs = await getAllPrograms();
  let activeProgram = await getActiveProgram();

  if (programs.length === 0) {
    swapVisibility(noPrograms, programSelector);
    workoutForm.classList.add('hidden');
    return;
  }

  swapVisibility(programSelector, noPrograms);
  workoutForm.classList.remove('hidden');

  select.innerHTML = programs.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('');

  if (!activeProgram && programs.length > 0) {
    await setActiveProgram(programs[0].id);
    activeProgram = programs[0];
  }

  select.value = activeProgram.id;
  programName.textContent = activeProgram.name;
}

export async function updateDaySelector() {
  const programSelect = document.getElementById('current-program');
  const daySelectorGroup = document.getElementById('day-selector-group');
  const suggestedDay = document.getElementById('suggested-day');
  const daySelect = document.getElementById('current-day');

  const programId = programSelect.value;

  if (!programId) {
    daySelectorGroup.classList.add('hidden');
    return;
  }

  daySelectorGroup.classList.remove('hidden');

  const program = await getProgram(programId);
  if (!program) return;

  const nextDay = await getNextDayNumber(programId);
  suggestedDay.textContent = `Day ${nextDay}`;
  suggestedDay.dataset.day = nextDay;

  const dayCount = getProgramDayCount(program);
  daySelect.innerHTML = '';
  for (let i = 1; i <= dayCount; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Day ${i}`;
    if (i === nextDay) option.selected = true;
    daySelect.appendChild(option);
  }

  daySelect.classList.add('hidden');
  suggestedDay.parentElement.classList.remove('hidden');
  document.getElementById('change-day-btn').textContent = 'Change';
}

// =============================================================================
// PROGRAMS LIST
// =============================================================================

let programsListInitialized = false;

export async function renderProgramsList(refreshProgramUI) {
  const container = document.getElementById('programs-list');
  const programs = await getAllPrograms();
  const activeProgram = await getActiveProgram();

  if (programs.length === 0) {
    container.innerHTML = '<p class="empty-message">No programs yet. Create one in the "Create new" tab.</p>';
    return;
  }

  container.innerHTML = programs.map(program => {
    const dayCount = getProgramDayCount(program);
    const daysPreview = program.days
      ? program.days.map((day, i) => `<div class="program-day-preview"><strong>Day ${i + 1}</strong><span class="exercises">${day.exercises.join(', ')}</span></div>`).join('')
      : '';

    const isActive = activeProgram?.id === program.id;
    return `
      <div class="program-card card ${isActive ? 'card--active expanded' : ''}" data-id="${program.id}">
        <div class="program-header">
          <div class="program-header-left">
            <span class="expand-icon">▶</span>
            <h4 class="program-name">${program.name}</h4>
          </div>
          <span class="program-days">${dayCount} day${dayCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="program-details">
          ${daysPreview ? `<div class="program-days-preview">${daysPreview}</div>` : ''}
          <div class="program-actions">
            <button class="btn accent activate-btn" ${isActive ? 'disabled' : ''}>
              ${isActive ? 'Active' : 'Set active'}
            </button>
            <button class="btn edit-btn">Edit</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Set up event delegation once
  if (!programsListInitialized) {
    programsListInitialized = true;
    container.addEventListener('click', async (e) => {
      const card = e.target.closest('.program-card');
      if (!card) return;

      const id = card.dataset.id;

      // Header click - toggle expand
      if (e.target.closest('.program-header')) {
        card.classList.toggle('expanded');
        return;
      }

      // Activate button
      if (e.target.closest('.activate-btn')) {
        e.stopPropagation();

        const exercisesContainer = document.getElementById('exercises-container');
        if (hasUnsavedWorkoutData(exercisesContainer)) {
          const result = await showWorkoutSwitchDialogPromise();
          if (result === 'cancel') return;
          if (result === 'save') {
            document.getElementById('workout-form').requestSubmit();
          }
        }

        await setActiveProgram(id);
        await refreshProgramUI();

        exercisesContainer.innerHTML = '';
        await loadTemplate();

        showToast('Program activated');
        return;
      }

      // Edit button
      if (e.target.closest('.edit-btn')) {
        e.stopPropagation();
        const program = await getProgram(id);
        if (program) {
          openEditProgramModal(program);
        }
      }
    });
  }
}

// =============================================================================
// REFRESH HELPER
// =============================================================================

export async function refreshProgramUI() {
  await Promise.all([
    renderProgramsList(refreshProgramUI),
    populateProgramSelector()
  ]);
  await updateDaySelector();
}
