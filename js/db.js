// =============================================================================
// DATABASE MODULE
// =============================================================================
// Exposes clean async API for data operations using native IndexedDB.
// Future: Could wrap external sync services (Google Health, Fitbit).

import { state } from './state.js';
import { getTodayDate } from './utils.js';
import { showToast } from './ui.js';

// =============================================================================
// DATABASE SETUP
// =============================================================================

const DB_NAME = 'HealthTracker';
const DB_VERSION = 41;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

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

// Promisify IDB request
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get a transaction and store
async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// Get all records from a store
async function getAllFromStore(storeName) {
  const store = await getStore(storeName);
  return promisify(store.getAll());
}

// Get a single record by key
async function getByKey(storeName, key) {
  const store = await getStore(storeName);
  return promisify(store.get(key));
}

// Add a record
async function addRecord(storeName, record) {
  const store = await getStore(storeName, 'readwrite');
  return promisify(store.add(record));
}

// Put a record (add or update)
async function putRecord(storeName, record) {
  const store = await getStore(storeName, 'readwrite');
  return promisify(store.put(record));
}

// Update specific fields of a record
async function updateRecord(storeName, key, updates) {
  const store = await getStore(storeName, 'readwrite');
  const existing = await promisify(store.get(key));
  if (!existing) return;
  const updated = { ...existing, ...updates };
  return promisify(store.put(updated));
}

// Delete a record
async function deleteRecord(storeName, key) {
  const store = await getStore(storeName, 'readwrite');
  return promisify(store.delete(key));
}

// Clear a store
async function clearStore(storeName) {
  const store = await getStore(storeName, 'readwrite');
  return promisify(store.clear());
}

// Export db opener for direct access when needed
export { openDB as db };

// =============================================================================
// PROGRAM CRUD
// =============================================================================

export async function createProgram(name, days) {
  try {
    const program = {
      id: Date.now().toString(),
      name: name.trim(),
      days: days,
      createdAt: new Date().toISOString()
    };
    await addRecord('programs', program);
    return program;
  } catch (err) {
    console.error('Failed to create program:', err);
    showToast('Failed to create program');
    throw err;
  }
}

export function getProgramDayCount(program) {
  return program.days?.length || program.dayCount || 0;
}

export async function getAllPrograms() {
  try {
    return await getAllFromStore('programs');
  } catch (err) {
    console.error('Failed to get programs:', err);
    return [];
  }
}

export async function getProgram(id) {
  try {
    return await getByKey('programs', id);
  } catch (err) {
    console.error('Failed to get program:', err);
    return null;
  }
}

export async function updateProgram(id, name, days) {
  try {
    await updateRecord('programs', id, {
      name: name.trim(),
      days: days
    });
  } catch (err) {
    console.error('Failed to update program:', err);
    showToast('Failed to update program');
    throw err;
  }
}

export async function deleteProgram(id) {
  try {
    const wasActive = await getActiveProgram();
    if (wasActive?.id === id) {
      localStorage.removeItem('activeProgramId');
    }
    await deleteRecord('programs', id);
  } catch (err) {
    console.error('Failed to delete program:', err);
    showToast('Failed to delete program');
    throw err;
  }
}

export async function getActiveProgram() {
  const id = localStorage.getItem('activeProgramId');
  if (!id) return null;
  return getProgram(id);
}

export async function setActiveProgram(id) {
  if (id) {
    localStorage.setItem('activeProgramId', id);
  } else {
    localStorage.removeItem('activeProgramId');
  }
}

// =============================================================================
// GOALS CRUD
// =============================================================================

export async function createGoal(goalData) {
  try {
    const goal = {
      id: Date.now().toString(),
      type: goalData.type,
      metric: goalData.metric,
      target: parseFloat(goalData.target),
      direction: goalData.direction,
      deadline: goalData.deadline || null,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    await addRecord('goals', goal);
    return goal;
  } catch (err) {
    console.error('Failed to create goal:', err);
    showToast('Failed to create goal');
    throw err;
  }
}

export async function getAllGoals() {
  try {
    return await getAllFromStore('goals');
  } catch (err) {
    console.error('Failed to get goals:', err);
    return [];
  }
}

export async function getActiveGoals() {
  try {
    const goals = await getAllFromStore('goals');
    return goals.filter(g => !g.completedAt);
  } catch (err) {
    console.error('Failed to get active goals:', err);
    return [];
  }
}

export async function getCompletedGoals() {
  try {
    const goals = await getAllFromStore('goals');
    return goals.filter(g => !!g.completedAt);
  } catch (err) {
    console.error('Failed to get completed goals:', err);
    return [];
  }
}

export async function completeGoal(id) {
  try {
    await updateRecord('goals', id, {
      completedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to complete goal:', err);
    showToast('Failed to update goal');
    throw err;
  }
}

export async function uncompleteGoal(id) {
  try {
    await updateRecord('goals', id, {
      completedAt: null
    });
  } catch (err) {
    console.error('Failed to reopen goal:', err);
    showToast('Failed to update goal');
    throw err;
  }
}

export async function deleteGoal(id) {
  try {
    await deleteRecord('goals', id);
  } catch (err) {
    console.error('Failed to delete goal:', err);
    showToast('Failed to delete goal');
    throw err;
  }
}

// =============================================================================
// PROFILE CRUD
// =============================================================================

const DEFAULT_PROFILE = {
  id: 'user',
  name: null,
  height: null,
  birthDate: null,
  sex: null,
  unitPreference: 'metric',
  updatedAt: null
};

export async function getProfile() {
  try {
    const profile = await getByKey('profile', 'user');
    return profile || { ...DEFAULT_PROFILE };
  } catch (err) {
    console.error('Failed to get profile:', err);
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(data) {
  try {
    const profile = {
      id: 'user',
      name: data.name?.trim() || null,
      height: data.height ? parseFloat(data.height) : null,
      birthDate: data.birthDate || null,
      sex: data.sex || null,
      unitPreference: data.unitPreference || 'metric',
      updatedAt: new Date().toISOString()
    };
    await putRecord('profile', profile);
    return profile;
  } catch (err) {
    console.error('Failed to save profile:', err);
    showToast('Failed to save profile');
    throw err;
  }
}

// =============================================================================
// JOURNAL QUERIES
// =============================================================================

export async function getRecentJournals(includeToday = false) {
  try {
    const today = getTodayDate();
    const journals = await getAllFromStore('journals');
    const filtered = includeToday
      ? journals.filter(j => j.date <= today)
      : journals.filter(j => j.date < today);
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error('Failed to get recent journals:', err);
    return [];
  }
}

export async function getJournalForDate(date) {
  try {
    const stored = await getByKey('journals', date);
    if (stored) {
      return stored;
    }
  } catch (err) {
    console.error('Failed to get journal:', err);
  }
  return {
    date: date,
    lastModified: new Date().toISOString(),
    body: null,
    daily: null,
    workout: null,
    notes: null
  };
}

export async function saveJournalForDate(journal) {
  try {
    journal.lastModified = new Date().toISOString();
    await putRecord('journals', journal);
    // Update cache for calendar dots
    state.addToJournalDatesCache(journal.date);
    showToast('Saved');
  } catch (err) {
    console.error('Failed to save journal:', err);
    showToast('Failed to save');
    throw err;
  }
}

export async function loadJournalDatesForMonth(year, month) {
  try {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = firstDay.toISOString().split('T')[0];
    const endDate = lastDay.toISOString().split('T')[0];

    const journals = await getAllFromStore('journals');
    const filtered = journals.filter(j => j.date >= startDate && j.date <= endDate);

    filtered.forEach(j => state.addToJournalDatesCache(j.date));
  } catch (err) {
    console.error('Failed to load journal dates:', err);
  }
}

// Legacy wrappers
export async function getTodayJournal() {
  return getJournalForDate(getTodayDate());
}

export async function saveTodayJournal(journal) {
  return saveJournalForDate(journal);
}

// =============================================================================
// STATISTICS
// =============================================================================

export async function calculateStats() {
  try {
    const journals = await getAllFromStore('journals');
    const today = getTodayDate();

    // Days tracked (journals with any data)
    const daysTracked = journals.filter(j =>
      j.body || j.daily || j.workout?.exercises?.length
    ).length;

    // Total workouts
    const totalWorkouts = journals.filter(j =>
      j.workout?.exercises?.length > 0
    ).length;

    // Current streak (consecutive days with any entry, counting backward from today)
    let currentStreak = 0;
    const sortedDates = journals
      .map(j => j.date)
      .sort()
      .reverse();

    if (sortedDates.length > 0) {
      let checkDate = new Date(today + 'T00:00:00');
      // If today has no entry, start from yesterday
      if (!sortedDates.includes(today)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (const date of sortedDates) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (date === dateStr) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (date < dateStr) {
          break;
        }
      }
    }

    // 30-day averages
    const thirtyDaysAgo = new Date(today + 'T00:00:00');
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const recentJournals = journals.filter(j => j.date >= thirtyDaysAgoStr);

    function calcAverage(field) {
      const values = recentJournals
        .map(j => j.daily?.[field])
        .filter(v => v != null);
      if (values.length === 0) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    }

    return {
      daysTracked,
      totalWorkouts,
      currentStreak,
      avgCalories: calcAverage('calories'),
      avgProtein: calcAverage('protein'),
      avgSleep: calcAverage('sleep')
    };
  } catch (err) {
    console.error('Failed to calculate stats:', err);
    return {
      daysTracked: 0,
      totalWorkouts: 0,
      currentStreak: 0,
      avgCalories: null,
      avgProtein: null,
      avgSleep: null
    };
  }
}

export async function getNextDayNumber(programId) {
  if (!programId) return null;

  try {
    const program = await getByKey('programs', programId);
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
  } catch (err) {
    console.error('Failed to get next day number:', err);
    return 1;
  }
}

// =============================================================================
// WORKOUT QUERIES
// =============================================================================

export async function getMostRecentWorkout(programId = null, dayNumber = null) {
  try {
    const journals = await getRecentJournals();

    if (programId && dayNumber) {
      for (const journal of journals) {
        if (journal.workout?.exercises?.length > 0 &&
            journal.workout.programId === programId &&
            journal.workout.dayNumber === dayNumber) {
          return journal;
        }
      }
    }

    if (programId) {
      for (const journal of journals) {
        if (journal.workout?.exercises?.length > 0 &&
            journal.workout.programId === programId) {
          return journal;
        }
      }
    }

    for (const journal of journals) {
      if (journal.workout?.exercises?.length > 0) {
        return journal;
      }
    }

    return null;
  } catch (err) {
    console.error('Failed to get recent workout:', err);
    return null;
  }
}

// =============================================================================
// EXPORT/IMPORT
// =============================================================================

export async function exportAllData() {
  try {
    const programs = await getAllFromStore('programs');
    const journals = await getAllFromStore('journals');
    const goals = await getAllFromStore('goals');
    const profile = await getProfile();

    return {
      version: 3,
      exportedAt: new Date().toISOString(),
      programs,
      journals,
      goals,
      profile: profile.updatedAt ? profile : null
    };
  } catch (err) {
    console.error('Failed to export data:', err);
    throw err;
  }
}

export async function importData(data) {
  if (!data.version || !data.programs || !data.journals) {
    throw new Error('Invalid backup file');
  }

  if (data.version < 2) {
    throw new Error('This backup file is from an older version and cannot be imported.');
  }

  try {
    const db = await openDB();
    const tx = db.transaction(['programs', 'journals', 'goals', 'profile'], 'readwrite');

    const programStore = tx.objectStore('programs');
    const journalStore = tx.objectStore('journals');
    const goalStore = tx.objectStore('goals');
    const profileStore = tx.objectStore('profile');

    // Clear all stores
    await promisify(programStore.clear());
    await promisify(journalStore.clear());
    await promisify(goalStore.clear());
    await promisify(profileStore.clear());

    // Add all data
    for (const program of data.programs) {
      programStore.add(program);
    }
    for (const journal of data.journals) {
      journalStore.add(journal);
    }
    if (data.goals) {
      for (const goal of data.goals) {
        goalStore.add(goal);
      }
    }
    if (data.profile) {
      profileStore.put(data.profile);
    }

    // Wait for transaction to complete
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    localStorage.removeItem('activeProgramId');
  } catch (err) {
    console.error('Failed to import data:', err);
    throw err;
  }
}
