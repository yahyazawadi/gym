/**
 * Minimal Brutalist Gym PWA Core Logic
 * Pure Vanilla JavaScript (ESM)
 * Offline-first localStorage storage
 */

// Initial Seed Machines (Curated for West Bank gym setups: Machines & Cables)
const DEFAULT_EXERCISES = [
  // PUSH
  { id: 'chest_press', name: 'SEATED CHEST PRESS', split: 'PUSH', muscle: 'CHEST', defaultWeight: 50.0, defaultReps: 10 },
  { id: 'incline_chest_press', name: 'INCLINE CHEST PRESS', split: 'PUSH', muscle: 'UPPER CHEST', defaultWeight: 45.0, defaultReps: 10 },
  { id: 'shoulder_press_machine', name: 'SHOULDER PRESS MACHINE', split: 'PUSH', muscle: 'SHOULDERS', defaultWeight: 35.0, defaultReps: 10 },
  { id: 'pec_deck_fly', name: 'PEC DECK FLY', split: 'PUSH', muscle: 'CHEST', defaultWeight: 40.0, defaultReps: 12 },
  { id: 'cable_tricep_pushdown', name: 'CABLE TRICEP PUSHDOWN', split: 'PUSH', muscle: 'TRICEPS', defaultWeight: 25.0, defaultReps: 12 },
  { id: 'cable_lateral_raise', name: 'CABLE LATERAL RAISE', split: 'PUSH', muscle: 'LATERAL DELT', defaultWeight: 7.5, defaultReps: 15 },

  // PULL
  { id: 'lat_pulldown', name: 'WIDE-GRIP LAT PULLDOWN', split: 'PULL', muscle: 'LATS', defaultWeight: 55.0, defaultReps: 10 },
  { id: 'seated_cable_row', name: 'SEATED CABLE ROW', split: 'PULL', muscle: 'MID BACK', defaultWeight: 50.0, defaultReps: 10 },
  { id: 'chest_supported_row', name: 'T-BAR / CHEST ROW', split: 'PULL', muscle: 'UPPER BACK', defaultWeight: 45.0, defaultReps: 10 },
  { id: 'reverse_pec_deck', name: 'REVERSE PEC DECK', split: 'PULL', muscle: 'REAR DELTS', defaultWeight: 30.0, defaultReps: 15 },
  { id: 'cable_bicep_curl', name: 'CABLE BICEP CURL', split: 'PULL', muscle: 'BICEPS', defaultWeight: 22.5, defaultReps: 12 },
  { id: 'hammer_curl_cable', name: 'ROPE HAMMER CURL', split: 'PULL', muscle: 'BRACHIALIS', defaultWeight: 20.0, defaultReps: 12 },

  // LEGS
  { id: 'leg_press', name: '45° LEG PRESS MACHINE', split: 'LEGS', muscle: 'QUADS / GLUTES', defaultWeight: 120.0, defaultReps: 10 },
  { id: 'hack_squat', name: 'HACK SQUAT MACHINE', split: 'LEGS', muscle: 'QUADS', defaultWeight: 80.0, defaultReps: 10 },
  { id: 'leg_extension', name: 'LEG EXTENSION MACHINE', split: 'LEGS', muscle: 'QUADS', defaultWeight: 45.0, defaultReps: 12 },
  { id: 'seated_leg_curl', name: 'SEATED LEG CURL', split: 'LEGS', muscle: 'HAMSTRINGS', defaultWeight: 40.0, defaultReps: 12 },
  { id: 'standing_calf_raise', name: 'CALF RAISE MACHINE', split: 'LEGS', muscle: 'CALVES', defaultWeight: 60.0, defaultReps: 15 }
];

// State Management
const STATE = {
  currentSplit: 'PUSH',
  selectedExercise: null,
  currentWeight: 50.0,
  currentReps: 10,
  logs: JSON.parse(localStorage.getItem('iron_logs') || '[]'),
  exercises: JSON.parse(localStorage.getItem('iron_exercises') || JSON.stringify(DEFAULT_EXERCISES))
};

// DOM References
const splitNav = document.getElementById('split-nav');
const exerciseList = document.getElementById('exercise-list');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose = document.getElementById('drawer-close');
const drawerTitle = document.getElementById('drawer-title');
const drawerCategory = document.getElementById('drawer-category');
const drawerLastStat = document.getElementById('drawer-last-stat');
const valWeight = document.getElementById('val-weight');
const valReps = document.getElementById('val-reps');
const todaySetsPills = document.getElementById('today-sets-pills');
const btnSaveSet = document.getElementById('btn-save-set');
const currentDateEl = document.getElementById('current-date');

// Format today's date
function initDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  currentDateEl.textContent = `${day}/${month}`;
}

// Get the latest log entry for an exercise
function getLastLog(exerciseId) {
  const matches = STATE.logs.filter(l => l.exerciseId === exerciseId);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

// Get sets logged today for an exercise
function getTodayLogs(exerciseId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return STATE.logs.filter(l => l.exerciseId === exerciseId && l.timestamp.startsWith(todayStr));
}

// Render Exercise Cards for active split
function renderCards() {
  exerciseList.innerHTML = '';

  const filtered = STATE.currentSplit === 'ALL'
    ? STATE.exercises
    : STATE.exercises.filter(e => e.split === STATE.currentSplit);

  filtered.forEach(ex => {
    const last = getLastLog(ex.id);
    const today = getTodayLogs(ex.id);

    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.innerHTML = `
      <div class="card-top">
        <span class="card-title">${ex.name}</span>
        <span class="card-badge">${ex.muscle}</span>
      </div>
      <div class="card-bottom">
        <span class="card-last-stat">${last ? `LAST: ${last.weight}KG × ${last.reps}` : 'NO LOGS'}</span>
        <span class="card-sets-count ${today.length > 0 ? 'done' : ''}">${today.length > 0 ? `${today.length} SETS TODAY` : 'READY'}</span>
      </div>
    `;

    card.addEventListener('click', () => openDrawer(ex));
    exerciseList.appendChild(card);
  });
}

// Open Quick-Log Drawer
function openDrawer(exercise) {
  STATE.selectedExercise = exercise;
  drawerTitle.textContent = exercise.name;
  drawerCategory.textContent = `MACHINE // ${exercise.split}`;

  const last = getLastLog(exercise.id);
  const today = getTodayLogs(exercise.id);

  if (last) {
    drawerLastStat.innerHTML = `LAST: <span>${last.weight} KG × ${last.reps} REPS</span>`;
    // Pre-fill with last logged weight/reps so user just taps "LOG SET"
    STATE.currentWeight = last.weight;
    STATE.currentReps = last.reps;
  } else {
    drawerLastStat.innerHTML = `BASELINE: <span>${exercise.defaultWeight} KG × ${exercise.defaultReps} REPS</span>`;
    STATE.currentWeight = exercise.defaultWeight;
    STATE.currentReps = exercise.defaultReps;
  }

  updateStepperDisplay();
  renderTodayPills(today);

  drawerOverlay.classList.add('open');
}

// Close Drawer
function closeDrawer() {
  drawerOverlay.classList.remove('open');
  STATE.selectedExercise = null;
}

// Update stepper numbers
function updateStepperDisplay() {
  valWeight.textContent = STATE.currentWeight.toFixed(1);
  valReps.textContent = STATE.currentReps;
}

// Render today's sets inside drawer
function renderTodayPills(todayLogs) {
  todaySetsPills.innerHTML = '';
  if (todayLogs.length === 0) {
    todaySetsPills.innerHTML = '<span class="set-pill">NO SETS LOGGED TODAY</span>';
    return;
  }

  todayLogs.forEach((l, idx) => {
    const pill = document.createElement('span');
    pill.className = `set-pill ${idx === todayLogs.length - 1 ? 'recent' : ''}`;
    pill.textContent = `S${idx + 1}: ${l.weight}kg × ${l.reps}`;
    todaySetsPills.appendChild(pill);
  });
}

// Save Set Action
function saveCurrentSet() {
  if (!STATE.selectedExercise) return;

  const newLog = {
    id: 'log_' + Date.now(),
    exerciseId: STATE.selectedExercise.id,
    weight: STATE.currentWeight,
    reps: STATE.currentReps,
    timestamp: new Date().toISOString()
  };

  STATE.logs.push(newLog);
  localStorage.setItem('iron_logs', JSON.stringify(STATE.logs));

  // Visual feedback: update drawer's today pills
  const today = getTodayLogs(STATE.selectedExercise.id);
  renderTodayPills(today);

  // Re-render exercise cards in background
  renderCards();

  // Gentle haptic feedback if supported on mobile
  if (navigator.vibrate) {
    navigator.vibrate(35);
  }
}

// Event Listeners: Steppers
document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const field = e.currentTarget.dataset.field;
    const delta = parseFloat(e.currentTarget.dataset.delta);

    if (field === 'weight') {
      STATE.currentWeight = Math.max(0, parseFloat((STATE.currentWeight + delta).toFixed(1)));
    } else if (field === 'reps') {
      STATE.currentReps = Math.max(1, STATE.currentReps + delta);
    }
    updateStepperDisplay();
  });
});

// Event Listeners: Splits
splitNav.addEventListener('click', (e) => {
  if (!e.target.classList.contains('split-tab')) return;
  document.querySelectorAll('.split-tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  STATE.currentSplit = e.target.dataset.split;
  renderCards();
});

// Event Listeners: Drawer
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', (e) => {
  if (e.target === drawerOverlay) closeDrawer();
});
btnSaveSet.addEventListener('click', saveCurrentSet);

// Initialize
initDate();
renderCards();
