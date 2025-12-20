// =============================================================================
// DATABASE SETUP
// =============================================================================

const db = new Dexie('HealthTracker');
db.version(1).stores({
  journals: 'date'
});
db.version(2).stores({
  journals: 'date',
  programs: 'id, name'
}).upgrade(tx => {
  return tx.table('journals').toCollection().modify(journal => {
    if (journal.workout) {
      journal.workout.programId = null;
      journal.workout.dayNumber = null;
    }
  });
});

// =============================================================================
// CONSTANTS
// =============================================================================

const MEASUREMENT_FIELDS = [
  'weight', 'neck', 'chest', 'leftBiceps', 'rightBiceps',
  'waist', 'hips', 'leftQuadriceps', 'rightQuadriceps',
  'leftCalf', 'rightCalf'
];

const MEASUREMENT_LABELS = {
  weight: 'Weight',
  neck: 'Neck',
  chest: 'Chest',
  leftBiceps: 'L Biceps',
  rightBiceps: 'R Biceps',
  waist: 'Waist',
  hips: 'Hips',
  leftQuadriceps: 'L Quad',
  rightQuadriceps: 'R Quad',
  leftCalf: 'L Calf',
  rightCalf: 'R Calf'
};

// Exercise database
let exercisesDB = [];

async function loadExercisesDB() {
  try {
    const response = await fetch('data/exercises.json');
    const data = await response.json();
    exercisesDB = data.exercises || [];
  } catch (err) {
    console.error('Failed to load exercises database:', err);
  }
}

function getUniqueValues(field) {
  const values = new Set();
  exercisesDB.forEach(ex => {
    if (ex[field]) values.add(ex[field]);
  });
  return Array.from(values).sort();
}

// =============================================================================
// PROGRAM CRUD
// =============================================================================

let isInitializing = false;
async function createProgram(name, days) {
  const program = {
    id: Date.now().toString(),
    name: name.trim(),
    days: days,
    createdAt: new Date().toISOString()
  };
  await db.programs.add(program);
  return program;
}

function getProgramDayCount(program) {
  return program.days?.length || program.dayCount || 0;
}

async function getAllPrograms() {
  return await db.programs.toArray();
}

async function updateProgram(id, name, days) {
  await db.programs.update(id, {
    name: name.trim(),
    days: days
  });
}

async function deleteProgram(id) {
  const wasActive = await getActiveProgram();
  if (wasActive?.id === id) {
    localStorage.removeItem('activeProgramId');
  }
  await db.programs.delete(id);
}

async function getActiveProgram() {
  const id = localStorage.getItem('activeProgramId');
  if (!id) return null;
  return db.programs.get(id);
}

async function refreshProgramUI() {
  await renderProgramsList();
  await populateProgramSelector();
  await updateDaySelector();
}

async function setActiveProgram(id) {
  if (id) {
    localStorage.setItem('activeProgramId', id);
  } else {
    localStorage.removeItem('activeProgramId');
  }
}

async function getNextDayNumber(programId) {
  if (!programId) return null;

  const program = await db.programs.get(programId);
  if (!program) return 1;

  const dayCount = getProgramDayCount(program);
  if (dayCount === 0) return 1;

  const journals = await getRecentJournals();
  for (const journal of journals) {
    if (journal.workout?.programId === programId && journal.workout?.dayNumber) {
      return (journal.workout.dayNumber % dayCount) + 1;
    }
  }

  return 1;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await requestPersistentStorage();
  registerServiceWorker();
  await loadExercisesDB();
  initTabs();
  initMeasurementsForm();
  initWorkoutForm();
  initProgramsPage();
  initExercisePicker();
  initExerciseInfoModal();
  initExportButton();
  await loadTodayData();
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
// UTILITIES
// =============================================================================

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

async function getRecentJournals(includeToday = false) {
  const today = getTodayDate();
  const query = includeToday
    ? db.journals.where('date').belowOrEqual(today)
    : db.journals.where('date').below(today);
  return query.reverse().toArray();
}

async function getTodayJournal() {
  const date = getTodayDate();
  const stored = await db.journals.get(date);
  if (stored) {
    return stored;
  }
  return {
    date: date,
    lastModified: new Date().toISOString(),
    measurements: null,
    workout: null
  };
}

async function saveTodayJournal(journal) {
  journal.lastModified = new Date().toISOString();
  await db.journals.put(journal);
  showToast('Saved');
}

// =============================================================================
// JOURNAL QUERIES
// =============================================================================

async function getMostRecentWorkout(programId = null, dayNumber = null) {
  const journals = await getRecentJournals();

  // First, try to find matching program + day
  if (programId && dayNumber) {
    for (const journal of journals) {
      if (journal.workout?.exercises?.length > 0 &&
          journal.workout.programId === programId &&
          journal.workout.dayNumber === dayNumber) {
        return journal;
      }
    }
  }

  // Fall back to any workout in this program
  if (programId) {
    for (const journal of journals) {
      if (journal.workout?.exercises?.length > 0 &&
          journal.workout.programId === programId) {
        return journal;
      }
    }
  }

  // Fall back to any workout
  for (const journal of journals) {
    if (journal.workout?.exercises?.length > 0) {
      return journal;
    }
  }

  return null;
}

async function loadTemplate() {
  const programId = document.getElementById('current-program').value || null;
  const dayNumber = getCurrentDayNumber();
  const container = document.getElementById('exercises-container');

  if (!programId || !dayNumber) {
    return;
  }

  const program = await db.programs.get(programId);
  if (!program?.days?.[dayNumber - 1]) {
    return;
  }

  // Get previous workout for placeholder data
  const previousJournal = await getMostRecentWorkout(programId, dayNumber);
  const previousExercises = previousJournal?.workout?.exercises || [];

  container.innerHTML = '';
  const templateExercises = program.days[dayNumber - 1].exercises;

  templateExercises.forEach(name => {
    // Find matching previous exercise data
    const previousData = previousExercises.find(e => e.name === name);
    addExerciseCard(container, { name, sets: [] }, {
      fromProgram: true,
      placeholderData: previousData
    });
  });
}

async function getMostRecentMeasurements() {
  const journals = await getRecentJournals(true);
  for (const journal of journals) {
    if (journal.measurements && Object.keys(journal.measurements).length > 0) {
      return journal;
    }
  }
  return null;
}

// =============================================================================
// MEASUREMENTS
// =============================================================================

async function displayPreviousMeasurements() {
  const container = document.getElementById('previous-measurements');
  const dateSpan = document.getElementById('previous-measurements-date');
  const valuesDiv = document.getElementById('previous-measurements-values');

  const journal = await getMostRecentMeasurements();

  if (!journal) {
    container.classList.add('hidden');
    return;
  }

  const measurements = journal.measurements;
  const values = Object.entries(measurements)
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([key, value]) => `<span class="measurement-item"><strong>${MEASUREMENT_LABELS[key] || key}:</strong> ${value}</span>`)
    .join('');

  dateSpan.textContent = journal.date;
  valuesDiv.innerHTML = values;
  container.classList.remove('hidden');
}

async function loadTodayData() {
  isInitializing = true;
  const journal = await getTodayJournal();

  if (journal.measurements) {
    MEASUREMENT_FIELDS.forEach(field => {
      const input = document.getElementById(field);
      if (input && journal.measurements[field] !== undefined) {
        input.value = journal.measurements[field];
      }
    });
  }

  // Populate program selector and day selector
  await populateProgramSelector();
  await updateDaySelector();

  // If today's workout has a program/day, restore that state
  if (journal.workout?.programId) {
    const programSelect = document.getElementById('current-program');
    const programName = document.getElementById('current-program-name');

    // Check if the saved program still exists
    const savedProgramExists = Array.from(programSelect.options).some(
      opt => opt.value === journal.workout.programId
    );

    if (savedProgramExists) {
      programSelect.value = journal.workout.programId;

      // Update displayed program name
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

  if (journal.workout?.exercises?.length > 0) {
    // Load existing workout data
    const container = document.getElementById('exercises-container');
    journal.workout.exercises.forEach(exercise => {
      addExerciseCard(container, exercise);
    });
  } else {
    // Fresh day - auto-load template if program is selected
    const programSelect = document.getElementById('current-program');
    if (programSelect.value) {
      await loadTemplate();
    }
  }

  // Display previous measurements
  await displayPreviousMeasurements();

  // Final sync to ensure UI consistency
  const programSelect = document.getElementById('current-program');
  const programName = document.getElementById('current-program-name');
  const suggestedDay = document.getElementById('suggested-day');

  if (programSelect.value && programSelect.selectedIndex >= 0) {
    const selectedOption = programSelect.options[programSelect.selectedIndex];
    if (selectedOption) {
      programName.textContent = selectedOption.text;
    }
  }

  isInitializing = false;
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

let learnPageInitialized = false;

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const pages = document.querySelectorAll('.page');

  const savedTab = localStorage.getItem('activeTab');
  if (savedTab) {
    tabs.forEach(t => t.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));

    const tab = document.querySelector(`.tab[data-tab="${savedTab}"]`);
    const page = document.getElementById(savedTab);
    if (tab && page) {
      tab.classList.add('active');
      page.classList.add('active');
    }

    // Initialize Learn page if it was the saved tab
    if (savedTab === 'learn' && !learnPageInitialized) {
      learnPageInitialized = true;
      initLearnPage();
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(targetId).classList.add('active');

      localStorage.setItem('activeTab', targetId);

      // Initialize Learn page on first visit
      if (targetId === 'learn' && !learnPageInitialized) {
        learnPageInitialized = true;
        initLearnPage();
      }
    });
  });
}

function initMeasurementsForm() {
  const form = document.getElementById('measurements-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {};

    MEASUREMENT_FIELDS.forEach(field => {
      const value = formData.get(field);
      if (value !== '' && value !== null) {
        data[field] = parseFloat(value);
      }
    });

    const journal = await getTodayJournal();
    journal.measurements = data;
    await saveTodayJournal(journal);
  });
}

// =============================================================================
// WORKOUT MANAGEMENT
// =============================================================================

function hasUnsavedWorkoutData() {
  const container = document.getElementById('exercises-container');
  const cards = container.querySelectorAll('.exercise-card');

  for (const card of cards) {
    const inputs = card.querySelectorAll('.reps-input, .weight-input, .rpe-input');
    for (const input of inputs) {
      if (input.value.trim() !== '') {
        return true;
      }
    }
  }
  return false;
}

function showWorkoutSwitchDialog() {
  return new Promise((resolve) => {
    const dialog = document.getElementById('workout-switch-dialog');
    dialog.classList.remove('hidden');

    const saveBtn = dialog.querySelector('.dialog-save-btn');
    const discardBtn = dialog.querySelector('.dialog-discard-btn');
    const cancelBtn = dialog.querySelector('.dialog-cancel-btn');

    const cleanup = () => {
      dialog.classList.add('hidden');
      saveBtn.removeEventListener('click', onSave);
      discardBtn.removeEventListener('click', onDiscard);
      cancelBtn.removeEventListener('click', onCancel);
    };

    const onSave = () => { cleanup(); resolve('save'); };
    const onDiscard = () => { cleanup(); resolve('discard'); };
    const onCancel = () => { cleanup(); resolve('cancel'); };

    saveBtn.addEventListener('click', onSave);
    discardBtn.addEventListener('click', onDiscard);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function initWorkoutForm() {
  const form = document.getElementById('workout-form');
  const container = document.getElementById('exercises-container');
  const addBtn = document.getElementById('add-exercise');
  const programSelect = document.getElementById('current-program');
  const programName = document.getElementById('current-program-name');
  const changeProgramBtn = document.getElementById('change-program-btn');
  const changeDayBtn = document.getElementById('change-day-btn');
  const daySelect = document.getElementById('current-day');
  const suggestedDay = document.getElementById('suggested-day');

  addBtn.addEventListener('click', () => {
    addExerciseCard(container);
  });

  changeProgramBtn.addEventListener('click', () => {
    if (programSelect.classList.contains('hidden')) {
      programSelect.classList.remove('hidden');
      programName.parentElement.classList.add('hidden');
    } else {
      confirmProgramChange();
    }
  });

  programSelect.addEventListener('change', () => {
    if (isInitializing) return;
    confirmProgramChange();
  });

  async function confirmProgramChange() {
    const previousProgramId = localStorage.getItem('activeProgramId');

    // Check for unsaved workout data
    if (hasUnsavedWorkoutData()) {
      const result = await showWorkoutSwitchDialog();
      if (result === 'cancel') {
        // Restore previous program selection
        programSelect.value = previousProgramId || '';
        programSelect.classList.add('hidden');
        programName.parentElement.classList.remove('hidden');
        return;
      }
      if (result === 'save') {
        form.requestSubmit();
      }
    }

    // Update UI
    programSelect.classList.add('hidden');
    programName.parentElement.classList.remove('hidden');
    const selectedOption = programSelect.options[programSelect.selectedIndex];
    programName.textContent = selectedOption.text;

    await setActiveProgram(programSelect.value || null);
    await updateDaySelector();
    await renderProgramsList();

    // Load template for new program/day
    container.innerHTML = '';
    if (programSelect.value) {
      await loadTemplate();
    }
  }

  changeDayBtn.addEventListener('click', () => {
    if (daySelect.classList.contains('hidden')) {
      daySelect.classList.remove('hidden');
      suggestedDay.parentElement.classList.add('hidden');
    } else {
      confirmDayChange();
    }
  });

  daySelect.addEventListener('change', () => {
    if (isInitializing) return;
    confirmDayChange();
  });

  async function confirmDayChange() {
    const newDay = daySelect.value;

    // Check for unsaved workout data
    if (hasUnsavedWorkoutData()) {
      const result = await showWorkoutSwitchDialog();
      if (result === 'cancel') {
        // Restore previous day selection
        daySelect.value = suggestedDay.dataset.day;
        daySelect.classList.add('hidden');
        suggestedDay.parentElement.classList.remove('hidden');
        return;
      }
      if (result === 'save') {
        form.requestSubmit();
      }
    }

    // Update UI
    daySelect.classList.add('hidden');
    suggestedDay.parentElement.classList.remove('hidden');
    suggestedDay.textContent = `Day ${newDay}`;
    suggestedDay.dataset.day = newDay;

    // Load template for new day
    container.innerHTML = '';
    if (programSelect.value) {
      await loadTemplate();
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const exercises = [];
    const cards = container.querySelectorAll('.exercise-card');

    cards.forEach(card => {
      const name = card.querySelector('.exercise-name').value.trim();
      const sets = [];

      card.querySelectorAll('.set-row').forEach(row => {
        const reps = row.querySelector('.reps-input').value;
        const weight = row.querySelector('.weight-input').value;
        const rpe = row.querySelector('.rpe-input').value;

        sets.push({
          reps: reps !== '' ? parseInt(reps, 10) : null,
          weight: weight !== '' ? parseFloat(weight) : null,
          rpe: rpe !== '' ? parseFloat(rpe) : null
        });
      });

      if (name) {
        exercises.push({ name, sets });
      }
    });

    const programId = document.getElementById('current-program').value || null;
    const dayNumber = getCurrentDayNumber();

    const journal = await getTodayJournal();
    journal.workout = { programId, dayNumber, exercises };
    await saveTodayJournal(journal);
  });
}

// =============================================================================
// PROGRAMS UI
// =============================================================================

let editingProgramId = null;

function initSubTabs() {
  const subTabs = document.querySelectorAll('.sub-tab');
  const subPages = document.querySelectorAll('.sub-page');

  subTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.subtab;

      subTabs.forEach(t => t.classList.remove('active'));
      subPages.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

function switchToSubTab(tabId) {
  const subTabs = document.querySelectorAll('.sub-tab');
  const subPages = document.querySelectorAll('.sub-page');

  subTabs.forEach(t => t.classList.remove('active'));
  subPages.forEach(p => p.classList.remove('active'));

  const tab = document.querySelector(`.sub-tab[data-subtab="${tabId}"]`);
  const page = document.getElementById(tabId);
  if (tab && page) {
    tab.classList.add('active');
    page.classList.add('active');
  }
}

function initProgramsPage() {
  initSubTabs();
  initEditProgramModal();

  const createBtn = document.getElementById('create-program-btn');
  const nameInput = document.getElementById('new-program-name');
  const addDayBtn = document.getElementById('add-program-day-btn');
  const daysContainer = document.getElementById('program-days-container');

  addDayBtn.addEventListener('click', () => {
    addProgramDayCard(daysContainer);
  });

  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();

    if (!name) {
      showToast('Please enter a program name');
      return;
    }

    const days = collectProgramDays(daysContainer);

    if (days.length === 0) {
      showToast('Please add at least one day');
      return;
    }

    const hasEmptyDay = days.some(day => day.exercises.length === 0);
    if (hasEmptyDay) {
      showToast('Each day must have at least one exercise');
      return;
    }

    await createProgram(name, days);
    showToast('Program created');
    clearProgramForm();
    await refreshProgramUI();
  });

  renderProgramsList();
}

function clearProgramForm() {
  const nameInput = document.getElementById('new-program-name');
  const daysContainer = document.getElementById('program-days-container');

  nameInput.value = '';
  daysContainer.innerHTML = '';
  switchToSubTab('list-programs');
}

function openEditProgramModal(program) {
  editingProgramId = program.id;
  const modal = document.getElementById('edit-program-modal');
  const nameInput = document.getElementById('edit-program-name');
  const daysContainer = document.getElementById('edit-program-days-container');

  nameInput.value = program.name;
  daysContainer.innerHTML = '';

  if (program.days) {
    program.days.forEach(day => {
      addProgramDayCard(daysContainer, day.exercises);
    });
  }

  modal.classList.remove('hidden');
}

function closeEditProgramModal() {
  const modal = document.getElementById('edit-program-modal');
  modal.classList.add('hidden');
  editingProgramId = null;
}

function initEditProgramModal() {
  const modal = document.getElementById('edit-program-modal');
  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtn = modal.querySelector('.modal-close');
  const addDayBtn = document.getElementById('edit-add-day-btn');
  const saveBtn = document.getElementById('save-program-btn');
  const deleteBtn = document.getElementById('delete-program-btn');
  const daysContainer = document.getElementById('edit-program-days-container');

  backdrop.addEventListener('click', closeEditProgramModal);
  closeBtn.addEventListener('click', closeEditProgramModal);

  addDayBtn.addEventListener('click', () => {
    addProgramDayCard(daysContainer);
  });

  saveBtn.addEventListener('click', async () => {
    const name = document.getElementById('edit-program-name').value.trim();

    if (!name) {
      showToast('Please enter a program name');
      return;
    }

    const days = collectProgramDays(daysContainer);

    if (days.length === 0) {
      showToast('Please add at least one day');
      return;
    }

    const hasEmptyDay = days.some(day => day.exercises.length === 0);
    if (hasEmptyDay) {
      showToast('Each day must have at least one exercise');
      return;
    }

    await updateProgram(editingProgramId, name, days);
    showToast('Program updated');
    closeEditProgramModal();
    await refreshProgramUI();
  });

  deleteBtn.addEventListener('click', async () => {
    if (confirm('Delete this program?')) {
      await deleteProgram(editingProgramId);
      showToast('Program deleted');
      closeEditProgramModal();
      await refreshProgramUI();
    }
  });
}

function addProgramDayCard(container, existingExercises = null) {
  const dayNumber = container.children.length + 1;
  const card = document.createElement('div');
  card.className = 'program-day-card';

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
    // Check for duplicates
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

    // Tap exercise name to show info
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

  // Pre-populate existing exercises
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

function collectProgramDays(container) {
  const days = [];
  container.querySelectorAll('.program-day-card').forEach(card => {
    const exercises = [];
    card.querySelectorAll('.exercise-tag span').forEach(span => {
      exercises.push(span.textContent);
    });
    days.push({ exercises });
  });
  return days;
}

async function populateProgramSelector() {
  const select = document.getElementById('current-program');
  const programName = document.getElementById('current-program-name');
  const workoutForm = document.getElementById('workout-form');
  const programSelector = document.querySelector('.program-selector');
  const noPrograms = document.getElementById('no-programs-message');
  const programs = await getAllPrograms();
  let activeProgram = await getActiveProgram();

  if (programs.length === 0) {
    noPrograms.classList.remove('hidden');
    programSelector.classList.add('hidden');
    workoutForm.classList.add('hidden');
    return;
  }

  noPrograms.classList.add('hidden');
  programSelector.classList.remove('hidden');
  workoutForm.classList.remove('hidden');

  select.innerHTML = programs.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join('');

  // If no active program, select the first one
  if (!activeProgram && programs.length > 0) {
    await setActiveProgram(programs[0].id);
    activeProgram = programs[0];
  }

  // Always explicitly set the select value and display name
  select.value = activeProgram.id;
  programName.textContent = activeProgram.name;
}

async function updateDaySelector() {
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

  const program = await db.programs.get(programId);
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
  changeDayBtn.textContent = 'Change';
}

function getCurrentDayNumber() {
  const programSelect = document.getElementById('current-program');
  if (!programSelect.value) return null;

  const daySelect = document.getElementById('current-day');
  const suggestedDay = document.getElementById('suggested-day');

  if (!daySelect.classList.contains('hidden')) {
    return parseInt(daySelect.value, 10) || 1;
  }
  return parseInt(suggestedDay.dataset.day, 10) || 1;
}

async function renderProgramsList() {
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
      <div class="program-card ${isActive ? 'active expanded' : ''}" data-id="${program.id}">
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

  container.querySelectorAll('.program-card').forEach(card => {
    const id = card.dataset.id;

    card.querySelector('.program-header').addEventListener('click', () => {
      card.classList.toggle('expanded');
    });

    card.querySelector('.activate-btn').addEventListener('click', async (e) => {
      e.stopPropagation();

      // Check for unsaved workout data
      if (hasUnsavedWorkoutData()) {
        const result = await showWorkoutSwitchDialog();
        if (result === 'cancel') return;
        if (result === 'save') {
          document.getElementById('workout-form').requestSubmit();
        }
      }

      await setActiveProgram(id);
      await refreshProgramUI();

      // Load the new program's workout template
      const container = document.getElementById('exercises-container');
      container.innerHTML = '';
      await loadTemplate();

      showToast('Program activated');
    });

    card.querySelector('.edit-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const program = await db.programs.get(id);
      if (program) {
        openEditProgramModal(program);
      }
    });
  });
}

function addExerciseCard(container, existingData = null, options = {}) {
  const { fromProgram = false, placeholderData = null } = options;
  const card = document.createElement('div');
  card.className = 'exercise-card';
  if (fromProgram) card.dataset.fromProgram = 'true';

  // Build placeholder text from previous data
  const getPlaceholder = (setIndex, field) => {
    if (!placeholderData?.sets?.[setIndex]) {
      if (field === 'reps') return 'Reps';
      if (field === 'weight') return 'Weight';
      return 'RPE';
    }
    const value = placeholderData.sets[setIndex][field];
    if (value !== null && value !== undefined) return value;
    if (field === 'reps') return 'Reps';
    if (field === 'weight') return 'Weight';
    return 'RPE';
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
        <span class="col-label">Reps</span>
        <span class="col-label">Weight</span>
        <span class="col-label col-label-rpe">RPE</span>
      </div>
      <div class="set-row">
        <span class="set-label">Set 1</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(0, 'reps')}" inputmode="numeric">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(0, 'weight')}" inputmode="decimal" step="0.1">
        <input type="number" class="rpe-input" placeholder="${getPlaceholder(0, 'rpe')}" inputmode="decimal" step="0.5" min="1" max="10">
      </div>
      <div class="set-row">
        <span class="set-label">Set 2</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(1, 'reps')}" inputmode="numeric">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(1, 'weight')}" inputmode="decimal" step="0.1">
        <input type="number" class="rpe-input" placeholder="${getPlaceholder(1, 'rpe')}" inputmode="decimal" step="0.5" min="1" max="10">
      </div>
      <div class="set-row">
        <span class="set-label">Set 3</span>
        <input type="number" class="reps-input" placeholder="${getPlaceholder(2, 'reps')}" inputmode="numeric">
        <input type="number" class="weight-input" placeholder="${getPlaceholder(2, 'weight')}" inputmode="decimal" step="0.1">
        <input type="number" class="rpe-input" placeholder="${getPlaceholder(2, 'rpe')}" inputmode="decimal" step="0.5" min="1" max="10">
      </div>
    </div>
  `;

  if (existingData) {
    card.querySelector('.exercise-name').value = existingData.name || '';
    const setRows = card.querySelectorAll('.set-row');
    if (existingData.sets) {
      existingData.sets.forEach((set, i) => {
        if (setRows[i]) {
          if (set.reps !== null) setRows[i].querySelector('.reps-input').value = set.reps;
          if (set.weight !== null) setRows[i].querySelector('.weight-input').value = set.weight;
          if (set.rpe !== null) setRows[i].querySelector('.rpe-input').value = set.rpe;
        }
      });
    }
  }

  // Make exercise name tappable for info (only for program exercises)
  const nameInput = card.querySelector('.exercise-name');
  if (fromProgram) {
    nameInput.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (name) {
        showExerciseInfo(name);
      }
    });
  }

  // Info button to show exercise details
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
// DATA IMPORT/EXPORT
// =============================================================================

function initExportButton() {
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');

  exportBtn.addEventListener('click', exportAllData);

  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (confirm('This will replace all existing data. Continue?')) {
      try {
        await importData(file);
        showToast('Data imported successfully');
      } catch (err) {
        showToast('Import failed: ' + err.message);
      }
    }
    importFile.value = '';
  });
}

async function exportAllData() {
  const programs = await db.programs.toArray();
  const journals = await db.journals.toArray();

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    programs,
    journals
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `health-tracker-backup-${getTodayDate()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.version || !data.programs || !data.journals) {
    throw new Error('Invalid backup file');
  }

  await db.programs.clear();
  await db.journals.clear();

  await db.programs.bulkAdd(data.programs);
  await db.journals.bulkAdd(data.journals);

  localStorage.removeItem('activeProgramId');
  location.reload();
}

// =============================================================================
// EXERCISE PICKER
// =============================================================================

let exercisePickerCallback = null;

function initExercisePicker() {
  const modal = document.getElementById('exercise-picker-modal');
  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtn = modal.querySelector('.modal-close');
  const searchInput = document.getElementById('exercise-search');
  const muscleFilter = document.getElementById('filter-muscle-group');
  const movementFilter = document.getElementById('filter-movement');
  const equipmentFilter = document.getElementById('filter-equipment');

  // Close modal handlers
  backdrop.addEventListener('click', closeExercisePicker);
  closeBtn.addEventListener('click', closeExercisePicker);

  // Filter handlers - update both the list and other filter options
  searchInput.addEventListener('input', updateExercisePicker);
  muscleFilter.addEventListener('change', updateExercisePicker);
  movementFilter.addEventListener('change', updateExercisePicker);
  equipmentFilter.addEventListener('change', updateExercisePicker);
}

function getFilteredExercises() {
  const searchTerm = document.getElementById('exercise-search').value.toLowerCase();
  const muscleValue = document.getElementById('filter-muscle-group').value;
  const movementValue = document.getElementById('filter-movement').value;
  const equipmentValue = document.getElementById('filter-equipment').value;

  return exercisesDB.filter(ex => {
    if (searchTerm && !ex.name.toLowerCase().includes(searchTerm)) return false;
    if (muscleValue && ex.muscle_group !== muscleValue) return false;
    if (movementValue && ex.movement_pattern !== movementValue) return false;
    if (equipmentValue && ex.equipment !== equipmentValue) return false;
    return true;
  });
}

function getAvailableOptions(field, filtered) {
  const values = new Set();
  filtered.forEach(ex => {
    if (ex[field]) values.add(ex[field]);
  });
  return Array.from(values).sort();
}

function updateFilterDropdown(selectId, field, currentFilters) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;

  // Get exercises matching OTHER filters (not this one)
  const otherFilters = { ...currentFilters };
  delete otherFilters[field];

  const matchingExercises = exercisesDB.filter(ex => {
    if (otherFilters.searchTerm && !ex.name.toLowerCase().includes(otherFilters.searchTerm)) return false;
    if (otherFilters.muscle_group && ex.muscle_group !== otherFilters.muscle_group) return false;
    if (otherFilters.movement_pattern && ex.movement_pattern !== otherFilters.movement_pattern) return false;
    if (otherFilters.equipment && ex.equipment !== otherFilters.equipment) return false;
    return true;
  });

  const availableValues = getAvailableOptions(field, matchingExercises);

  // Rebuild options
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

  // If current value is no longer available, reset it
  if (currentValue && !availableValues.includes(currentValue)) {
    select.value = '';
  }
}

function updateExercisePicker() {
  const searchTerm = document.getElementById('exercise-search').value.toLowerCase();
  const muscleValue = document.getElementById('filter-muscle-group').value;
  const movementValue = document.getElementById('filter-movement').value;
  const equipmentValue = document.getElementById('filter-equipment').value;

  const currentFilters = {
    searchTerm: searchTerm || null,
    muscle_group: muscleValue || null,
    movement_pattern: movementValue || null,
    equipment: equipmentValue || null
  };

  // Update each dropdown based on other filters
  updateFilterDropdown('filter-muscle-group', 'muscle_group', currentFilters);
  updateFilterDropdown('filter-movement', 'movement_pattern', currentFilters);
  updateFilterDropdown('filter-equipment', 'equipment', currentFilters);

  // Render the exercise list
  renderExerciseList();
}

function formatLabel(value) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function openExercisePicker(callback) {
  exercisePickerCallback = callback;
  const modal = document.getElementById('exercise-picker-modal');

  // Reset filters
  document.getElementById('exercise-search').value = '';
  document.getElementById('filter-muscle-group').value = '';
  document.getElementById('filter-movement').value = '';
  document.getElementById('filter-equipment').value = '';

  updateExercisePicker();
  modal.classList.remove('hidden');
}

function closeExercisePicker() {
  const modal = document.getElementById('exercise-picker-modal');
  modal.classList.add('hidden');
  exercisePickerCallback = null;
}

function renderExerciseList() {
  const list = document.getElementById('exercise-picker-list');
  const searchTerm = document.getElementById('exercise-search').value.toLowerCase();
  const muscleFilter = document.getElementById('filter-muscle-group').value;
  const movementFilter = document.getElementById('filter-movement').value;
  const equipmentFilter = document.getElementById('filter-equipment').value;

  const filtered = exercisesDB.filter(ex => {
    if (searchTerm && !ex.name.toLowerCase().includes(searchTerm)) return false;
    if (muscleFilter && ex.muscle_group !== muscleFilter) return false;
    if (movementFilter && ex.movement_pattern !== movementFilter) return false;
    if (equipmentFilter && ex.equipment !== equipmentFilter) return false;
    return true;
  });

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

  // Add click handlers
  list.querySelectorAll('.exercise-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const name = item.dataset.name;
      if (exercisePickerCallback) {
        exercisePickerCallback(name);
      }
      closeExercisePicker();
    });
  });
}

// =============================================================================
// EXERCISE INFO MODAL
// =============================================================================

function getExerciseByName(name) {
  return exercisesDB.find(ex =>
    ex.name.toLowerCase() === name.toLowerCase()
  );
}

function initExerciseInfoModal() {
  const modal = document.getElementById('exercise-info-modal');
  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtn = modal.querySelector('.modal-close');

  backdrop.addEventListener('click', closeExerciseInfo);
  closeBtn.addEventListener('click', closeExerciseInfo);
}

function showExerciseInfo(exerciseName) {
  const exercise = getExerciseByName(exerciseName);
  if (!exercise) {
    showToast('Exercise info not found');
    return;
  }

  const modal = document.getElementById('exercise-info-modal');
  const nameEl = document.getElementById('exercise-info-name');
  const contentEl = document.getElementById('exercise-info-content');

  nameEl.textContent = exercise.name;

  let html = '';

  if (exercise.instructions?.length) {
    html += `
      <div class="exercise-info-section instructions">
        <h4>Instructions</h4>
        <ol>
          ${exercise.instructions.map(step => `<li>${step}</li>`).join('')}
        </ol>
      </div>
    `;
  }

  if (exercise.tips?.length) {
    html += `
      <div class="exercise-info-section tips">
        <h4>Tips</h4>
        <ul>
          ${exercise.tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (exercise.avoid?.length) {
    html += `
      <div class="exercise-info-section mistakes">
        <h4>Avoid</h4>
        <ul>
          ${exercise.avoid.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  contentEl.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeExerciseInfo() {
  const modal = document.getElementById('exercise-info-modal');
  modal.classList.add('hidden');
}

function showToast(message) {
  let toast = document.querySelector('.status-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'status-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('visible');

  setTimeout(() => {
    toast.classList.remove('visible');
  }, 2000);
}

// =============================================================================
// LEARN / ARTICLES
// =============================================================================

let articlesData = null;

async function loadArticles() {
  if (articlesData) return articlesData;
  try {
    const response = await fetch('data/articles.json');
    articlesData = await response.json();
    return articlesData;
  } catch (err) {
    console.error('Failed to load articles:', err);
    return { articles: [] };
  }
}

function populateCategoryFilter(articles) {
  const filter = document.getElementById('article-category-filter');
  const categories = [...new Set(articles.map(a => a.category))].filter(Boolean).sort();

  filter.innerHTML = '<option value="">All categories</option>' +
    categories.map(c => `<option value="${c}">${formatLabel(c)}</option>`).join('');
}

function renderArticles(articles) {
  const container = document.getElementById('articles-container');
  const emptyMessage = document.getElementById('no-articles-message');

  if (articles.length === 0) {
    container.innerHTML = '';
    emptyMessage.classList.remove('hidden');
    return;
  }

  emptyMessage.classList.add('hidden');
  container.innerHTML = articles.map(article => `
    <div class="article-card">
      <h3 class="article-title">
        ${article.doi || article.url
          ? `<a href="${article.doi ? `https://doi.org/${article.doi}` : article.url}" target="_blank" rel="noopener">${article.title}</a>`
          : article.title}
      </h3>
      <div class="article-meta">
        ${article.authors.join(', ')} · ${article.journal} (${article.year})
      </div>
      <p class="article-summary">${article.summary || ''}</p>
      <div class="article-takeaways">
        <div class="article-takeaways-label">Key takeaways</div>
        <ul>
          ${article.takeaways.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>
      <span class="article-category">${formatLabel(article.category)}</span>
    </div>
  `).join('');
}

function filterArticles() {
  if (!articlesData) return;

  const category = document.getElementById('article-category-filter').value;
  let filtered = articlesData.articles;

  if (category) {
    filtered = filtered.filter(a => a.category === category);
  }

  renderArticles(filtered);
}

async function initLearnPage() {
  const data = await loadArticles();
  populateCategoryFilter(data.articles);
  renderArticles(data.articles);

  document.getElementById('article-category-filter').addEventListener('change', filterArticles);
}
