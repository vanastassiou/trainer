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

// Program CRUD functions
async function createProgram(name, days) {
  const program = {
    id: Date.now().toString(),
    name: name.trim(),
    days: days,  // Array of { exercises: ['Exercise 1', 'Exercise 2', ...] }
    createdAt: new Date().toISOString(),
    isActive: false
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

function getActiveProgram() {
  const id = localStorage.getItem('activeProgramId');
  if (!id) return Promise.resolve(null);
  return db.programs.get(id);
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

  const today = getTodayDate();
  const journals = await db.journals
    .where('date')
    .below(today)
    .reverse()
    .toArray();

  for (const journal of journals) {
    if (journal.workout?.programId === programId && journal.workout?.dayNumber) {
      return (journal.workout.dayNumber % dayCount) + 1;
    }
  }

  return 1;
}

document.addEventListener('DOMContentLoaded', async () => {
  await requestPersistentStorage();
  registerServiceWorker();
  initTabs();
  initMeasurementsForm();
  initWorkoutForm();
  initProgramsPage();
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

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
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

async function getMostRecentWorkout(programId = null, dayNumber = null) {
  const today = getTodayDate();
  const journals = await db.journals
    .where('date')
    .below(today)
    .reverse()
    .toArray();

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

async function copyPreviousWorkout() {
  const programId = document.getElementById('current-program').value || null;
  const dayNumber = getCurrentDayNumber();

  const previousJournal = await getMostRecentWorkout(programId, dayNumber);
  const container = document.getElementById('exercises-container');
  container.innerHTML = '';

  if (previousJournal) {
    previousJournal.workout.exercises.forEach(exercise => {
      addExerciseCard(container, exercise);
    });

    const dayInfo = previousJournal.workout.dayNumber ? ` (Day ${previousJournal.workout.dayNumber})` : '';
    showToast(`Copied from ${previousJournal.date}${dayInfo}`);
    return;
  }

  // Fall back to program template if no previous workout
  if (programId && dayNumber) {
    const program = await db.programs.get(programId);
    if (program?.days?.[dayNumber - 1]) {
      const templateExercises = program.days[dayNumber - 1].exercises;
      templateExercises.forEach(name => {
        addExerciseCard(container, { name, sets: [] });
      });
      showToast('Loaded from program template');
      return;
    }
  }

  showToast('No previous workout found');
}

async function loadTodayData() {
  const journal = await getTodayJournal();

  if (journal.measurements) {
    const fields = [
      'weight', 'neck', 'chest', 'leftBiceps', 'rightBiceps',
      'waist', 'hips', 'leftQuadriceps', 'rightQuadriceps',
      'leftCalf', 'rightCalf'
    ];
    fields.forEach(field => {
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
    programSelect.value = journal.workout.programId;
    await updateDaySelector();

    if (journal.workout.dayNumber) {
      const suggestedDay = document.getElementById('suggested-day');
      const daySelect = document.getElementById('current-day');
      suggestedDay.textContent = `Day ${journal.workout.dayNumber}`;
      suggestedDay.dataset.day = journal.workout.dayNumber;
      daySelect.value = journal.workout.dayNumber;
    }
  }

  if (journal.workout && journal.workout.exercises) {
    const container = document.getElementById('exercises-container');
    journal.workout.exercises.forEach(exercise => {
      addExerciseCard(container, exercise);
    });
  }
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const pages = document.querySelectorAll('.page');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

function initMeasurementsForm() {
  const form = document.getElementById('measurements-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {};

    const fields = [
      'weight', 'neck', 'chest', 'leftBiceps', 'rightBiceps',
      'waist', 'hips', 'leftQuadriceps', 'rightQuadriceps',
      'leftCalf', 'rightCalf'
    ];

    fields.forEach(field => {
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

function initWorkoutForm() {
  const form = document.getElementById('workout-form');
  const container = document.getElementById('exercises-container');
  const addBtn = document.getElementById('add-exercise');
  const copyBtn = document.getElementById('copy-previous');
  const programSelect = document.getElementById('current-program');
  const changeDayBtn = document.getElementById('change-day-btn');
  const daySelect = document.getElementById('current-day');
  const suggestedDay = document.getElementById('suggested-day');

  addBtn.addEventListener('click', () => {
    addExerciseCard(container);
  });

  copyBtn.addEventListener('click', copyPreviousWorkout);

  programSelect.addEventListener('change', async () => {
    await setActiveProgram(programSelect.value || null);
    await updateDaySelector();
    await renderProgramsList();

    // Auto-populate if no exercises entered yet
    if (container.children.length === 0 && programSelect.value) {
      await copyPreviousWorkout();
    }
  });

  changeDayBtn.addEventListener('click', async () => {
    if (daySelect.classList.contains('hidden')) {
      daySelect.classList.remove('hidden');
      suggestedDay.parentElement.classList.add('hidden');
    } else {
      daySelect.classList.add('hidden');
      suggestedDay.parentElement.classList.remove('hidden');
      suggestedDay.textContent = `Day ${daySelect.value}`;
      suggestedDay.dataset.day = daySelect.value;

      // Auto-populate when day changes if no exercises entered yet
      if (container.children.length === 0) {
        await copyPreviousWorkout();
      }
    }
  });

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

        sets.push({
          reps: reps !== '' ? parseInt(reps, 10) : null,
          weight: weight !== '' ? parseFloat(weight) : null
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

let editingProgramId = null;

function initProgramsPage() {
  const createBtn = document.getElementById('create-program-btn');
  const nameInput = document.getElementById('new-program-name');
  const addDayBtn = document.getElementById('add-program-day-btn');
  const daysContainer = document.getElementById('program-days-container');
  const formTitle = document.querySelector('.add-program-form h3');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  addDayBtn.addEventListener('click', () => {
    addProgramDayCard(daysContainer);
  });

  cancelBtn.addEventListener('click', () => {
    clearProgramForm();
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

    if (editingProgramId) {
      await updateProgram(editingProgramId, name, days);
      showToast('Program updated');
    } else {
      await createProgram(name, days);
      showToast('Program created');
    }

    clearProgramForm();
    await renderProgramsList();
    await populateProgramSelector();
  });

  renderProgramsList();
}

function clearProgramForm() {
  const nameInput = document.getElementById('new-program-name');
  const daysContainer = document.getElementById('program-days-container');
  const formTitle = document.querySelector('.add-program-form h3');
  const createBtn = document.getElementById('create-program-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  editingProgramId = null;
  nameInput.value = '';
  daysContainer.innerHTML = '';
  formTitle.textContent = 'Add Program';
  createBtn.textContent = 'Create Program';
  cancelBtn.classList.add('hidden');
}

function editProgram(program) {
  const nameInput = document.getElementById('new-program-name');
  const daysContainer = document.getElementById('program-days-container');
  const formTitle = document.querySelector('.add-program-form h3');
  const createBtn = document.getElementById('create-program-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  editingProgramId = program.id;
  nameInput.value = program.name;
  formTitle.textContent = 'Edit Program';
  createBtn.textContent = 'Save Program';
  cancelBtn.classList.remove('hidden');

  // Clear and populate days
  daysContainer.innerHTML = '';
  if (program.days) {
    program.days.forEach(day => {
      addProgramDayCard(daysContainer, day.exercises);
    });
  }

  // Scroll to form
  document.querySelector('.add-program-form').scrollIntoView({ behavior: 'smooth' });
}

function addProgramDayCard(container, existingExercises = null) {
  const dayNumber = container.children.length + 1;
  const card = document.createElement('div');
  card.className = 'program-day-card';

  card.innerHTML = `
    <div class="program-day-header">
      <span class="program-day-label">Day ${dayNumber}</span>
      <button type="button" class="remove-day-btn">Remove</button>
    </div>
    <div class="program-day-exercises"></div>
    <div class="add-exercise-row">
      <input type="text" class="new-exercise-input" placeholder="Exercise name">
      <button type="button" class="add-exercise-btn">Add</button>
    </div>
  `;

  const exercisesContainer = card.querySelector('.program-day-exercises');
  const exerciseInput = card.querySelector('.new-exercise-input');
  const addExerciseBtn = card.querySelector('.add-exercise-btn');

  const addExerciseTag = (exerciseName) => {
    const exerciseTag = document.createElement('div');
    exerciseTag.className = 'exercise-tag';
    exerciseTag.innerHTML = `
      <span>${exerciseName}</span>
      <button type="button" class="remove-exercise-btn">&times;</button>
    `;

    exerciseTag.querySelector('.remove-exercise-btn').addEventListener('click', () => {
      exerciseTag.remove();
    });

    exercisesContainer.appendChild(exerciseTag);
  };

  const addExercise = () => {
    const exerciseName = exerciseInput.value.trim();
    if (!exerciseName) return;

    addExerciseTag(exerciseName);
    exerciseInput.value = '';
    exerciseInput.focus();
  };

  // Pre-populate existing exercises
  if (existingExercises) {
    existingExercises.forEach(name => addExerciseTag(name));
  }

  addExerciseBtn.addEventListener('click', addExercise);
  exerciseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addExercise();
    }
  });

  card.querySelector('.remove-day-btn').addEventListener('click', () => {
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
  const programs = await getAllPrograms();
  const activeProgram = await getActiveProgram();

  select.innerHTML = '<option value="">Freestyle</option>' +
    programs.map(p => `<option value="${p.id}" ${activeProgram?.id === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
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
    return parseInt(daySelect.value, 10);
  }
  return parseInt(suggestedDay.dataset.day, 10);
}

async function renderProgramsList() {
  const container = document.getElementById('programs-list');
  const programs = await getAllPrograms();
  const activeProgram = await getActiveProgram();

  if (programs.length === 0) {
    container.innerHTML = '<p class="empty-message">No programs yet. Create one below.</p>';
    return;
  }

  container.innerHTML = programs.map(program => {
    const dayCount = getProgramDayCount(program);
    const daysPreview = program.days
      ? program.days.map((day, i) => `<div class="program-day-preview"><strong>Day ${i + 1}:</strong> ${day.exercises.join(', ')}</div>`).join('')
      : '';

    return `
      <div class="program-card ${activeProgram?.id === program.id ? 'active' : ''}" data-id="${program.id}">
        <div class="program-header">
          <h4 class="program-name">${program.name}</h4>
          <span class="program-days">${dayCount} day${dayCount !== 1 ? 's' : ''}</span>
        </div>
        ${daysPreview ? `<div class="program-days-preview">${daysPreview}</div>` : ''}
        <div class="program-actions">
          <button class="activate-btn" ${activeProgram?.id === program.id ? 'disabled' : ''}>
            ${activeProgram?.id === program.id ? 'Active' : 'Set Active'}
          </button>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.program-card').forEach(card => {
    const id = card.dataset.id;

    card.querySelector('.activate-btn').addEventListener('click', async () => {
      await setActiveProgram(id);
      await renderProgramsList();
      await populateProgramSelector();
      await updateDaySelector();
      showToast('Program activated');
    });

    card.querySelector('.edit-btn').addEventListener('click', async () => {
      const program = await db.programs.get(id);
      if (program) {
        editProgram(program);
      }
    });

    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm('Delete this program?')) {
        await deleteProgram(id);
        await renderProgramsList();
        await populateProgramSelector();
        await updateDaySelector();
        showToast('Program deleted');
      }
    });
  });
}

function addExerciseCard(container, existingData = null) {
  const card = document.createElement('div');
  card.className = 'exercise-card';

  card.innerHTML = `
    <div class="exercise-header">
      <input type="text" class="exercise-name" placeholder="Exercise name">
      <button type="button" class="remove-btn">Remove</button>
    </div>
    <div class="sets-container">
      <div class="set-row">
        <span class="set-label">Set 1</span>
        <input type="number" class="reps-input" placeholder="Reps" inputmode="numeric">
        <input type="number" class="weight-input" placeholder="Weight" inputmode="decimal" step="0.1">
      </div>
      <div class="set-row">
        <span class="set-label">Set 2</span>
        <input type="number" class="reps-input" placeholder="Reps" inputmode="numeric">
        <input type="number" class="weight-input" placeholder="Weight" inputmode="decimal" step="0.1">
      </div>
      <div class="set-row">
        <span class="set-label">Set 3</span>
        <input type="number" class="reps-input" placeholder="Reps" inputmode="numeric">
        <input type="number" class="weight-input" placeholder="Weight" inputmode="decimal" step="0.1">
      </div>
    </div>
  `;

  if (existingData) {
    card.querySelector('.exercise-name').value = existingData.name || '';
    const setRows = card.querySelectorAll('.set-row');
    existingData.sets.forEach((set, i) => {
      if (setRows[i]) {
        if (set.reps !== null) setRows[i].querySelector('.reps-input').value = set.reps;
        if (set.weight !== null) setRows[i].querySelector('.weight-input').value = set.weight;
      }
    });
  }

  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove();
  });

  container.appendChild(card);
}

function initExportButton() {
  const exportBtn = document.getElementById('export-btn');

  exportBtn.addEventListener('click', async () => {
    const journal = await getTodayJournal();
    downloadJSON(journal);
  });
}

function downloadJSON(journal) {
  const filename = `journal-${journal.date}.json`;

  const blob = new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
