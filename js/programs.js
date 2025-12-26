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

  const createBtn = document.getElementById('create-program-btn');
  const nameInput = document.getElementById('new-program-name');
  const addDayBtn = document.getElementById('add-program-day-btn');
  const daysContainer = document.getElementById('program-days-container');

  addDayBtn.addEventListener('click', () => {
    addProgramDayCard(daysContainer);
  });

  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const days = collectProgramDays(daysContainer);

    const validation = validateProgram(name, days);
    if (!validation.isValid) {
      showToast(validation.error);
      return;
    }

    await createProgram(name, days);
    showToast('Program created');
    clearProgramForm();
    await refreshProgramUI();
  });

  renderProgramsList(refreshProgramUI);
}

function clearProgramForm() {
  const nameInput = document.getElementById('new-program-name');
  const daysContainer = document.getElementById('program-days-container');

  nameInput.value = '';
  daysContainer.innerHTML = '';
  switchToProgramsSubTab('list-programs');
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
  const nameInput = document.getElementById('edit-program-name');
  const daysContainer = document.getElementById('edit-program-days-container');

  nameInput.value = program.name;
  daysContainer.innerHTML = '';

  if (program.days) {
    program.days.forEach(day => {
      addProgramDayCard(daysContainer, day.exercises);
    });
  }

  state.editProgramDialog.open();
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
  const daysContainer = document.getElementById('edit-program-days-container');

  addDayBtn.addEventListener('click', () => {
    addProgramDayCard(daysContainer);
  });

  saveBtn.addEventListener('click', async () => {
    const name = document.getElementById('edit-program-name').value.trim();
    const days = collectProgramDays(daysContainer);

    const validation = validateProgram(name, days);
    if (!validation.isValid) {
      showToast(validation.error);
      return;
    }

    await updateProgram(state.editingProgramId, name, days);
    showToast('Program updated');
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

  const addExerciseTag = (exerciseName) => {
    const currentExercises = Array.from(exercisesContainer.querySelectorAll('.exercise-tag span'))
      .map(span => span.textContent.toLowerCase());
    if (currentExercises.includes(exerciseName.toLowerCase())) {
      showToast('Exercise already added');
      return false;
    }

    const exerciseTag = document.createElement('div');
    exerciseTag.className = 'exercise-tag tappable';
    exerciseTag.innerHTML = `
      <span>${exerciseName}</span>
      <button type="button" class="remove-exercise-btn">&times;</button>
    `;

    const nameSpan = exerciseTag.querySelector('span');
    nameSpan.addEventListener('click', (e) => {
      e.stopPropagation();
      showExerciseInfo(exerciseName);
    });

    exerciseTag.querySelector('.remove-exercise-btn').addEventListener('click', () => {
      exerciseTag.remove();
    });

    exercisesContainer.appendChild(exerciseTag);
    return true;
  };

  if (existingExercises) {
    existingExercises.forEach(name => addExerciseTag(name));
  }

  addExerciseBtn.addEventListener('click', () => {
    openExercisePicker((name) => {
      addExerciseTag(name);
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

  // Use event delegation for program cards
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
