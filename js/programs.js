// =============================================================================
// PROGRAMS MODULE
// =============================================================================
// Handles program creation, editing, and listing.

import { state } from './state.js';
import { swapVisibility, formatLabel } from './utils.js';
import { createModalController, showToast } from './ui.js';
import { validateProgram, validateProgramExercises, hasUnsavedWorkoutData, collectProgramDays } from './validation.js';
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
        dayExercises.push(exercise.id);
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
        dayExercises.push(exercise.id);
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
    const aCompound = a.joint_type === 'compound' ? 0 : 1;
    const bCompound = b.joint_type === 'compound' ? 0 : 1;
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
    const aIsolation = a.joint_type === 'isolation' ? 0 : 1;
    const bIsolation = b.joint_type === 'isolation' ? 0 : 1;
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

  // Toggle create-program section visibility
  const createBtn = document.getElementById('create-program-btn');
  const createSection = document.getElementById('create-program');
  createBtn.addEventListener('click', () => {
    createSection.classList.toggle('active');
  });

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
  // Hide create-program section when switching to list view
  if (tabId === 'list-programs') {
    const createSection = document.getElementById('create-program');
    if (createSection) createSection.classList.remove('active');
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
      addProgramDayCard(daysContainer, day.exercises);
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
    addProgramDayCard(daysContainer, null);
  });

  regenerateBtn.addEventListener('click', () => {
    if (!generatorSettings) return;

    const { daysPerWeek, equipment, difficulty, goal } = generatorSettings;
    const program = generateProgram(daysPerWeek, equipment, difficulty, goal);

    const nameInput = document.getElementById('edit-program-name');
    nameInput.value = program.name;
    daysContainer.innerHTML = '';

    program.days.forEach(day => {
      addProgramDayCard(daysContainer, day.exercises);
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

function addProgramDayCard(container, existingExercises = null) {
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

  const addExerciseTag = (exerciseId) => {
    // Check for duplicates by ID
    const currentIds = Array.from(exercisesContainer.querySelectorAll('.exercise-picker-item'))
      .map(tag => tag.dataset.exerciseId);
    if (currentIds.includes(exerciseId)) {
      showToast('Exercise already added');
      return false;
    }

    // Look up exercise details by ID
    const exerciseData = state.exercisesById.get(exerciseId) || null;
    const exerciseName = exerciseData?.name || exerciseId;

    const exerciseTag = document.createElement('div');
    exerciseTag.className = 'exercise-picker-item';
    exerciseTag.dataset.exerciseId = exerciseId;

    const tags = [];
    if (exerciseData?.muscle_group) {
      tags.push(`<span class="exercise-picker-tag muscle">${formatLabel(exerciseData.muscle_group)}</span>`);
    }
    if (exerciseData?.movement_pattern) {
      tags.push(`<span class="exercise-picker-tag movement">${formatLabel(exerciseData.movement_pattern)}</span>`);
    }
    if (exerciseData?.equipment) {
      tags.push(`<span class="exercise-picker-tag equipment">${formatLabel(exerciseData.equipment)}</span>`);
    }
    if (exerciseData?.difficulty) {
      tags.push(`<span class="exercise-picker-tag difficulty">${formatLabel(exerciseData.difficulty)}</span>`);
    }
    const metaHtml = tags.length ? `<div class="exercise-picker-meta">${tags.join('')}</div>` : '';

    exerciseTag.innerHTML = `
      <span class="exercise-picker-name">${exerciseName}</span>
      <button type="button" class="swap-exercise-btn" aria-label="Swap exercise">🔄</button>
      <div class="exercise-picker-row">
        ${metaHtml}
        <button type="button" class="remove-exercise-btn" aria-label="Remove exercise">🗑️</button>
      </div>
    `;

    const nameSpan = exerciseTag.querySelector('.exercise-picker-name');
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      showExerciseInfo(exerciseName);
    });

    exerciseTag.querySelector('.remove-exercise-btn').addEventListener('click', () => {
      if (confirm(`Remove ${exerciseName}?`)) {
        exerciseTag.remove();
      }
    });

    exerciseTag.querySelector('.swap-exercise-btn').addEventListener('click', () => {
      const muscleGroup = exerciseData?.muscle_group || '';
      const movementPattern = exerciseData?.movement_pattern || '';
      const currentName = nameSpan.textContent;
      openExercisePicker(({ id, name }) => {
        if (!confirm(`Swap ${currentName} for ${name}?`)) return;
        exerciseTag.dataset.exerciseId = id;
        const newData = state.exercisesById.get(id) || null;
        nameSpan.textContent = name;
        // Update tags
        const newTags = [];
        if (newData?.muscle_group) {
          newTags.push(`<span class="exercise-picker-tag muscle">${formatLabel(newData.muscle_group)}</span>`);
        }
        if (newData?.movement_pattern) {
          newTags.push(`<span class="exercise-picker-tag movement">${formatLabel(newData.movement_pattern)}</span>`);
        }
        if (newData?.equipment) {
          newTags.push(`<span class="exercise-picker-tag equipment">${formatLabel(newData.equipment)}</span>`);
        }
        if (newData?.difficulty) {
          newTags.push(`<span class="exercise-picker-tag difficulty">${formatLabel(newData.difficulty)}</span>`);
        }
        const metaEl = exerciseTag.querySelector('.exercise-picker-meta');
        if (metaEl) {
          metaEl.innerHTML = newTags.join('');
        }
      }, { muscleGroup, movementPattern, swapMode: true, exerciseName: currentName });
    });

    exercisesContainer.appendChild(exerciseTag);
    return true;
  };

  if (existingExercises) {
    existingExercises.forEach(exerciseId => {
      if (exerciseId) addExerciseTag(exerciseId);
    });
  }

  addExerciseBtn.addEventListener('click', () => {
    openExercisePicker(({ id }) => {
      addExerciseTag(id);
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

// =============================================================================
// PROGRAM SELECTOR
// =============================================================================

export async function populateProgramSelector() {
  const select = document.getElementById('current-program');
  const programName = document.getElementById('current-program-name');
  const changeProgramBtn = document.getElementById('change-program-btn');
  const workoutForm = document.getElementById('workout-form');
  const programSelector = document.querySelector('.program-selector');
  const noPrograms = document.getElementById('no-programs-message');
  const programs = await getAllPrograms();
  let activeProgram = await getActiveProgram();

  // Validate exercise references in all programs (logs warnings for stale references)
  if (state.exercisesById.size > 0) {
    programs.forEach(p => validateProgramExercises(p, state.exercisesById));
  }

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

  // Show swap button only if multiple programs
  changeProgramBtn.classList.toggle('hidden', programs.length <= 1);
}

export async function updateDaySelector() {
  const programSelect = document.getElementById('current-program');
  const daySelectorGroup = document.getElementById('day-selector-group');
  const suggestedDay = document.getElementById('suggested-day');
  const daySelect = document.getElementById('current-day');
  const changeDayBtn = document.getElementById('change-day-btn');

  const programId = programSelect.value;

  if (!programId) {
    daySelectorGroup.classList.add('hidden');
    return;
  }

  daySelectorGroup.classList.remove('hidden');

  const program = await getProgram(programId);
  if (!program) return;

  const nextDay = await getNextDayNumber(programId);
  suggestedDay.textContent = nextDay;
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

  // Show swap button only if multiple days
  changeDayBtn.classList.toggle('hidden', dayCount <= 1);
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
    const daysPreview = program.days
      ? program.days.map((day, i) => {
          const exerciseItems = (day.exercises || []).map(exId => {
            // Look up exercise by ID to get the display name and metadata
            const id = typeof exId === 'string' ? exId : exId?.id || exId?.name;
            if (!id) return '';
            const exerciseData = state.exercisesById.get(id);
            const displayName = exerciseData?.name || id;

            const tags = [];
            if (exerciseData?.muscle_group) {
              tags.push(`<span class="exercise-picker-tag muscle">${formatLabel(exerciseData.muscle_group)}</span>`);
            }
            if (exerciseData?.movement_pattern) {
              tags.push(`<span class="exercise-picker-tag movement">${formatLabel(exerciseData.movement_pattern)}</span>`);
            }
            if (exerciseData?.equipment) {
              tags.push(`<span class="exercise-picker-tag equipment">${formatLabel(exerciseData.equipment)}</span>`);
            }
            if (exerciseData?.difficulty) {
              tags.push(`<span class="exercise-picker-tag difficulty">${formatLabel(exerciseData.difficulty)}</span>`);
            }
            const metaHtml = tags.length ? `<div class="exercise-picker-meta">${tags.join('')}</div>` : '';

            return `
              <div class="exercise-picker-item exercise-preview" data-exercise-id="${id}">
                <span class="exercise-picker-name">${displayName}</span>
                <div class="exercise-picker-row">
                  ${metaHtml}
                </div>
              </div>
            `;
          }).filter(Boolean).join('');
          const exerciseCount = (day.exercises || []).length;
          return `<div class="program-day-preview">
            <h3 class="day-heading"><span class="expand-icon">▶</span>Day ${i + 1}<span class="exercise-count">${exerciseCount}</span></h3>
            <div class="day-exercises">${exerciseItems}</div>
          </div>`;
        }).join('')
      : '';

    const isActive = activeProgram?.id === program.id;
    const activeStatus = isActive
      ? '<span class="active-badge">Active</span>'
      : '<button class="btn outline-accent sm activate-btn">Set active</button>';

    return `
      <div class="program-card card ${isActive ? 'card--active expanded' : ''}" data-id="${program.id}">
        <div class="program-header">
          <div class="program-header-left">
            <span class="expand-icon">▶</span>
            <h2 class="program-name">${program.name}</h2>
          </div>
          <div class="program-header-right">
            ${activeStatus}
            <button class="edit-btn" aria-label="Edit program">✏️</button>
          </div>
        </div>
        <div class="program-details">
          ${daysPreview ? `<div class="program-days-preview">${daysPreview}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Set up event delegation once
  if (!programsListInitialized) {
    programsListInitialized = true;
    container.addEventListener('click', async (e) => {
      // Exercise name click - show exercise info
      if (e.target.closest('.exercise-picker-name')) {
        const exerciseItem = e.target.closest('.exercise-preview');
        if (exerciseItem) {
          e.stopPropagation();
          const exerciseId = exerciseItem.dataset.exerciseId;
          const exerciseData = state.exercisesById.get(exerciseId);
          showExerciseInfo(exerciseData?.name || exerciseId);
          return;
        }
      }

      // Day heading click - toggle day expanded
      if (e.target.closest('.day-heading')) {
        const dayPreview = e.target.closest('.program-day-preview');
        if (dayPreview) {
          e.stopPropagation();
          dayPreview.classList.toggle('expanded');
          return;
        }
      }

      const card = e.target.closest('.program-card');
      if (!card) return;

      const id = card.dataset.id;

      // Edit button (check before header)
      if (e.target.closest('.edit-btn')) {
        e.stopPropagation();
        const program = await getProgram(id);
        if (program) {
          openEditProgramModal(program);
        }
        return;
      }

      // Activate button (check before header)
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

      // Header click - toggle expand
      if (e.target.closest('.program-header')) {
        card.classList.toggle('expanded');
        return;
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
