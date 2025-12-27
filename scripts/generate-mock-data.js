// Mock data generator for Health Tracker
// Run in browser console or import as module

const DB_NAME = 'HealthTracker';
const DB_VERSION = 41;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
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

function generateDailyData(dayOffset, baseValues) {
  // Add slight daily variation and gradual trend
  const trend = dayOffset * 0.02; // Slight improvement over time

  return {
    weight: vary(baseValues.weight - trend * 0.5, 0.5, 1),
    restingHR: vary(baseValues.restingHR - trend * 0.3, 3, 0),
    calories: vary(baseValues.calories, 200, 0),
    protein: vary(baseValues.protein, 20, 0),
    fibre: vary(baseValues.fibre, 5, 0),
    water: vary(baseValues.water, 0.5, 1),
    steps: vary(baseValues.steps, 2000, 0),
    sleep: vary(baseValues.sleep, 1, 1),
    recovery: vary(baseValues.recovery, 2, 0)
  };
}

function generateBodyData(dayOffset, baseValues) {
  const trend = dayOffset * 0.02;

  return {
    bodyFat: vary(baseValues.bodyFat - trend * 0.1, 0.5, 1),
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

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function generateMockData() {
  const db = await openDB();

  // Base values for a moderately fit adult
  const baseDaily = {
    weight: 78,      // kg
    restingHR: 65,   // bpm
    calories: 2100,  // kcal
    protein: 120,    // g
    fibre: 28,       // g
    water: 2.5,      // L
    steps: 8000,
    sleep: 7.2,      // hours
    recovery: 7      // /10
  };

  const baseBody = {
    bodyFat: 18,     // %
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

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    const journal = {
      date: dateStr,
      daily: generateDailyData(29 - i, baseDaily),
      workout: null,
      notes: null
    };

    // Add body measurements weekly (every 7 days) or on day 0
    if (i % 7 === 0 || i === 0) {
      journal.body = generateBodyData(29 - i, baseBody);
    } else {
      journal.body = {};
    }

    journals.push(journal);
  }

  // Write to IndexedDB
  const tx = db.transaction('journals', 'readwrite');
  const store = tx.objectStore('journals');

  for (const journal of journals) {
    await promisify(store.put(journal));
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  console.log(`Generated ${journals.length} days of mock data`);
  console.log('Sample entry:', journals[journals.length - 1]);

  return journals;
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  window.generateMockData = generateMockData;
  console.log('Mock data generator loaded. Run generateMockData() to populate database.');
}

export { generateMockData };
