/**
 * Minimal Brutalist Gym PWA Core Logic
 * Pure Vanilla JavaScript (ESM)
 * Remote Session Authentication via Cloudflare Workers + D1
 * Offline-first fallback cache & Service Worker
 */

const API_BASE = 'https://gym-pwa.super-yahyaaa.workers.dev';
const IMAGE_CDN_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Default Calendar Matrix: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const CALENDAR_SCHEDULE = {
  1: 'PUSH', // Mon
  3: 'PULL', // Wed
  5: 'LEGS'  // Fri
};

// Initial Seed Machines (Curated Machines & Cables with accurate exercise images)
const DEFAULT_EXERCISES = [
  // PUSH
  { id: 'leverage_chest_press', name: 'SEATED CHEST PRESS', split: 'PUSH', muscle: 'CHEST', defaultWeight: 50.0, defaultReps: 10, images: ['Leverage_Chest_Press/0.jpg', 'Leverage_Chest_Press/1.jpg'] },
  { id: 'incline_chest_press', name: 'INCLINE CHEST PRESS', split: 'PUSH', muscle: 'UPPER CHEST', defaultWeight: 45.0, defaultReps: 10, images: ['Leverage_Incline_Chest_Press/0.jpg', 'Leverage_Incline_Chest_Press/1.jpg'] },
  { id: 'shoulder_press_machine', name: 'SHOULDER PRESS MACHINE', split: 'PUSH', muscle: 'SHOULDERS', defaultWeight: 35.0, defaultReps: 10, images: ['Leverage_Shoulder_Press/0.jpg', 'Leverage_Shoulder_Press/1.jpg'] },
  { id: 'butterfly', name: 'PEC DECK FLY', split: 'PUSH', muscle: 'CHEST', defaultWeight: 40.0, defaultReps: 12, images: ['Butterfly/0.jpg', 'Butterfly/1.jpg'] },
  { id: 'triceps_pushdown', name: 'CABLE TRICEP PUSHDOWN', split: 'PUSH', muscle: 'TRICEPS', defaultWeight: 25.0, defaultReps: 12, images: ['Triceps_Pushdown/0.jpg', 'Triceps_Pushdown/1.jpg'] },
  { id: 'cable_lateral_raise', name: 'CABLE LATERAL RAISE', split: 'PUSH', muscle: 'LATERAL DELT', defaultWeight: 7.5, defaultReps: 15, images: ['Cable_Seated_Lateral_Raise/0.jpg', 'Cable_Seated_Lateral_Raise/1.jpg'] },

  // PULL
  { id: 'wide_grip_lat_pulldown', name: 'WIDE-GRIP LAT PULLDOWN', split: 'PULL', muscle: 'LATS', defaultWeight: 55.0, defaultReps: 10, images: ['Wide-Grip_Lat_Pulldown/0.jpg', 'Wide-Grip_Lat_Pulldown/1.jpg'] },
  { id: 'seated_cable_rows', name: 'SEATED CABLE ROW', split: 'PULL', muscle: 'MID BACK', defaultWeight: 50.0, defaultReps: 10, images: ['Seated_Cable_Rows/0.jpg', 'Seated_Cable_Rows/1.jpg'] },
  { id: 'reverse_machine_flyes', name: 'REVERSE PEC DECK', split: 'PULL', muscle: 'REAR DELTS', defaultWeight: 30.0, defaultReps: 15, images: ['Reverse_Machine_Flyes/0.jpg', 'Reverse_Machine_Flyes/1.jpg'] },
  { id: 'machine_bicep_curl', name: 'CABLE BICEP CURL', split: 'PULL', muscle: 'BICEPS', defaultWeight: 22.5, defaultReps: 12, images: ['Machine_Bicep_Curl/0.jpg', 'Machine_Bicep_Curl/1.jpg'] },
  { id: 'cable_hammer_curls', name: 'ROPE HAMMER CURL', split: 'PULL', muscle: 'BRACHIALIS', defaultWeight: 20.0, defaultReps: 12, images: ['Cable_Hammer_Curls_-_Rope_Attachment/0.jpg', 'Cable_Hammer_Curls_-_Rope_Attachment/1.jpg'] },

  // LEGS
  { id: 'leg_press', name: '45° LEG PRESS MACHINE', split: 'LEGS', muscle: 'QUADS / GLUTES', defaultWeight: 120.0, defaultReps: 10, images: ['Leg_Press/0.jpg', 'Leg_Press/1.jpg'] },
  { id: 'hack_squat', name: 'HACK SQUAT MACHINE', split: 'LEGS', muscle: 'QUADS', defaultWeight: 80.0, defaultReps: 10, images: ['Hack_Squat/0.jpg', 'Hack_Squat/1.jpg'] },
  { id: 'leg_extensions', name: 'LEG EXTENSION MACHINE', split: 'LEGS', muscle: 'QUADS', defaultWeight: 45.0, defaultReps: 12, images: ['Leg_Extensions/0.jpg', 'Leg_Extensions/1.jpg'] },
  { id: 'seated_leg_curl', name: 'SEATED LEG CURL', split: 'LEGS', muscle: 'HAMSTRINGS', defaultWeight: 40.0, defaultReps: 12, images: ['Seated_Leg_Curl/0.jpg', 'Seated_Leg_Curl/1.jpg'] },
  { id: 'standing_calf_raises', name: 'CALF RAISE MACHINE', split: 'LEGS', muscle: 'CALVES', defaultWeight: 60.0, defaultReps: 15, images: ['Standing_Calf_Raises/0.jpg', 'Standing_Calf_Raises/1.jpg'] }
];

// State Management with auto-healing image paths
function getInitialExercises() {
  const cached = localStorage.getItem('iron_exercises');
  if (!cached) return DEFAULT_EXERCISES;
  try {
    const list = JSON.parse(cached);
    // Auto-heal: Ensure every exercise has its images from DEFAULT_EXERCISES or dataset
    return list.map(item => {
      if (item.images && item.images.length > 0) return item;
      const def = DEFAULT_EXERCISES.find(d => d.id === item.id || d.name === item.name);
      return def ? { ...item, images: def.images } : item;
    });
  } catch (e) {
    return DEFAULT_EXERCISES;
  }
}

const STATE = {
  token: localStorage.getItem('iron_token') || null,
  sessionUser: localStorage.getItem('iron_user') || null,
  authMode: 'login', // 'login' | 'register'
  currentSplit: 'PUSH',
  selectedExercise: null,
  currentWeight: 50.0,
  currentReps: 10,
  logs: JSON.parse(localStorage.getItem('iron_logs') || '[]'),
  exercises: getInitialExercises(),
  fullDataset: [],
  lastFinishedSplit: localStorage.getItem('iron_last_finished_split') || null,
  lastFinishedDate: localStorage.getItem('iron_last_finished_date') || null
};

// DOM References: Views
const authView = document.getElementById('auth-view');
const workoutView = document.getElementById('workout-view');

// DOM References: Auth
const authForm = document.getElementById('auth-form');
const authUsername = document.getElementById('auth-username');
const authPassphrase = document.getElementById('auth-passphrase');
const groupConfirmPass = document.getElementById('group-confirm-pass');
const authConfirmPass = document.getElementById('auth-confirm-passphrase');
const btnToggleAuthMode = document.getElementById('btn-toggle-auth-mode');
const togglePassBtn = document.getElementById('toggle-pass-btn');
const authErrorMsg = document.getElementById('auth-error-msg');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

// DOM References: Workout & Navigation
const connectionStatus = document.getElementById('connection-status');
const currentDateEl = document.getElementById('current-date');
const scheduleBanner = document.getElementById('schedule-banner');
const splitNav = document.getElementById('split-nav');
const routineProgress = document.getElementById('routine-progress');
const exerciseList = document.getElementById('exercise-list');
const btnFinishWorkout = document.getElementById('btn-finish-workout');

// DOM References: Drawers
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose = document.getElementById('drawer-close');
const drawerTitle = document.getElementById('drawer-title');
const drawerCategory = document.getElementById('drawer-category');
const drawerLastStat = document.getElementById('drawer-last-stat');
const drawerPhotoWrap = document.getElementById('drawer-photo-wrap');
const drawerImg0 = document.getElementById('drawer-img-0');
const drawerImg1 = document.getElementById('drawer-img-1');
const valWeight = document.getElementById('val-weight');
const valReps = document.getElementById('val-reps');
const todaySetsPills = document.getElementById('today-sets-pills');
const btnSaveSet = document.getElementById('btn-save-set');
const btnYtGuide = document.getElementById('btn-yt-guide');

// DOM References: Add Machine Drawer
const btnOpenAddMachine = document.getElementById('btn-open-add-machine');
const addMachineOverlay = document.getElementById('add-machine-overlay');
const addMachineClose = document.getElementById('add-machine-close');
const machineSearchInput = document.getElementById('machine-search-input');
const addMachineList = document.getElementById('add-machine-list');

// DOM References: Summary Celebration Drawer
const summaryOverlay = document.getElementById('summary-overlay');
const summaryClose = document.getElementById('summary-close');
const summaryTitle = document.getElementById('summary-title');
const sumVolume = document.getElementById('sum-volume');
const sumSets = document.getElementById('sum-sets');
const summaryNextText = document.getElementById('summary-next-text');
const btnCloseSummary = document.getElementById('btn-close-summary');

// DOM References: Fullscreen Lightbox
const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxCounter = document.getElementById('lightbox-counter');
let lightboxImages = [];
let currentLightboxIndex = 0;

// Register Service Worker for true offline capability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Load full 138 machine dataset from local bundle
async function loadFullDataset() {
  try {
    const res = await fetch('./exercises_dataset.json');
    if (res.ok) {
      STATE.fullDataset = await res.json();
    }
  } catch (err) {
    console.warn('Dataset offline buffer active');
  }
}

// Switch between Login Page and Workout Dashboard
function syncViewState() {
  if (STATE.token && STATE.sessionUser) {
    authView.style.display = 'none';
    workoutView.style.display = 'flex';
    initDate();
    evaluateCalendarSchedule();
    renderCards();
    syncLogsFromServer();
  } else {
    workoutView.style.display = 'none';
    authView.style.display = 'flex';
    authPassphrase.value = '';
    authConfirmPass.value = '';
    authUsername.value = STATE.sessionUser || '';
    if (authUsername.value) {
      authPassphrase.focus();
    } else {
      authUsername.focus();
    }
  }
}

// Format today's date
function initDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  currentDateEl.textContent = `${days[d.getDay()]} ${day}/${month}`;
}

// Smart Schedule Resolver: Evaluate today's schedule, missed days, or rest days
function evaluateCalendarSchedule() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ...
  const todayStr = now.toISOString().slice(0, 10);
  const scheduledSplit = CALENDAR_SCHEDULE[dayOfWeek] || null;

  // Check if today's workout was already finished
  if (STATE.lastFinishedDate === todayStr) {
    scheduleBanner.style.display = 'flex';
    scheduleBanner.className = 'schedule-banner';
    const nextSplit = getNextSequentialSplit(STATE.lastFinishedSplit);
    scheduleBanner.innerHTML = `
      <span class="banner-title">✓ TODAY'S ${STATE.lastFinishedSplit} SESSION COMPLETED</span>
      <span class="banner-desc">Rest and recover. Up next is ${nextSplit}.</span>
    `;
    setSplit(nextSplit);
    return;
  }

  // If today is a scheduled day (Mon/Wed/Fri)
  if (scheduledSplit) {
    scheduleBanner.style.display = 'flex';
    scheduleBanner.className = 'schedule-banner';
    scheduleBanner.innerHTML = `
      <span class="banner-title">TODAY'S SCHEDULE: ${scheduledSplit} DAY</span>
      <span class="banner-desc">Ready to train. Log sets on each machine below.</span>
    `;
    setSplit(scheduledSplit);
    return;
  }

  // Today is an off/rest day (Tue, Thu, Sat, Sun). Check if previous scheduled day was missed!
  const prevScheduled = findPreviousScheduledSplit(dayOfWeek);
  if (prevScheduled && STATE.lastFinishedSplit !== prevScheduled.split) {
    scheduleBanner.style.display = 'flex';
    scheduleBanner.className = 'schedule-banner missed';
    scheduleBanner.innerHTML = `
      <span class="banner-title">⚠️ MISSED SESSION DETECTED</span>
      <span class="banner-desc">You missed ${prevScheduled.split} from ${prevScheduled.dayName}. Resume it today or rest?</span>
      <div class="banner-actions">
        <button class="banner-btn primary" id="btn-catchup">CATCH-UP ${prevScheduled.split}</button>
        <button class="banner-btn" id="btn-skip-rest">STICK TO REST</button>
      </div>
    `;

    document.getElementById('btn-catchup')?.addEventListener('click', () => {
      setSplit(prevScheduled.split);
      scheduleBanner.style.display = 'none';
    });

    document.getElementById('btn-skip-rest')?.addEventListener('click', () => {
      const next = getNextSequentialSplit(prevScheduled.split);
      scheduleBanner.style.display = 'none';
      setSplit(next);
    });

    setSplit(prevScheduled.split);
    return;
  }

  // Normal Rest Day
  const nextSplit = getNextSequentialSplit(STATE.lastFinishedSplit || 'LEGS');
  scheduleBanner.style.display = 'flex';
  scheduleBanner.className = 'schedule-banner';
  scheduleBanner.innerHTML = `
    <span class="banner-title">REST // RECOVERY DAY</span>
    <span class="banner-desc">No workouts scheduled today. Up next: ${nextSplit}.</span>
  `;
  setSplit(nextSplit);
}

function findPreviousScheduledSplit(currentDayOfWeek) {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  for (let d = currentDayOfWeek - 1; d >= 0; d--) {
    if (CALENDAR_SCHEDULE[d]) {
      return { split: CALENDAR_SCHEDULE[d], dayName: dayNames[d] };
    }
  }
  return null;
}

function getNextSequentialSplit(current) {
  if (current === 'PUSH') return 'PULL';
  if (current === 'PULL') return 'LEGS';
  return 'PUSH';
}

function setSplit(split) {
  STATE.currentSplit = split;
  document.querySelectorAll('.split-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.split === split);
  });
  renderCards();
}

// Verify active session with Edge Worker
async function verifySession() {
  if (!STATE.token) {
    syncViewState();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/session`, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.valid) {
      clearSession();
    } else {
      connectionStatus.textContent = `SYNCED // ${data.user.username.toUpperCase()}`;
    }
  } catch (err) {
    connectionStatus.textContent = 'OFFLINE // LOCAL CACHE';
  }
}

// Fetch logs from remote D1
async function syncLogsFromServer() {
  if (!STATE.token) return;

  try {
    const res = await fetch(`${API_BASE}/api/logs`, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        STATE.logs = data.logs.map(l => ({
          id: l.id,
          exerciseId: l.exercise_id,
          weight: l.weight_kg,
          reps: l.reps,
          timestamp: l.logged_at
        }));
        localStorage.setItem('iron_logs', JSON.stringify(STATE.logs));
        renderCards();
      }
    }
  } catch (err) {
    console.warn('Network sync paused, using offline cache');
  }
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

  let machinesWithSetsToday = 0;
  let totalSetsToday = 0;

  filtered.forEach(ex => {
    const last = getLastLog(ex.id);
    const today = getTodayLogs(ex.id);

    if (today.length > 0) {
      machinesWithSetsToday++;
      totalSetsToday += today.length;
    }

    const card = document.createElement('div');
    card.className = 'exercise-card';
    const thumbUrl = (ex.images && ex.images[0])
      ? `${IMAGE_CDN_BASE}${ex.images[0]}`
      : 'dumbbell.svg';

    card.innerHTML = `
      <div class="card-main-row">
        <img class="card-thumb" src="${thumbUrl}" alt="${ex.name}" loading="lazy" onerror="this.src='dumbbell.svg'">
        <div class="card-info">
          <div class="card-top">
            <span class="card-title">${ex.name}</span>
            <span class="card-badge">${ex.muscle}</span>
          </div>
          <div class="card-bottom">
            <span class="card-last-stat">${last ? `LAST: ${last.weight}KG × ${last.reps}` : 'NO LOGS'}</span>
            <span class="card-sets-count ${today.length > 0 ? 'done' : ''}">${today.length > 0 ? `${today.length} SETS TODAY` : 'READY'}</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openDrawer(ex));
    exerciseList.appendChild(card);
  });

  // Update routine progress bar
  routineProgress.textContent = `${machinesWithSetsToday}/${filtered.length} MACHINES LOGGED (${totalSetsToday} SETS)`;

  // Update Finish Workout button status
  if (totalSetsToday > 0) {
    btnFinishWorkout.disabled = false;
    btnFinishWorkout.classList.add('active');
    btnFinishWorkout.textContent = `FINISH ${STATE.currentSplit} WORKOUT (${totalSetsToday} SETS)`;
  } else {
    btnFinishWorkout.disabled = true;
    btnFinishWorkout.classList.remove('active');
    btnFinishWorkout.textContent = 'FINISH WORKOUT (LOG SETS FIRST)';
  }
}

// Open Quick-Log Drawer
function openDrawer(exercise) {
  STATE.selectedExercise = exercise;
  drawerTitle.textContent = exercise.name;
  drawerCategory.textContent = `MACHINE // ${exercise.split}`;

  // Render Machine Photos in Drawer
  if (exercise.images && exercise.images.length >= 1) {
    drawerPhotoWrap.style.display = 'flex';
    drawerImg0.src = `${IMAGE_CDN_BASE}${exercise.images[0]}`;
    if (exercise.images[1]) {
      drawerImg1.style.display = 'block';
      drawerImg1.src = `${IMAGE_CDN_BASE}${exercise.images[1]}`;
    } else {
      drawerImg1.style.display = 'none';
    }
  } else {
    drawerPhotoWrap.style.display = 'none';
  }

  // Set direct YouTube Form Guide URL
  const searchQuery = encodeURIComponent(`${exercise.name.toLowerCase()} exercise form machine proper tutorial`);
  btnYtGuide.href = `https://www.youtube.com/results?search_query=${searchQuery}`;

  const last = getLastLog(exercise.id);
  const today = getTodayLogs(exercise.id);

  if (last) {
    drawerLastStat.innerHTML = `LAST: <span>${last.weight} KG × ${last.reps} REPS</span>`;
    STATE.currentWeight = last.weight;
    STATE.currentReps = last.reps;
  } else {
    drawerLastStat.innerHTML = `BASELINE: <span>${exercise.defaultWeight || 50.0} KG × ${exercise.defaultReps || 10} REPS</span>`;
    STATE.currentWeight = exercise.defaultWeight || 50.0;
    STATE.currentReps = exercise.defaultReps || 10;
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

// Save Set Action (Local first, async background sync to Cloudflare D1)
async function saveCurrentSet() {
  if (!STATE.selectedExercise) return;

  const newLog = {
    id: 'log_' + Date.now(),
    exerciseId: STATE.selectedExercise.id,
    weight: STATE.currentWeight,
    reps: STATE.currentReps,
    timestamp: new Date().toISOString()
  };

  // 1. Immediate local update
  STATE.logs.push(newLog);
  localStorage.setItem('iron_logs', JSON.stringify(STATE.logs));

  const today = getTodayLogs(STATE.selectedExercise.id);
  renderTodayPills(today);
  renderCards();

  if (navigator.vibrate) {
    navigator.vibrate(35);
  }

  // 2. Async background sync to remote D1
  if (STATE.token) {
    fetch(`${API_BASE}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify(newLog)
    }).catch(() => console.warn('Queued log locally (offline)'));
  }
}

// Finish Workout: Lock in session, calculate volume, and auto-advance
function finishWorkoutSession() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = STATE.logs.filter(l => l.timestamp.startsWith(todayStr));

  if (todayLogs.length === 0) return;

  let totalVolume = 0;
  todayLogs.forEach(l => {
    totalVolume += (l.weight * l.reps);
  });

  // Record completed split
  STATE.lastFinishedSplit = STATE.currentSplit;
  STATE.lastFinishedDate = todayStr;
  localStorage.setItem('iron_last_finished_split', STATE.lastFinishedSplit);
  localStorage.setItem('iron_last_finished_date', STATE.lastFinishedDate);

  if (navigator.vibrate) {
    navigator.vibrate([60, 40, 60]);
  }

  // Show summary modal
  summaryTitle.textContent = `${STATE.currentSplit} DAY COMPLETED`;
  sumVolume.textContent = Math.round(totalVolume).toLocaleString();
  sumSets.textContent = todayLogs.length;

  const nextSplit = getNextSequentialSplit(STATE.currentSplit);
  summaryNextText.textContent = `NEXT UP: ${nextSplit} DAY`;
  summaryOverlay.classList.add('open');

  evaluateCalendarSchedule();
}

// Add Machine Drawer Handling
function openAddMachineModal() {
  renderAddMachineList('');
  addMachineOverlay.classList.add('open');
  machineSearchInput.value = '';
  machineSearchInput.focus();
}

function closeAddMachineModal() {
  addMachineOverlay.classList.remove('open');
}

function renderAddMachineList(filterText) {
  addMachineList.innerHTML = '';
  const search = filterText.toLowerCase().trim();

  const dataset = STATE.fullDataset.length > 0 ? STATE.fullDataset : DEFAULT_EXERCISES;
  const filtered = dataset.filter(ex => {
    return ex.name.toLowerCase().includes(search) || ex.muscle.toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    addMachineList.innerHTML = '<div style="font-size:0.75rem; color:var(--muted); padding:10px;">NO MATCHING MACHINES FOUND</div>';
    return;
  }

  filtered.slice(0, 30).forEach(ex => {
    const isAlreadyInRoutine = STATE.exercises.some(e => e.id === ex.id);

    const item = document.createElement('div');
    item.className = 'add-machine-item';
    const thumbUrl = (ex.images && ex.images[0])
      ? `${IMAGE_CDN_BASE}${ex.images[0]}`
      : 'dumbbell.svg';

    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img class="card-thumb" style="width:38px; height:38px;" src="${thumbUrl}" alt="${ex.name}" loading="lazy" onerror="this.src='dumbbell.svg'">
        <div>
          <div class="add-item-name">${ex.name}</div>
          <div class="add-item-tag">${ex.equipment} // ${ex.muscle}</div>
        </div>
      </div>
      <button class="banner-btn ${isAlreadyInRoutine ? '' : 'primary'}">
        ${isAlreadyInRoutine ? 'ADDED' : '+ ADD'}
      </button>
    `;

    if (!isAlreadyInRoutine) {
      item.addEventListener('click', () => {
        STATE.exercises.push({
          id: ex.id,
          name: ex.name,
          split: STATE.currentSplit === 'ALL' ? ex.split : STATE.currentSplit,
          muscle: ex.muscle,
          defaultWeight: 40.0,
          defaultReps: 10,
          images: ex.images || []
        });
        localStorage.setItem('iron_exercises', JSON.stringify(STATE.exercises));
        renderCards();
        closeAddMachineModal();
      });
    }

    addMachineList.appendChild(item);
  });
}

machineSearchInput.addEventListener('input', (e) => {
  renderAddMachineList(e.target.value);
});

// Switch between Login and Register Mode
function setAuthMode(mode) {
  STATE.authMode = mode;
  authErrorMsg.textContent = '';
  if (mode === 'register') {
    groupConfirmPass.style.display = 'block';
    authConfirmPass.required = true;
    btnLogin.textContent = 'CREATE ACCOUNT';
    btnToggleAuthMode.textContent = 'ALREADY REGISTERED? LOG IN';
  } else {
    groupConfirmPass.style.display = 'none';
    authConfirmPass.required = false;
    authConfirmPass.value = '';
    btnLogin.textContent = 'AUTHENTICATE';
    btnToggleAuthMode.textContent = 'NEED AN ACCOUNT? CREATE OPERATOR';
  }
}

btnToggleAuthMode.addEventListener('click', () => {
  setAuthMode(STATE.authMode === 'login' ? 'register' : 'login');
});

// Event Listeners: Auth Form Submission
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = authUsername.value.trim().toLowerCase();
  const passphrase = authPassphrase.value.trim();

  if (!username || !passphrase) {
    authErrorMsg.textContent = 'ENTER BOTH USERNAME AND PASSPHRASE';
    return;
  }

  if (STATE.authMode === 'register') {
    const confirmPass = authConfirmPass.value.trim();
    if (passphrase !== confirmPass) {
      authErrorMsg.textContent = 'PASSPHRASES DO NOT MATCH';
      return;
    }
  }

  btnLogin.textContent = STATE.authMode === 'register' ? 'REGISTERING...' : 'AUTHENTICATING...';
  btnLogin.disabled = true;
  authErrorMsg.textContent = '';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passphrase })
    });

    const data = await res.json();

    if (!res.ok) {
      authErrorMsg.textContent = data.error || 'AUTHENTICATION FAILED';
      btnLogin.textContent = STATE.authMode === 'register' ? 'CREATE ACCOUNT' : 'AUTHENTICATE';
      btnLogin.disabled = false;
      return;
    }

    STATE.token = data.token;
    STATE.sessionUser = data.user.username;
    localStorage.setItem('iron_token', data.token);
    localStorage.setItem('iron_user', data.user.username);

    btnLogin.textContent = 'AUTHENTICATE';
    btnLogin.disabled = false;
    syncViewState();
  } catch (err) {
    // Offline fallback token
    STATE.sessionUser = username;
    STATE.token = 'local_fallback_tok';
    localStorage.setItem('iron_user', username);
    localStorage.setItem('iron_token', 'local_fallback_tok');
    btnLogin.textContent = 'AUTHENTICATE';
    btnLogin.disabled = false;
    syncViewState();
  }
});

// Toggle password peek
togglePassBtn.addEventListener('click', () => {
  const isPass = authPassphrase.type === 'password';
  authPassphrase.type = isPass ? 'text' : 'password';
  togglePassBtn.style.color = isPass ? 'var(--text)' : 'var(--muted)';
});

const toggleConfirmPassBtn = document.getElementById('toggle-confirm-pass-btn');
if (toggleConfirmPassBtn) {
  toggleConfirmPassBtn.addEventListener('click', () => {
    const isPass = authConfirmPass.type === 'password';
    authConfirmPass.type = isPass ? 'text' : 'password';
    toggleConfirmPassBtn.style.color = isPass ? 'var(--text)' : 'var(--muted)';
  });
}

// Logout / Lock Action
function clearSession() {
  if (STATE.token && STATE.token !== 'local_fallback_tok') {
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    }).catch(() => {});
  }
  STATE.token = null;
  STATE.sessionUser = null;
  localStorage.removeItem('iron_token');
  localStorage.removeItem('iron_user');

  closeDrawer();
  closeAddMachineModal();
  summaryOverlay.classList.remove('open');
  setAuthMode('login');
  syncViewState();
}

btnLogout.addEventListener('click', clearSession);

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
  setSplit(e.target.dataset.split);
});

// Event Listeners: Drawers
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', (e) => {
  if (e.target === drawerOverlay) closeDrawer();
});
btnSaveSet.addEventListener('click', saveCurrentSet);

btnFinishWorkout.addEventListener('click', finishWorkoutSession);

btnOpenAddMachine.addEventListener('click', openAddMachineModal);
addMachineClose.addEventListener('click', closeAddMachineModal);
addMachineOverlay.addEventListener('click', (e) => {
  if (e.target === addMachineOverlay) closeAddMachineModal();
});

summaryClose.addEventListener('click', () => summaryOverlay.classList.remove('open'));
btnCloseSummary.addEventListener('click', () => summaryOverlay.classList.remove('open'));

// Fullscreen Lightbox Controls
function openLightbox(images, startIndex = 0) {
  if (!images || images.length === 0) return;
  lightboxImages = images.map(img => img.startsWith('http') ? img : `${IMAGE_CDN_BASE}${img}`);
  currentLightboxIndex = startIndex;
  renderLightboxImage();
  lightboxOverlay.classList.add('open');
}

function closeLightbox() {
  lightboxOverlay.classList.remove('open');
}

function renderLightboxImage() {
  lightboxImg.src = lightboxImages[currentLightboxIndex];
  lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${lightboxImages.length}`;
  lightboxPrev.style.display = lightboxImages.length > 1 ? 'flex' : 'none';
  lightboxNext.style.display = lightboxImages.length > 1 ? 'flex' : 'none';
}

function nextLightboxImage() {
  currentLightboxIndex = (currentLightboxIndex + 1) % lightboxImages.length;
  renderLightboxImage();
}

function prevLightboxImage() {
  currentLightboxIndex = (currentLightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  renderLightboxImage();
}

// Lightbox click handlers
drawerImg0.addEventListener('click', () => {
  if (STATE.selectedExercise && STATE.selectedExercise.images) {
    openLightbox(STATE.selectedExercise.images, 0);
  }
});

drawerImg1.addEventListener('click', () => {
  if (STATE.selectedExercise && STATE.selectedExercise.images) {
    openLightbox(STATE.selectedExercise.images, 1);
  }
});

lightboxClose.addEventListener('click', closeLightbox);
lightboxNext.addEventListener('click', (e) => {
  e.stopPropagation();
  nextLightboxImage();
});
lightboxPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  prevLightboxImage();
});
lightboxOverlay.addEventListener('click', (e) => {
  if (e.target === lightboxOverlay) closeLightbox();
});

// Keyboard controls (Esc to close, left/right arrows)
window.addEventListener('keydown', (e) => {
  if (!lightboxOverlay.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') nextLightboxImage();
  if (e.key === 'ArrowLeft') prevLightboxImage();
});

// Initial Launch Sequence
loadFullDataset();
syncViewState();
verifySession();
