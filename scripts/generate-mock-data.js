// Mock data generator for Health Tracker
// Run in browser console or import as module

const DB_NAME = 'HealthTracker';
const DB_VERSION = 41;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('journals')) {
        db.createObjectStore('journals', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('programs')) {
        const programStore = db.createObjectStore('programs', { keyPath: 'id' });
        programStore.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('goals')) {
        const goalStore = db.createObjectStore('goals', { keyPath: 'id' });
        goalStore.createIndex('type', 'type', { unique: false });
        goalStore.createIndex('metric', 'metric', { unique: false });
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
    };
  });
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Random number in range with optional decimal places
function rand(min, max, decimals = 0) {
  const value = Math.random() * (max - min) + min;
  return decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.round(value);
}

// Generate slight variation from base value (for realistic trends)
function vary(base, variance, decimals = 0) {
  return rand(base - variance, base + variance, decimals);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Push Pull Legs program with exercise IDs (must match exercises.json keys)
const PPL_PROGRAM = {
  id: 'ppl-mock-001',
  name: 'Push Pull Legs',
  createdAt: new Date().toISOString(),
  days: [
    {
      name: 'Push',
      exercises: [
        'barbell-bench-press',
        'incline-dumbbell-press',
        'dumbbell-fly',
        'barbell-overhead-press',
        'dumbbell-lateral-raise',
        'cable-tricep-pushdown'
      ]
    },
    {
      name: 'Pull',
      exercises: [
        'barbell-row',
        'lat-pulldown',
        'seated-cable-row',
        'dumbbell-rear-delt-fly',
        'barbell-curl',
        'dumbbell-hammer-curl'
      ]
    },
    {
      name: 'Legs',
      exercises: [
        'barbell-back-squat',
        'leg-press',
        'leg-extension',
        'barbell-romanian-deadlift',
        'lying-leg-curl',
        'standing-calf-raise-machine'
      ]
    }
  ]
};

// Exercise ID to base weight mapping (kg)
const EXERCISE_WEIGHTS = {
  'barbell-bench-press': 70,
  'incline-dumbbell-press': 24,
  'dumbbell-fly': 14,
  'barbell-overhead-press': 45,
  'dumbbell-lateral-raise': 10,
  'cable-tricep-pushdown': 25,
  'barbell-row': 60,
  'lat-pulldown': 55,
  'seated-cable-row': 50,
  'dumbbell-rear-delt-fly': 8,
  'barbell-curl': 35,
  'dumbbell-hammer-curl': 14,
  'barbell-back-squat': 90,
  'leg-press': 140,
  'leg-extension': 45,
  'barbell-romanian-deadlift': 80,
  'lying-leg-curl': 35,
  'standing-calf-raise-machine': 80
};

function generateBodyData(dayOffset, baseValues) {
  const trend = dayOffset * 0.02;

  return {
    weight: vary(baseValues.weight - trend * 0.5, 0.5, 1),
    bodyFat: vary(baseValues.bodyFat - trend * 0.1, 0.5, 1),
    restingHR: vary(baseValues.restingHR - trend * 0.3, 3, 0),
    circumferences: {
      neck: vary(baseValues.neck, 0.3, 1),
      chest: vary(baseValues.chest, 0.5, 1),
      waist: vary(baseValues.waist - trend * 0.2, 0.5, 1),
      hips: vary(baseValues.hips, 0.5, 1),
      leftBiceps: vary(baseValues.biceps, 0.3, 1),
      rightBiceps: vary(baseValues.biceps + 0.2, 0.3, 1),
      leftQuadriceps: vary(baseValues.quads, 0.5, 1),
      rightQuadriceps: vary(baseValues.quads + 0.3, 0.5, 1),
      leftCalf: vary(baseValues.calves, 0.3, 1),
      rightCalf: vary(baseValues.calves, 0.3, 1)
    }
  };
}

function generateDailyData(dayOffset, baseValues) {
  return {
    calories: vary(baseValues.calories, 200, 0),
    protein: vary(baseValues.protein, 20, 0),
    fibre: vary(baseValues.fibre, 5, 0),
    water: vary(baseValues.water, 0.5, 1),
    steps: vary(baseValues.steps, 2000, 0),
    sleep: vary(baseValues.sleep, 1, 1),
    recovery: vary(baseValues.recovery, 2, 0)
  };
}

// Exercise ID to display name mapping
const EXERCISE_NAMES = {
  'barbell-bench-press': 'Barbell bench press',
  'incline-dumbbell-press': 'Incline dumbbell press',
  'dumbbell-fly': 'Dumbbell fly',
  'barbell-overhead-press': 'Barbell overhead press',
  'dumbbell-lateral-raise': 'Dumbbell lateral raise',
  'cable-tricep-pushdown': 'Cable tricep pushdown',
  'barbell-row': 'Barbell row',
  'lat-pulldown': 'Lat pulldown',
  'seated-cable-row': 'Seated cable row',
  'dumbbell-rear-delt-fly': 'Dumbbell rear delt fly',
  'barbell-curl': 'Barbell curl',
  'dumbbell-hammer-curl': 'Dumbbell hammer curl',
  'barbell-back-squat': 'Barbell back squat',
  'leg-press': 'Leg press',
  'leg-extension': 'Leg extension',
  'barbell-romanian-deadlift': 'Barbell Romanian deadlift',
  'lying-leg-curl': 'Lying leg curl',
  'standing-calf-raise-machine': 'Standing calf raise (machine)'
};

function generateWorkoutData(dayNumber, dayOffset) {
  const day = PPL_PROGRAM.days[dayNumber - 1];
  const trend = dayOffset * 0.5; // Progressive overload

  const exercises = day.exercises.map(id => {
    const baseWeight = EXERCISE_WEIGHTS[id] || 20;
    const weight = Math.round(baseWeight + trend);
    const name = EXERCISE_NAMES[id] || id;

    // Generate 3-4 sets per exercise
    const numSets = rand(3, 4);
    const sets = [];

    for (let s = 0; s < numSets; s++) {
      sets.push({
        reps: rand(6, 12),
        weight: vary(weight, 2.5, 1),
        rir: rand(1, 3)
      });
    }

    return { id, name, sets };
  });

  return {
    programId: PPL_PROGRAM.id,
    dayNumber,
    exercises
  };
}

// Workout schedule: Push/Pull/Legs/Rest pattern
function getWorkoutDay(dayIndex) {
  const pattern = [1, 2, 3, 0, 1, 2, 3]; // 1=Push, 2=Pull, 3=Legs, 0=Rest
  return pattern[dayIndex % 7];
}

async function generateMockData() {
  const db = await openDB();

  // Base values for a moderately fit adult
  const baseDaily = {
    calories: 2100,  // kcal
    protein: 120,    // g
    fibre: 28,       // g
    water: 2.5,      // L
    steps: 8000,
    sleep: 7.2,      // hours
    recovery: 7      // 1-10
  };

  const baseBody = {
    weight: 78,      // kg
    bodyFat: 18,     // %
    restingHR: 65,   // bpm
    neck: 38,        // cm
    chest: 102,      // cm
    waist: 86,       // cm
    hips: 98,        // cm
    biceps: 34,      // cm
    quads: 58,       // cm
    calves: 38       // cm
  };

  const today = new Date();
  const journals = [];
  let workoutCount = 0;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    const dayOffset = 29 - i;

    const journal = {
      date: dateStr,
      lastModified: new Date(date.getTime() + 20 * 60 * 60 * 1000).toISOString(),
      daily: generateDailyData(dayOffset, baseDaily),
      body: {},
      workout: null,
      notes: null
    };

    // Add body measurements weekly (every 7 days) or on day 0
    if (i % 7 === 0 || i === 0) {
      journal.body = generateBodyData(dayOffset, baseBody);
    }

    // Add workout on training days
    const workoutDay = getWorkoutDay(dayOffset);
    if (workoutDay > 0) {
      journal.workout = generateWorkoutData(workoutDay, dayOffset);
      workoutCount++;
    }

    journals.push(journal);
  }

  // Write program to IndexedDB
  const programTx = db.transaction('programs', 'readwrite');
  const programStore = programTx.objectStore('programs');
  await promisify(programStore.put(PPL_PROGRAM));
  await new Promise((resolve, reject) => {
    programTx.oncomplete = resolve;
    programTx.onerror = () => reject(programTx.error);
  });

  // Write journals to IndexedDB
  const journalTx = db.transaction('journals', 'readwrite');
  const journalStore = journalTx.objectStore('journals');

  for (const journal of journals) {
    await promisify(journalStore.put(journal));
  }

  await new Promise((resolve, reject) => {
    journalTx.oncomplete = resolve;
    journalTx.onerror = () => reject(journalTx.error);
  });

  // Set active program in localStorage
  localStorage.setItem('activeProgramId', PPL_PROGRAM.id);

  console.log(`Generated ${journals.length} days of journal data`);
  console.log(`Generated ${workoutCount} workout sessions`);
  console.log(`Created program: ${PPL_PROGRAM.name}`);
  console.log('Sample journal entry:', journals.find(j => j.workout));

  return { journals, program: PPL_PROGRAM };
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  window.generateMockData = generateMockData;
  console.log('Mock data generator loaded. Run generateMockData() to populate database.');
}

export { generateMockData };
