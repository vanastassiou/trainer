const db = new Dexie('HealthTracker');
db.version(1).stores({
  journals: 'date'
});

document.addEventListener('DOMContentLoaded', async () => {
  await requestPersistentStorage();
  registerServiceWorker();
  initTabs();
  initMeasurementsForm();
  initWorkoutForm();
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

  addBtn.addEventListener('click', () => {
    addExerciseCard(container);
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

    const journal = await getTodayJournal();
    journal.workout = { exercises };
    await saveTodayJournal(journal);
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
