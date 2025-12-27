// =============================================================================
// CENTRALIZED STATE MODULE
// =============================================================================

// Private state variables
let _exercisesDB = [];
let _articlesData = null;
let _glossaryData = null;
let _isInitializing = false;
let _editingProgramId = null;
let _exercisePickerCallback = null;
let _selectedDate = null;
let _calendarMonth = null;
let _journalDatesCache = new Map(); // Maps date -> completion percentage (0-100)

// Modal controllers (initialized after DOM ready)
let _workoutSwitchDialog = null;
let _editProgramDialog = null;
let _exercisePickerDialog = null;
let _exerciseInfoDialog = null;
let _calendarDialog = null;
let _researchDialog = null;
let _glossaryDialog = null;
let _unitPreference = 'metric';

// State object with getters/setters for controlled access
export const state = {
  // Exercise database
  get exercisesDB() { return _exercisesDB; },
  set exercisesDB(v) { _exercisesDB = v; },

  // Articles data (lazy loaded)
  get articlesData() { return _articlesData; },
  set articlesData(v) { _articlesData = v; },

  // Glossary data (lazy loaded)
  get glossaryData() { return _glossaryData; },
  set glossaryData(v) { _glossaryData = v; },

  // Initialization flag to prevent race conditions
  get isInitializing() { return _isInitializing; },
  set isInitializing(v) { _isInitializing = v; },

  // Currently editing program ID
  get editingProgramId() { return _editingProgramId; },
  set editingProgramId(v) { _editingProgramId = v; },

  // Exercise picker callback
  get exercisePickerCallback() { return _exercisePickerCallback; },
  set exercisePickerCallback(v) { _exercisePickerCallback = v; },

  // Current date being viewed/edited (YYYY-MM-DD)
  get selectedDate() { return _selectedDate; },
  set selectedDate(v) { _selectedDate = v; },

  // Currently displayed month in calendar {year, month}
  get calendarMonth() { return _calendarMonth; },
  set calendarMonth(v) { _calendarMonth = v; },

  // Dates that have journal entries with completion percentage (for calendar indicators)
  get journalDatesCache() { return _journalDatesCache; },
  addToJournalDatesCache(date, completion = 0) { _journalDatesCache.set(date, completion); },
  getJournalDateCompletion(date) { return _journalDatesCache.get(date) ?? null; },
  clearJournalDatesCache() { _journalDatesCache = new Map(); },

  // Modal controllers
  get workoutSwitchDialog() { return _workoutSwitchDialog; },
  set workoutSwitchDialog(v) { _workoutSwitchDialog = v; },

  get editProgramDialog() { return _editProgramDialog; },
  set editProgramDialog(v) { _editProgramDialog = v; },

  get exercisePickerDialog() { return _exercisePickerDialog; },
  set exercisePickerDialog(v) { _exercisePickerDialog = v; },

  get exerciseInfoDialog() { return _exerciseInfoDialog; },
  set exerciseInfoDialog(v) { _exerciseInfoDialog = v; },

  get calendarDialog() { return _calendarDialog; },
  set calendarDialog(v) { _calendarDialog = v; },

  get researchDialog() { return _researchDialog; },
  set researchDialog(v) { _researchDialog = v; },

  get glossaryDialog() { return _glossaryDialog; },
  set glossaryDialog(v) { _glossaryDialog = v; },

  // Unit preference (metric or imperial)
  get unitPreference() { return _unitPreference; },
  set unitPreference(v) { _unitPreference = v; }
};
