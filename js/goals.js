// =============================================================================
// GOALS MODULE
// =============================================================================
// Handles goal creation, tracking, and display.

import { showToast } from './ui.js';
import {
  createGoal,
  getActiveGoals,
  getCompletedGoals,
  completeGoal,
  uncompleteGoal,
  deleteGoal,
  getProfile,
  saveProfile,
  calculateStats,
  getRecentJournals
} from './db.js';
import { METRIC_UNITS, updateFormUnits, displayPreviousMeasurements } from './measurements.js';
import { state } from './state.js';
import { toImperial, toMetric, getDisplayUnit, getAgeFromBirthDate, getVolumeRecommendations } from './utils.js';

// =============================================================================
// CONSTANTS
// =============================================================================

export const DIRECTION_CONFIG = {
  decrease: { symbol: '↓', label: 'Decrease to' },
  increase: { symbol: '↑', label: 'Increase to' },
  maintain: { symbol: '↔', label: 'Maintain at' }
};

const GOAL_METRIC_LABELS = {
  weight: 'Weight',
  bodyFat: 'Body fat',
  waist: 'Waist',
  calories: 'Calories',
  protein: 'Protein',
  water: 'Water',
  steps: 'Steps',
  sleep: 'Sleep'
};

const GOAL_METRIC_SOURCES = {
  weight: 'body',
  bodyFat: 'body',
  waist: 'body',
  calories: 'daily',
  protein: 'daily',
  water: 'daily',
  steps: 'daily',
  sleep: 'daily'
};

// =============================================================================
// PROFILE INITIALIZATION
// =============================================================================

export async function initProfile() {
  const profileForm = document.getElementById('profile-form');
  const profileDisplay = document.getElementById('profile-display');
  const editBtn = document.getElementById('edit-profile-btn');
  const unitSelect = document.getElementById('profile-units');

  // Unit select handling (converts height value and updates visibility)
  unitSelect.addEventListener('change', () => {
    const newPreference = unitSelect.value;
    const oldPreference = state.unitPreference;

    // Convert height value if switching units
    if (oldPreference !== newPreference) {
      if (oldPreference === 'metric' && newPreference === 'imperial') {
        // Metric to Imperial
        const cmValue = parseFloat(document.getElementById('profile-height').value);
        if (cmValue) {
          const { feet, inches } = toImperial(cmValue, 'height');
          document.getElementById('profile-height-ft').value = feet;
          document.getElementById('profile-height-in').value = inches.toFixed(1);
        }
      } else if (oldPreference === 'imperial' && newPreference === 'metric') {
        // Imperial to Metric
        const feet = parseFloat(document.getElementById('profile-height-ft').value) || 0;
        const inches = parseFloat(document.getElementById('profile-height-in').value) || 0;
        if (feet || inches) {
          const cm = toMetric({ feet, inches }, 'height');
          document.getElementById('profile-height').value = Math.round(cm * 10) / 10;
        }
      }
    }

    state.unitPreference = newPreference;
    updateHeightInputVisibility(newPreference);
  });

  // Edit button switches to form view
  editBtn.addEventListener('click', () => {
    profileDisplay.classList.add('hidden');
    profileForm.classList.remove('hidden');
  });

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(profileForm);
    const unitPreference = formData.get('unitPreference');

    // Get height based on current unit preference
    let heightCm;
    if (unitPreference === 'imperial') {
      const feet = parseFloat(formData.get('height-ft')) || 0;
      const inches = parseFloat(formData.get('height-in')) || 0;
      heightCm = toMetric({ feet, inches }, 'height');
    } else {
      heightCm = formData.get('height');
    }

    await saveProfile({
      name: formData.get('name'),
      height: heightCm,
      birthDate: formData.get('birthDate'),
      sex: formData.get('sex'),
      unitPreference: unitPreference
    });

    // Update state and refresh displays if unit changed
    if (state.unitPreference !== unitPreference) {
      state.unitPreference = unitPreference;
      updateAllUnitDisplays();
    }

    showToast('Profile saved');

    // Switch to display view
    renderProfileDisplay();
    profileForm.classList.add('hidden');
    profileDisplay.classList.remove('hidden');
  });

  // Load profile first to set unit preference before other rendering
  await loadProfileForm();
  renderStats();
  initGoalsForm();
  initGoalsListeners();
  renderGoalsList();
}

async function loadProfileForm() {
  const profile = await getProfile();
  const profileForm = document.getElementById('profile-form');
  const profileDisplay = document.getElementById('profile-display');

  // Set unit preference in state
  state.unitPreference = profile.unitPreference || 'metric';

  // Update units select
  const unitSelect = document.getElementById('profile-units');
  unitSelect.value = state.unitPreference;

  const nameInput = document.getElementById('profile-name');
  const birthDateInput = document.getElementById('profile-birthdate');
  const sexInput = document.getElementById('profile-sex');

  if (nameInput) nameInput.value = profile.name || '';
  if (birthDateInput) birthDateInput.value = profile.birthDate || '';
  if (sexInput) sexInput.value = profile.sex || '';

  // Load height based on unit preference
  updateHeightInputVisibility(state.unitPreference);

  if (profile.height) {
    if (state.unitPreference === 'imperial') {
      const { feet, inches } = toImperial(profile.height, 'height');
      document.getElementById('profile-height-ft').value = feet;
      document.getElementById('profile-height-in').value = inches.toFixed(1);
    } else {
      document.getElementById('profile-height').value = profile.height;
    }
  }

  // Show display view if profile has been saved, otherwise show form
  const hasProfile = profile.name || profile.birthDate || profile.height || profile.sex;
  if (hasProfile) {
    renderProfileDisplay();
    profileForm.classList.add('hidden');
    profileDisplay.classList.remove('hidden');
  } else {
    profileForm.classList.remove('hidden');
    profileDisplay.classList.add('hidden');
  }
}

async function renderProfileDisplay() {
  const profile = await getProfile();

  document.getElementById('display-name').textContent = profile.name || '--';
  document.getElementById('display-sex').textContent = profile.sex
    ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)
    : '--';

  // Calculate age from birthdate using utility function
  const age = getAgeFromBirthDate(profile.birthDate);
  document.getElementById('display-age').textContent = age != null ? age : '--';

  // Format height based on unit preference
  if (profile.height) {
    if (state.unitPreference === 'imperial') {
      const { feet, inches } = toImperial(profile.height, 'height');
      document.getElementById('display-height').textContent = `${feet}' ${inches.toFixed(1)}"`;
    } else {
      document.getElementById('display-height').textContent = `${profile.height} cm`;
    }
  } else {
    document.getElementById('display-height').textContent = '--';
  }

  // Display units preference
  document.getElementById('display-units').textContent =
    state.unitPreference === 'imperial' ? 'Imperial' : 'Metric';

  // Render volume guidance based on age
  renderVolumeGuidance(age);
}

/**
 * Render personalized volume recommendations based on user's age.
 * @param {number|null} age - User's age in years
 */
function renderVolumeGuidance(age) {
  const container = document.getElementById('volume-guidance');
  if (!container) return;

  const recs = getVolumeRecommendations(age);

  const ageNote = age != null
    ? (recs.ageGroup === 'older-adult'
      ? 'Research shows adults 60+ benefit from higher training frequency.'
      : '')
    : 'Add your birth date to get personalized recommendations.';

  container.innerHTML = `
    <h4>Volume guidelines</h4>
    <dl class="volume-recs">
      <dt>Maintenance</dt>
      <dd>${recs.maintenance.description}</dd>
      <dt>Growth</dt>
      <dd>${recs.growth.description}</dd>
      <dt>Frequency</dt>
      <dd>${recs.frequency.description}</dd>
      <dt>Per session</dt>
      <dd>${recs.perSession.description}</dd>
    </dl>
    ${ageNote ? `<p class="volume-note">${ageNote}</p>` : ''}
  `;
}

function updateHeightInputVisibility(preference) {
  const metricInput = document.getElementById('height-metric-input');
  const imperialInput = document.getElementById('height-imperial-input');

  if (preference === 'imperial') {
    metricInput.classList.add('hidden');
    imperialInput.classList.remove('hidden');
  } else {
    metricInput.classList.remove('hidden');
    imperialInput.classList.add('hidden');
  }
}

export function updateAllUnitDisplays() {
  // Update measurement form units
  updateFormUnits();

  // Re-render goals with new units
  renderGoalsList();

  // Re-render previous measurements
  displayPreviousMeasurements();
}

// =============================================================================
// STATISTICS
// =============================================================================

export async function renderStats() {
  const stats = await calculateStats();

  document.getElementById('stat-days-tracked').textContent = stats.daysTracked;
  document.getElementById('stat-total-workouts').textContent = stats.totalWorkouts;
  document.getElementById('stat-current-streak').textContent =
    stats.currentStreak + (stats.currentStreak === 1 ? ' day' : ' days');
  document.getElementById('stat-avg-calories').textContent =
    stats.avgCalories != null ? Math.round(stats.avgCalories) + ' kcal' : '--';
  document.getElementById('stat-avg-protein').textContent =
    stats.avgProtein != null ? Math.round(stats.avgProtein) + 'g' : '--';
  document.getElementById('stat-avg-sleep').textContent =
    stats.avgSleep != null ? stats.avgSleep.toFixed(1) + ' hrs' : '--';
}

// =============================================================================
// GOALS FORM
// =============================================================================

function initGoalsForm() {
  const addGoalForm = document.getElementById('add-goal-form');

  addGoalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addGoalForm);
    const metric = formData.get('metric');

    // Derive type from metric
    const type = GOAL_METRIC_SOURCES[metric] === 'body' ? 'body' : 'habit';

    const goalData = {
      type,
      metric,
      direction: formData.get('direction'),
      target: formData.get('target'),
      deadline: formData.get('deadline')
    };

    await createGoal(goalData);
    addGoalForm.reset();
    showToast('Goal added');
    await renderGoalsList();
  });
}

// =============================================================================
// GOAL PROGRESS
// =============================================================================

async function getLatestMetricValue(metric) {
  const source = GOAL_METRIC_SOURCES[metric];
  if (!source) return null;

  // Get recent journals (already sorted by date descending)
  const journals = await getRecentJournals(true);
  const recentJournals = journals.slice(0, 30);

  for (const journal of recentJournals) {
    let value = null;
    if (source === 'body') {
      // Check circumferences first for waist
      if (metric === 'waist' && journal.body?.circumferences?.waist != null) {
        value = journal.body.circumferences.waist;
      } else if (journal.body?.[metric] != null) {
        value = journal.body[metric];
      }
    } else if (source === 'daily') {
      if (journal.daily?.[metric] != null) {
        value = journal.daily[metric];
      }
    }
    if (value != null) return value;
  }
  return null;
}

function calculateProgress(current, target, direction) {
  if (current == null) return null;

  // For "maintain", we're at 100% if current equals target
  if (direction === 'maintain') {
    const diff = Math.abs(current - target);
    const tolerance = target * 0.02; // 2% tolerance
    return diff <= tolerance ? 100 : Math.max(0, 100 - (diff / target) * 100);
  }

  // For decrease: progress is how close we are to target from starting higher
  // For increase: progress is how close we are to target from starting lower
  if (direction === 'decrease') {
    if (current <= target) return 100;
    return null; // Will show current value instead
  }

  if (direction === 'increase') {
    if (current >= target) return 100;
    return null; // Will show current value instead
  }

  return null;
}

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// =============================================================================
// GOALS LIST
// =============================================================================

export async function renderGoalsList() {
  const container = document.getElementById('goals-list');
  const completedSection = document.getElementById('completed-goals-section');
  const completedContainer = document.getElementById('completed-goals-list');

  const activeGoals = await getActiveGoals();
  const completedGoals = await getCompletedGoals();

  // Render active goals
  if (activeGoals.length === 0) {
    container.innerHTML = `<p class="empty-message">No goals set. Add a goal to start tracking your progress.</p>`;
  } else {

    const goalsHtml = await Promise.all(activeGoals.map(async (goal) => {
      const currentValue = await getLatestMetricValue(goal.metric);
      const progress = calculateProgress(currentValue, goal.target, goal.direction);
      const metricLabel = GOAL_METRIC_LABELS[goal.metric] || goal.metric;

      // Get unit based on preference
      const unit = getDisplayUnit(goal.metric, state.unitPreference) || METRIC_UNITS[goal.metric] || '';

      // Convert values for display if imperial
      let displayCurrent = currentValue;
      let displayTarget = goal.target;

      if (state.unitPreference === 'imperial') {
        displayCurrent = currentValue != null ? toImperial(currentValue, goal.metric) : null;
        displayTarget = toImperial(goal.target, goal.metric);
      }

      // Format values
      const formatValue = (v) => v != null ? (typeof v === 'number' ? v.toFixed(1) : v) : null;

      const { symbol: directionSymbol } = DIRECTION_CONFIG[goal.direction] || DIRECTION_CONFIG.maintain;

      let progressHtml = '';
      if (displayCurrent != null) {
        const isComplete = progress === 100;
        progressHtml = `
          <div class="goal-progress">
            <div class="goal-progress-bar">
              <div class="goal-progress-fill ${isComplete ? 'complete' : ''}" style="width: ${progress || 0}%"></div>
            </div>
            <span class="goal-current">Current: ${formatValue(displayCurrent)}${unit}</span>
          </div>
        `;
      } else {
        progressHtml = '<div class="goal-progress"><span class="goal-no-data">No data yet</span></div>';
      }

      const deadlineHtml = goal.deadline
        ? `<span class="goal-deadline">Due: ${formatDeadline(goal.deadline)}</span>`
        : '';

      return `
        <div class="goal-card card" data-id="${goal.id}">
          <div class="goal-header">
            <span class="goal-direction">${directionSymbol}</span>
            <span class="goal-metric">${metricLabel}</span>
            <span class="goal-target">${formatValue(displayTarget)}${unit}</span>
          </div>
          ${progressHtml}
          <div class="goal-footer">
            ${deadlineHtml}
            <div class="goal-actions">
              <button type="button" class="btn sm complete-goal-btn">Complete</button>
              <button type="button" class="btn sm danger delete-goal-btn">Delete</button>
            </div>
          </div>
        </div>
      `;
    }));

    container.innerHTML = goalsHtml.join('');
  }

  // Render completed goals
  completedSection.classList.remove('hidden');
  if (completedGoals.length > 0) {
    completedContainer.innerHTML = completedGoals.map(goal => {
      const metricLabel = GOAL_METRIC_LABELS[goal.metric] || goal.metric;
      const { symbol: directionSymbol } = DIRECTION_CONFIG[goal.direction] || DIRECTION_CONFIG.maintain;

      // Get unit based on preference
      const unit = getDisplayUnit(goal.metric, state.unitPreference) || METRIC_UNITS[goal.metric] || '';

      // Convert target for display if imperial
      let displayTarget = goal.target;
      if (state.unitPreference === 'imperial') {
        displayTarget = toImperial(goal.target, goal.metric);
      }
      const formatValue = (v) => v != null ? (typeof v === 'number' ? v.toFixed(1) : v) : null;

      return `
        <div class="goal-card card completed" data-id="${goal.id}">
          <div class="goal-header">
            <span class="goal-direction">${directionSymbol}</span>
            <span class="goal-metric">${metricLabel}</span>
            <span class="goal-target">${formatValue(displayTarget)}${unit}</span>
            <span class="goal-completed-badge">✓</span>
          </div>
          <div class="goal-footer">
            <span class="goal-completed-date">Completed ${formatDeadline(goal.completedAt)}</span>
            <div class="goal-actions">
              <button type="button" class="btn sm uncomplete-goal-btn">Reopen</button>
              <button type="button" class="btn sm danger delete-goal-btn">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    completedContainer.innerHTML = '<p class="empty-message">No completed goals yet.</p>';
  }
}

// =============================================================================
// GOALS EVENT LISTENERS (called once)
// =============================================================================

let goalsListenersInitialized = false;

function initGoalsListeners() {
  if (goalsListenersInitialized) return;
  goalsListenersInitialized = true;

  const container = document.getElementById('goals-list');
  const completedContainer = document.getElementById('completed-goals-list');

  // Event delegation for active goals
  container.addEventListener('click', async (e) => {
    const card = e.target.closest('.goal-card');
    if (!card) return;

    const id = card.dataset.id;

    if (e.target.closest('.complete-goal-btn')) {
      await completeGoal(id);
      showToast('Goal completed!');
      await renderGoalsList();
      return;
    }

    if (e.target.closest('.delete-goal-btn')) {
      if (confirm('Delete this goal?')) {
        await deleteGoal(id);
        showToast('Goal deleted');
        await renderGoalsList();
      }
    }
  });

  // Event delegation for completed goals
  completedContainer.addEventListener('click', async (e) => {
    const card = e.target.closest('.goal-card');
    if (!card) return;

    const id = card.dataset.id;

    if (e.target.closest('.uncomplete-goal-btn')) {
      await uncompleteGoal(id);
      showToast('Goal reopened');
      await renderGoalsList();
      return;
    }

    if (e.target.closest('.delete-goal-btn')) {
      if (confirm('Delete this goal?')) {
        await deleteGoal(id);
        showToast('Goal deleted');
        await renderGoalsList();
      }
    }
  });
}
