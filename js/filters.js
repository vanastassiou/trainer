// =============================================================================
// EXERCISE FILTERING
// =============================================================================

/**
 * Filter exercises based on search term and filter criteria.
 * @param {Object[]} exercises - Array of exercise objects
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.searchTerm] - Text to search in exercise name
 * @param {string} [filters.muscleGroup] - Muscle group to match
 * @param {string} [filters.movementPattern] - Movement pattern to match
 * @param {string} [filters.equipment] - Equipment to match
 * @returns {Object[]} Filtered exercises
 */
export function filterExercises(exercises, filters = {}) {
  const {
    searchTerm = '',
    muscleGroup = '',
    movementPattern = '',
    equipment = '',
    difficulty = ''
  } = filters;

  const search = searchTerm.toLowerCase();

  return exercises.filter(ex => {
    if (search && !ex.name.toLowerCase().includes(search)) return false;
    if (muscleGroup && ex.muscle_group !== muscleGroup) return false;
    if (movementPattern && ex.movement_pattern !== movementPattern) return false;
    if (equipment && ex.equipment !== equipment) return false;
    if (difficulty && ex.difficulty !== difficulty) return false;
    return true;
  });
}

/**
 * Get filter values from exercise picker form inputs.
 * @returns {Object} Current filter values
 */
export function getExerciseFilterValues() {
  return {
    searchTerm: document.getElementById('exercise-search')?.value || '',
    muscleGroup: document.getElementById('filter-muscle-group')?.value || '',
    movementPattern: document.getElementById('filter-movement')?.value || '',
    equipment: document.getElementById('filter-equipment')?.value || '',
    difficulty: document.getElementById('filter-difficulty')?.value || ''
  };
}

/**
 * Reset exercise picker filter inputs to empty values.
 */
export function resetExerciseFilters() {
  const searchInput = document.getElementById('exercise-search');
  const muscleSelect = document.getElementById('filter-muscle-group');
  const movementSelect = document.getElementById('filter-movement');
  const equipmentSelect = document.getElementById('filter-equipment');
  const difficultySelect = document.getElementById('filter-difficulty');

  if (searchInput) searchInput.value = '';
  if (muscleSelect) muscleSelect.value = '';
  if (movementSelect) movementSelect.value = '';
  if (equipmentSelect) equipmentSelect.value = '';
  if (difficultySelect) difficultySelect.value = '';
}

/**
 * Get unique values for a field from exercise list.
 * @param {Object[]} exercises - Array of exercise objects
 * @param {string} field - Field name to extract values from
 * @returns {string[]} Sorted unique values
 */
export function getUniqueValues(exercises, field) {
  const values = new Set();
  exercises.forEach(ex => {
    if (ex[field]) values.add(ex[field]);
  });
  return Array.from(values).sort();
}

/**
 * Get available options for a filter based on exercises matching other filters.
 * @param {Object[]} exercises - Full exercise list
 * @param {string} field - Field to get options for
 * @param {Object} otherFilters - Filters to apply (excluding this field)
 * @returns {string[]} Available values for this field
 */
export function getAvailableFilterOptions(exercises, field, otherFilters) {
  const filtered = filterExercises(exercises, otherFilters);
  return getUniqueValues(filtered, field);
}
