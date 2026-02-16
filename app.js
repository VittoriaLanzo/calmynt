const STORAGE_KEY = 'focus_blocks_state_v1';
const PREFS_KEY = 'focus_blocks_prefs_v1';

const CONFIG = {
  dayStart: 7,
  dayEnd: 23,
  hourHeight: 48,
};

const LIMITS = {
  maxBlocks: 500,
  titleMax: 60,
  durationMin: 15,
  durationMax: 480,
  customMin: 5,
  customMax: 180,
  maxImageBytes: 5 * 1024 * 1024,
  maxImageDataLength: 7000000,
  maxImportBytes: 10 * 1024 * 1024,
};

const STATE = {
  blocks: [],
  selectedId: null,
  weekStart: startOfWeek(new Date()),
  view: 'today',
  focusMode: false,
  focusTarget: null,
  today: {
    tasks: [],
    events: [],
    prefs: {
      bufferMinutes: 5,
      visualDensity: 'cozy',
      reminderStyle: 'soft',
    },
  },
  timer: {
    mode: 'focus',
    remaining: 25 * 60,
    total: 25 * 60,
    running: false,
    linkedBlockId: null,
    intervalId: null,
  },
};

const PREFS = {
  simpleMode: true,
};

const elements = {
  hours: document.getElementById('hours'),
  days: document.getElementById('days'),
  weekRange: document.getElementById('week-range'),
  blockForm: document.getElementById('block-form'),
  blockTitle: document.getElementById('block-title'),
  blockDay: document.getElementById('block-day'),
  blockStart: document.getElementById('block-start'),
  blockDuration: document.getElementById('block-duration'),
  blockType: document.getElementById('block-type'),
  selectionCard: document.getElementById('selection-card'),
  currentStreak: document.getElementById('current-streak'),
  longestStreak: document.getElementById('longest-streak'),
  streakNote: document.getElementById('streak-note'),
  todayCompleted: document.getElementById('today-completed'),
  todayMinutes: document.getElementById('today-minutes'),
  todayPending: document.getElementById('today-pending'),
  timerDisplay: document.getElementById('timer-display'),
  timerHint: document.getElementById('timer-hint'),
  toast: document.getElementById('toast'),
  quickAddForm: document.getElementById('quick-add-form'),
  quickAddInput: document.getElementById('quick-add-input'),
  inboxList: document.getElementById('inbox-list'),
  priorityList: document.getElementById('priority-list'),
  optionalList: document.getElementById('optional-list'),
  todayTimeline: document.getElementById('today-timeline'),
  nextTransition: document.getElementById('next-transition'),
  focusPanel: document.getElementById('focus-panel'),
  focusTitle: document.getElementById('focus-title'),
  focusSubtitle: document.getElementById('focus-subtitle'),
  focusMicrostep: document.getElementById('focus-microstep'),
  bufferMinutes: document.getElementById('buffer-minutes'),
  density: document.getElementById('density'),
  reminderStyle: document.getElementById('reminder-style'),
};

const MODE_DURATIONS = {
  focus: 25 * 60,
  break: 5 * 60,
  long: 15 * 60,
};

const BLOCK_TYPES = new Set(['focus', 'review', 'admin', 'break', 'event']);

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let blockDrag = null;

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShort(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRange(start) {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatShort(start)} - ${formatShort(end)}`;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function parseISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isISODate(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return formatISO(parsed) === value;
}

function isTimeValue(value) {
  if (typeof value !== 'string') return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function safeText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/\\s+/g, ' ').trim().slice(0, maxLen);
}

function toMinutes(timeValue) {
  const [hours, minutes] = timeValue.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTimeLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getTodayISO() {
  return formatISO(new Date());
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getDayColumnFromPoint(x, y) {
  const columns = Array.from(document.querySelectorAll('.day-column'));
  return columns.find((col) => {
    const rect = col.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
}

function getMinutesFromClientY(y, bodyRect) {
  const relative = y - bodyRect.top;
  const minutes = CONFIG.dayStart * 60 + (relative / CONFIG.hourHeight) * 60;
  const snap = 5;
  return Math.round(minutes / snap) * snap;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 1800);
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        blocks: STATE.blocks,
        today: {
          tasks: STATE.today.tasks,
          events: STATE.today.events,
          prefs: STATE.today.prefs,
        },
      })
    );
  } catch (err) {
    showToast('Unable to save locally.');
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.blocks)) {
      STATE.blocks = sanitizeBlocks(data.blocks);
    }
    if (data.today) {
      STATE.today.tasks = sanitizeTasks(data.today.tasks || []);
      STATE.today.events = sanitizeEvents(data.today.events || []);
      STATE.today.prefs = sanitizePrefs(data.today.prefs || {});
    }
  } catch (err) {
    // ignore
  }
}

function applyPrefs() {
  document.body.classList.toggle('simple-mode', PREFS.simpleMode);
  document.body.classList.toggle('power-mode', !PREFS.simpleMode);
  if (PREFS.simpleMode && elements.blockType) {
    elements.blockType.value = 'focus';
  }
  const modeBtn = document.getElementById('toggle-mode');
  if (modeBtn) {
    modeBtn.classList.toggle('active', !PREFS.simpleMode);
    modeBtn.setAttribute('aria-pressed', (!PREFS.simpleMode).toString());
    modeBtn.textContent = PREFS.simpleMode ? 'Mode: Simple' : 'Mode: Power';
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(PREFS));
  } catch (err) {
    // ignore
  }
}

function loadPrefs() {
  const raw = localStorage.getItem(PREFS_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (typeof data.simpleMode === 'boolean') {
      PREFS.simpleMode = data.simpleMode;
    } else if (typeof data.mode === 'string') {
      PREFS.simpleMode = data.mode !== 'power';
    }
  } catch (err) {
    // ignore
  }
}

function normalizeBlock(raw, fallbackDate) {
  if (!raw || typeof raw !== 'object') return null;
  const title = safeText(raw.title, LIMITS.titleMax);
  if (!title) return null;
  const date = isISODate(raw.date) ? raw.date : fallbackDate;
  const start = isTimeValue(raw.start) ? raw.start : '09:00';
  const durationRaw = Number(raw.duration);
  const duration = clamp(
    Number.isFinite(durationRaw) ? durationRaw : 60,
    LIMITS.durationMin,
    LIMITS.durationMax
  );
  const type = BLOCK_TYPES.has(raw.type) ? raw.type : 'focus';
  const done = Boolean(raw.done);
  const idSource = safeText(raw.id, 64);
  const image = typeof raw.image === 'string' && raw.image.startsWith('data:image/')
    && raw.image.length <= LIMITS.maxImageDataLength
    ? raw.image
    : null;
  return {
    id: idSource || `block_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title,
    date,
    start,
    duration,
    type,
    done,
    image,
  };
}

function sanitizeBlocks(rawBlocks) {
  const fallbackDate = formatISO(new Date());
  const sanitized = [];
  const seen = new Set();
  rawBlocks.slice(0, LIMITS.maxBlocks).forEach((raw) => {
    const block = normalizeBlock(raw, fallbackDate);
    if (!block) return;
    if (seen.has(block.id)) {
      block.id = `block_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    seen.add(block.id);
    sanitized.push(block);
  });
  return sanitized;
}

function sanitizeTasks(rawTasks) {
  if (!Array.isArray(rawTasks)) return [];
  const sanitized = [];
  const seen = new Set();
  rawTasks.slice(0, LIMITS.maxBlocks).forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const title = safeText(raw.title, LIMITS.titleMax);
    if (!title) return;
    const id = safeText(raw.id, 64) || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const duration = clamp(Number(raw.duration) || 25, 5, 240);
    const tags = Array.isArray(raw.tags) ? raw.tags.map((tag) => safeText(tag, 24)).filter(Boolean) : [];
    const status = ['inbox', 'today', 'done', 'deferred'].includes(raw.status) ? raw.status : 'inbox';
    const priority = ['must', 'optional'].includes(raw.priority) ? raw.priority : null;
    const microStep = safeText(raw.microStep || '', 80);
    const suggestedStart = Number.isFinite(raw.suggestedStart) ? raw.suggestedStart : null;
    const scheduledStart = Number.isFinite(raw.scheduledStart) ? raw.scheduledStart : null;
    sanitized.push({
      id,
      title,
      duration,
      tags,
      status,
      priority,
      microStep,
      suggestedStart,
      scheduledStart,
      createdAt: Number(raw.createdAt) || Date.now(),
    });
  });
  return sanitized;
}

function sanitizeEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];
  const sanitized = [];
  const seen = new Set();
  rawEvents.slice(0, LIMITS.maxBlocks).forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const title = safeText(raw.title, LIMITS.titleMax);
    if (!title) return;
    const id = safeText(raw.id, 64) || `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const date = isISODate(raw.date) ? raw.date : formatISO(new Date());
    const start = isTimeValue(raw.start) ? raw.start : '09:00';
    const duration = clamp(Number(raw.duration) || 30, 5, 240);
    const tags = Array.isArray(raw.tags) ? raw.tags.map((tag) => safeText(tag, 24)).filter(Boolean) : [];
    const protectedBlock = Boolean(raw.protected);
    sanitized.push({
      id,
      title,
      date,
      start,
      duration,
      tags,
      protected: protectedBlock,
      linkedBlockId: safeText(raw.linkedBlockId || '', 64) || null,
    });
  });
  return sanitized;
}

function sanitizePrefs(raw) {
  return {
    bufferMinutes: clamp(Number(raw.bufferMinutes) || 5, 5, 10),
    visualDensity: raw.visualDensity === 'compact' ? 'compact' : 'cozy',
    reminderStyle: raw.reminderStyle === 'off' ? 'off' : 'soft',
  };
}

function applyTodayPrefs() {
  document.body.classList.toggle('density-compact', STATE.today.prefs.visualDensity === 'compact');
  if (elements.bufferMinutes) elements.bufferMinutes.value = String(STATE.today.prefs.bufferMinutes);
  if (elements.density) elements.density.value = STATE.today.prefs.visualDensity;
  if (elements.reminderStyle) elements.reminderStyle.value = STATE.today.prefs.reminderStyle;
}

function renderHours() {
  elements.hours.innerHTML = '';
  elements.hours.style.gridTemplateRows = `repeat(${CONFIG.dayEnd - CONFIG.dayStart}, var(--hour-height))`;
  for (let hour = CONFIG.dayStart; hour < CONFIG.dayEnd; hour += 1) {
    const label = document.createElement('div');
    label.textContent = `${String(hour).padStart(2, '0')}:00`;
    elements.hours.appendChild(label);
  }
}

function renderDayOptions() {
  elements.blockDay.innerHTML = '';
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(STATE.weekStart, i);
    const option = document.createElement('option');
    option.value = formatISO(date);
    option.textContent = `${dayNames[i]} ${formatShort(date)}`;
    elements.blockDay.appendChild(option);
  }
  const todayIso = formatISO(new Date());
  if (Array.from(elements.blockDay.options).some((opt) => opt.value === todayIso)) {
    elements.blockDay.value = todayIso;
  }
}

function renderWeek() {
  elements.weekRange.textContent = formatRange(STATE.weekStart);
  elements.days.innerHTML = '';

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(STATE.weekStart, i);
    const column = document.createElement('div');
    column.className = 'day-column';
    column.dataset.date = formatISO(date);
    if (formatISO(date) === formatISO(new Date())) {
      column.classList.add('today');
    }

    const header = document.createElement('div');
    header.className = 'day-header';
    header.textContent = `${dayNames[i]} ${formatShort(date)}`;

    const body = document.createElement('div');
    body.className = 'day-body';
    body.style.height = `var(--calendar-height)`;

    column.appendChild(header);
    column.appendChild(body);
    elements.days.appendChild(column);
  }
}

function startBlockDrag(event, block) {
  if (event.button !== 0) return;
  blockDrag = {
    id: block.id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function handleBlockDragMove(event) {
  if (!blockDrag || blockDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - blockDrag.startX;
  const dy = event.clientY - blockDrag.startY;
  if (!blockDrag.moved && Math.hypot(dx, dy) > 4) {
    blockDrag.moved = true;
  }
  if (!blockDrag.moved) return;

  const column = getDayColumnFromPoint(event.clientX, event.clientY);
  if (!column) return;
  const body = column.querySelector('.day-body');
  if (!body) return;
  const block = STATE.blocks.find((item) => item.id === blockDrag.id);
  if (!block) return;

  const bodyRect = body.getBoundingClientRect();
  const startMinutes = getMinutesFromClientY(event.clientY, bodyRect);
  const maxStart = CONFIG.dayEnd * 60 - block.duration;
  const clamped = clamp(startMinutes, CONFIG.dayStart * 60, maxStart);
  block.start = formatTimeLabel(clamped);
  block.date = column.dataset.date;
  renderBlocks();
}

function handleBlockDragEnd(event) {
  if (!blockDrag || blockDrag.pointerId !== event.pointerId) return;
  const blockId = blockDrag.id;
  const moved = blockDrag.moved;
  blockDrag = null;
  if (moved) {
    STATE.selectedId = blockId;
    saveState();
    renderSelection();
    renderBlocks();
    return;
  }
  STATE.selectedId = blockId;
  renderSelection();
  renderBlocks();
}

function renderBlocks() {
  document.querySelectorAll('.day-body').forEach((body) => {
    body.innerHTML = '';
  });

  const weekStartIso = formatISO(STATE.weekStart);
  const weekEndIso = formatISO(addDays(STATE.weekStart, 6));

  STATE.blocks.forEach((block) => {
    if (block.date < weekStartIso || block.date > weekEndIso) return;
    const column = document.querySelector(`.day-column[data-date="${block.date}"]`);
    if (!column) return;
    const body = column.querySelector('.day-body');

    const startMinutes = toMinutes(block.start);
    const endMinutes = startMinutes + block.duration;
    const startClamp = clamp(startMinutes, CONFIG.dayStart * 60, CONFIG.dayEnd * 60);
    const endClamp = clamp(endMinutes, CONFIG.dayStart * 60, CONFIG.dayEnd * 60);

    const top = ((startClamp - CONFIG.dayStart * 60) / 60) * CONFIG.hourHeight;
    const height = Math.max(((endClamp - startClamp) / 60) * CONFIG.hourHeight, 20);

    const blockEl = document.createElement('div');
    blockEl.className = `block ${block.type}`;
    if (block.done) blockEl.classList.add('done');
    if (STATE.selectedId === block.id) blockEl.classList.add('selected');
    blockEl.style.top = `${top}px`;
    blockEl.style.height = `${height}px`;
    if (block.image) {
      blockEl.classList.add('has-image');
      blockEl.style.backgroundImage = `url(${block.image})`;
      blockEl.style.backgroundSize = '100% 100%';
      blockEl.style.backgroundPosition = 'center';
      blockEl.style.backgroundRepeat = 'no-repeat';
    }

    const title = document.createElement('div');
    title.textContent = block.title;

    const time = document.createElement('div');
    time.className = 'block-time';
    time.textContent = `${block.start} (${block.duration}m)`;

    const footer = document.createElement('div');
    footer.className = 'block-footer';
    const status = document.createElement('span');
    status.textContent = block.done ? 'Done' : 'Pending';
    const tag = document.createElement('span');
    tag.className = 'block-tag';
    tag.textContent = block.type;
    footer.appendChild(status);
    footer.appendChild(tag);

    blockEl.appendChild(title);
    blockEl.appendChild(time);
    blockEl.appendChild(footer);

    blockEl.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      startBlockDrag(event, block);
      blockEl.classList.add('dragging');
    });

    blockEl.addEventListener('pointerup', () => {
      blockEl.classList.remove('dragging');
    });

    body.appendChild(blockEl);
  });
}

function renderSelection() {
  const block = STATE.blocks.find((item) => item.id === STATE.selectedId);
  if (!block) {
    elements.selectionCard.innerHTML = `
      <h2>Selected block</h2>
      <div class="selection-empty">Select a block to view details.</div>
    `;
    elements.timerHint.textContent = 'Select a block to link the timer.';
    STATE.timer.linkedBlockId = null;
    return;
  }

  const doneText = block.done ? 'Done' : 'Pending';
  const safeTitle = escapeHtml(block.title);
  const safeDate = escapeHtml(block.date);
  const safeStart = escapeHtml(block.start);
  const safeType = escapeHtml(block.type);
  elements.selectionCard.innerHTML = `
    <h2>Selected block</h2>
    <div class="selection-title">${safeTitle}</div>
    <div class="selection-row"><span>Date</span><span>${safeDate}</span></div>
    <div class="selection-row"><span>Time</span><span>${safeStart} (${block.duration}m)</span></div>
    <div class="selection-row"><span>Type</span><span>${safeType}</span></div>
    <div class="selection-row"><span>Status</span><span>${doneText}</span></div>
    <div class="image-preview" id="image-preview">No image</div>
    <div class="image-actions">
      <label class="ghost file-upload">
        Upload image
        <input type="file" id="image-upload" accept="image/*" />
      </label>
      <button class="ghost" id="remove-image">Remove</button>
    </div>
    <div class="image-hint">Max 5MB. Images are stretched to fit.</div>
    <div class="selection-actions">
      <button class="primary" id="link-timer">Link timer</button>
      <button class="ghost" id="mark-done">${block.done ? 'Undo' : 'Mark done'}</button>
      <button class="ghost" id="delete-block">Delete</button>
    </div>
  `;

  document.getElementById('link-timer').addEventListener('click', () => {
    STATE.timer.linkedBlockId = block.id;
    setTimerSeconds(block.duration * 60, 'custom');
    elements.timerHint.textContent = `Linked to ${block.title}.`;
    showToast('Timer linked to block.');
  });

  document.getElementById('mark-done').addEventListener('click', () => {
    const action = block.done ? 'undo' : 'mark';
    const ok = window.confirm(action === 'mark' ? 'Mark this block as done?' : 'Undo completion for this block?');
    if (!ok) return;
    block.done = !block.done;
    saveState();
    renderAll();
  });

  document.getElementById('delete-block').addEventListener('click', () => {
    const ok = window.confirm('Delete this block?');
    if (!ok) return;
    STATE.blocks = STATE.blocks.filter((item) => item.id !== block.id);
    STATE.selectedId = null;
    saveState();
    renderAll();
  });

  const imagePreview = document.getElementById('image-preview');
  const removeBtn = document.getElementById('remove-image');
  if (block.image && imagePreview) {
    imagePreview.classList.add('has-image');
    imagePreview.style.backgroundImage = `url(${block.image})`;
    imagePreview.style.backgroundSize = '100% 100%';
    imagePreview.style.backgroundPosition = 'center';
    imagePreview.style.backgroundRepeat = 'no-repeat';
    imagePreview.textContent = '';
  }
  if (removeBtn) {
    removeBtn.disabled = !block.image;
    removeBtn.addEventListener('click', () => {
      if (!block.image) return;
      block.image = null;
      saveState();
      renderAll();
      showToast('Image removed.');
    });
  }

  const uploadInput = document.getElementById('image-upload');
  if (uploadInput) {
    uploadInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Only image files are allowed.');
        return;
      }
      if (file.size > LIMITS.maxImageBytes) {
        showToast('Image too large (max 5MB).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') return;
        if (!result.startsWith('data:image/')) {
          showToast('Invalid image data.');
          return;
        }
        if (result.length > LIMITS.maxImageDataLength) {
          showToast('Image too large to store.');
          return;
        }
        block.image = result;
        saveState();
        renderAll();
        showToast('Image added.');
      };
      reader.readAsDataURL(file);
    });
  }

  if (STATE.timer.linkedBlockId === block.id) {
    elements.timerHint.textContent = `Linked to ${block.title}.`;
  } else {
    elements.timerHint.textContent = `Selected ${block.title}. Link timer to use block duration.`;
  }
}

function computeStreaks() {
  const doneDates = new Set(STATE.blocks.filter((b) => b.done).map((b) => b.date));
  let current = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (doneDates.has(formatISO(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = Array.from(doneDates).sort();
  let longest = 0;
  let streak = 0;
  let prev = null;

  sorted.forEach((dateStr) => {
    if (!prev) {
      streak = 1;
    } else {
      const prevDate = parseISO(prev);
      prevDate.setDate(prevDate.getDate() + 1);
      if (formatISO(prevDate) === dateStr) {
        streak += 1;
      } else {
        streak = 1;
      }
    }
    longest = Math.max(longest, streak);
    prev = dateStr;
  });

  elements.currentStreak.textContent = current;
  elements.longestStreak.textContent = longest;

  if (current === 0) {
    elements.streakNote.textContent = 'Complete a block today to start a streak.';
  } else {
    elements.streakNote.textContent = `You are on a ${current}-day streak.`;
  }
}

function renderTodayStats() {
  const today = formatISO(new Date());
  const todayBlocks = STATE.blocks.filter((b) => b.date === today);
  const completed = todayBlocks.filter((b) => b.done);
  const pending = todayBlocks.filter((b) => !b.done);
  const minutes = completed.reduce((sum, b) => sum + b.duration, 0);

  elements.todayCompleted.textContent = completed.length;
  elements.todayPending.textContent = pending.length;
  elements.todayMinutes.textContent = minutes;
}

function getTodayTasks() {
  return STATE.today.tasks.filter((task) => task.status === 'today' && task.priority);
}

function getInboxTasks() {
  return STATE.today.tasks.filter((task) => task.status === 'inbox' || task.status === 'deferred');
}

function sortTasksForToday(tasks) {
  const order = { must: 0, optional: 1 };
  return [...tasks].sort((a, b) => {
    const priorityDiff = order[a.priority] - order[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt - b.createdAt;
  });
}

function groupTasksByTag(tasks) {
  const groups = new Map();
  tasks.forEach((task) => {
    const tag = task.tags[0] || 'general';
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(task);
  });
  return Array.from(groups.entries()).map(([tag, items]) => ({ tag, items }));
}

function buildTodayBlocks() {
  const today = getTodayISO();
  const events = STATE.today.events
    .filter((event) => event.date === today)
    .map((event) => ({
      id: event.id,
      kind: 'event',
      title: event.title,
      startMinutes: TodayOS.toMinutes(event.start),
      start: event.start,
      duration: event.duration,
      protected: event.protected,
      sourceId: event.id,
      tags: event.tags,
    }));

  const todayTasks = sortTasksForToday(getTodayTasks());
  const groups = groupTasksByTag(todayTasks);
  const nowMinutes = getNowMinutes();
  const taskBlocks = groups.map((group, index) => {
    const totalDuration = group.items.reduce((sum, task) => sum + task.duration, 0);
    const scheduledStarts = group.items.map((task) => task.scheduledStart).filter((value) => Number.isFinite(value));
    const startMinutes = scheduledStarts.length ? Math.min(...scheduledStarts) : nowMinutes;
    const title = group.items.length > 1 ? `Batch: ${group.tag} (${group.items.length})` : group.items[0].title;
    return {
      id: `taskblock_${group.tag}_${index}`,
      kind: 'task',
      title,
      startMinutes,
      start: TodayOS.formatTime(startMinutes),
      duration: totalDuration,
      protected: false,
      taskIds: group.items.map((task) => task.id),
      tags: [group.tag],
    };
  });

  return { events, taskBlocks };
}

function suggestSlotForTask(duration, baseStart = null) {
  const buffer = STATE.today.prefs.bufferMinutes;
  const nowMinutes = getNowMinutes();
  let cursor = Number.isFinite(baseStart) ? baseStart : nowMinutes;
  const events = buildTodayBlocks().events.sort((a, b) => a.startMinutes - b.startMinutes);
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (cursor + duration + buffer <= event.startMinutes) {
      return cursor;
    }
    cursor = Math.max(cursor, event.startMinutes + event.duration + buffer);
  }
  return cursor <= CONFIG.dayEnd * 60 ? cursor : null;
}

function computeSchedulePreview() {
  const { events, taskBlocks } = buildTodayBlocks();
  const nowMinutes = getNowMinutes();
  const blocks = [...events, ...taskBlocks].map((block, index) => ({ ...block, order: index }));
  const { replanned, deferred } = TodayOS.autoReplan({
    nowMinutes,
    blocks,
    bufferMinutes: STATE.today.prefs.bufferMinutes,
    dayEndMinutes: CONFIG.dayEnd * 60,
  });
  const timeline = TodayOS.buildSchedule(replanned, STATE.today.prefs.bufferMinutes);
  return { timeline, deferred, replanned };
}

function renderTaskRow(task, options) {
  const row = document.createElement('div');
  row.className = 'task-row';

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;
  row.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  const suggestionText = task.suggestedStart ? ` · suggested ${formatTimeLabel(task.suggestedStart)}` : '';
  const statusText = task.status === 'deferred' ? ' · deferred' : '';
  meta.textContent = `${task.duration}m${suggestionText}${statusText}`;
  row.appendChild(meta);

  if (task.tags.length) {
    const tags = document.createElement('div');
    task.tags.forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tags.appendChild(span);
    });
    row.appendChild(tags);
  }

  if (options.showMicroStep) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'First 30 seconds...';
    input.maxLength = 80;
    input.value = task.microStep || '';
    input.addEventListener('input', () => {
      task.microStep = input.value;
      saveState();
    });
    row.appendChild(input);
  }

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  options.actions.forEach((action) => actions.appendChild(action));
  row.appendChild(actions);

  return row;
}

function renderTodayLists() {
  if (!elements.inboxList || !elements.priorityList || !elements.optionalList) return;
  elements.inboxList.innerHTML = '';
  elements.priorityList.innerHTML = '';
  elements.optionalList.innerHTML = '';

  const todayTasks = getTodayTasks();
  const inboxTasks = getInboxTasks();

  inboxTasks.forEach((task) => {
    const addMust = document.createElement('button');
    addMust.className = 'ghost';
    addMust.textContent = 'Plan must';
    addMust.disabled = !TodayOS.applyHardCaps(STATE.today.tasks, 'must');
    addMust.addEventListener('click', () => {
      if (!TodayOS.applyHardCaps(STATE.today.tasks, 'must')) return;
      task.status = 'today';
      task.priority = 'must';
      task.scheduledStart = task.suggestedStart;
      saveState();
      renderTodayView();
    });

    const addOptional = document.createElement('button');
    addOptional.className = 'ghost';
    addOptional.textContent = 'Plan optional';
    addOptional.disabled = !TodayOS.applyHardCaps(STATE.today.tasks, 'optional');
    addOptional.addEventListener('click', () => {
      if (!TodayOS.applyHardCaps(STATE.today.tasks, 'optional')) return;
      task.status = 'today';
      task.priority = 'optional';
      task.scheduledStart = task.suggestedStart;
      saveState();
      renderTodayView();
    });

    const remove = document.createElement('button');
    remove.className = 'ghost';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      STATE.today.tasks = STATE.today.tasks.filter((item) => item.id !== task.id);
      saveState();
      renderTodayView();
    });

    elements.inboxList.appendChild(renderTaskRow(task, { actions: [addMust, addOptional, remove], showMicroStep: false }));
  });

  sortTasksForToday(todayTasks).forEach((task) => {
    const doneBtn = document.createElement('button');
    doneBtn.className = 'ghost';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => {
      task.status = 'done';
      task.priority = null;
      saveState();
      renderTodayView();
    });

    const deferBtn = document.createElement('button');
    deferBtn.className = 'ghost';
    deferBtn.textContent = 'Send to inbox';
    deferBtn.addEventListener('click', () => {
      task.status = 'inbox';
      task.priority = null;
      task.suggestedStart = null;
      task.scheduledStart = null;
      saveState();
      renderTodayView();
    });

    const durationDown = document.createElement('button');
    durationDown.className = 'ghost';
    durationDown.textContent = '-5m';
    durationDown.addEventListener('click', () => {
      task.duration = clamp(task.duration - 5, 5, 240);
      saveState();
      renderTodayView();
    });

    const durationUp = document.createElement('button');
    durationUp.className = 'ghost';
    durationUp.textContent = '+5m';
    durationUp.addEventListener('click', () => {
      task.duration = clamp(task.duration + 5, 5, 240);
      saveState();
      renderTodayView();
    });

    const list = task.priority === 'must' ? elements.priorityList : elements.optionalList;
    list.appendChild(renderTaskRow(task, { actions: [durationDown, durationUp, doneBtn, deferBtn], showMicroStep: true }));
  });
}

function renderTimeline() {
  if (!elements.todayTimeline) return;
  elements.todayTimeline.innerHTML = '';
  const { timeline, deferred } = computeSchedulePreview();
  timeline.forEach((block) => {
    const row = document.createElement('div');
    row.className = `timeline-item ${block.kind === 'buffer' ? 'buffer' : ''}`;
    const label = document.createElement('div');
    const titleText = block.kind === 'buffer' ? 'Buffer' : block.title;
    label.textContent = `${block.start} • ${titleText}`;
    const duration = document.createElement('div');
    duration.textContent = `${block.duration}m`;
    row.appendChild(label);
    row.appendChild(duration);
    if (block.kind === 'event' && block.sourceId) {
      const toggle = document.createElement('button');
      toggle.className = 'ghost';
      toggle.textContent = block.protected ? 'Protected' : 'Protect';
      toggle.addEventListener('click', () => {
        const event = STATE.today.events.find((item) => item.id === block.sourceId);
        if (!event) return;
        event.protected = !event.protected;
        saveState();
        renderTodayView();
      });
      row.appendChild(toggle);
    }
    elements.todayTimeline.appendChild(row);
  });
  if (deferred.length) {
    const note = document.createElement('div');
    note.className = 'today-hint';
    note.textContent = `${deferred.length} item(s) would be deferred.`;
    elements.todayTimeline.appendChild(note);
  }
}

function updateNextTransition() {
  if (!elements.nextTransition) return;
  const nowMinutes = getNowMinutes();
  const { timeline } = computeSchedulePreview();
  let nextLabel = 'No upcoming blocks';
  for (let i = 0; i < timeline.length; i += 1) {
    const block = timeline[i];
    const start = block.startMinutes;
    const end = block.startMinutes + block.duration;
    if (nowMinutes < start) {
      nextLabel = `Starts in ${start - nowMinutes}m`;
      break;
    }
    if (nowMinutes >= start && nowMinutes < end) {
      nextLabel = `Ends in ${end - nowMinutes}m`;
      break;
    }
  }
  elements.nextTransition.textContent = nextLabel;
}

function renderTodayView() {
  renderTodayLists();
  renderTimeline();
  updateNextTransition();
}

function setView(view) {
  STATE.view = view;
  document.body.classList.toggle('view-today', view === 'today');
  document.body.classList.toggle('view-week', view === 'week');
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

function handleQuickAdd(event) {
  event.preventDefault();
  const text = elements.quickAddInput.value.trim();
  if (!text) return;
  const nowMinutes = getNowMinutes();
  const triaged = TodayOS.triageInput(text, nowMinutes);
  if (!triaged) return;

  if (triaged.kind === 'event') {
    const date = addDays(new Date(), triaged.dateShift);
    const blockId = `block_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const event = {
      id: `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: safeText(triaged.title, LIMITS.titleMax),
      date: formatISO(date),
      start: triaged.start,
      duration: triaged.duration,
      tags: triaged.tags,
      protected: true,
      linkedBlockId: blockId,
    };
    STATE.today.events.push(event);

    const rawBlock = {
      id: blockId,
      title: event.title,
      date: event.date,
      start: event.start,
      duration: event.duration,
      type: 'event',
      done: false,
    };
    const normalized = normalizeBlock(rawBlock, event.date);
    if (normalized) {
      STATE.blocks.push(normalized);
    }
  } else {
    const suggestion = suggestSlotForTask(triaged.duration, triaged.suggestedStart);
    STATE.today.tasks.push({
      id: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: safeText(triaged.title, LIMITS.titleMax),
      duration: triaged.duration,
      tags: triaged.tags,
      status: 'inbox',
      priority: null,
      microStep: '',
      suggestedStart: suggestion,
      scheduledStart: null,
      createdAt: Date.now(),
    });
  }
  saveState();
  elements.quickAddForm.reset();
  renderTodayView();
}

function applyAutoReplan() {
  const { events, taskBlocks } = buildTodayBlocks();
  const nowMinutes = getNowMinutes();
  const blocks = [...events, ...taskBlocks].map((block, index) => ({ ...block, order: index }));
  const { replanned, deferred } = TodayOS.autoReplan({
    nowMinutes,
    blocks,
    bufferMinutes: STATE.today.prefs.bufferMinutes,
    dayEndMinutes: CONFIG.dayEnd * 60,
  });

  replanned.forEach((block) => {
    if (block.kind === 'event') {
      const event = STATE.today.events.find((item) => item.id === block.sourceId);
      if (event && !event.protected) {
        event.start = block.start;
        if (event.linkedBlockId) {
          const linked = STATE.blocks.find((item) => item.id === event.linkedBlockId);
          if (linked) linked.start = block.start;
        }
      }
    }
    if (block.kind === 'task' && block.taskIds) {
      block.taskIds.forEach((taskId) => {
        const task = STATE.today.tasks.find((item) => item.id === taskId);
        if (task) {
          task.scheduledStart = block.startMinutes;
        }
      });
    }
  });

  if (deferred.length) {
    deferred.forEach((block) => {
      if (block.taskIds) {
        block.taskIds.forEach((taskId) => {
          const task = STATE.today.tasks.find((item) => item.id === taskId);
          if (task) {
            task.status = 'deferred';
            task.priority = null;
            task.scheduledStart = null;
          }
        });
      }
    });
  }

  saveState();
  renderTodayView();
  showToast('Replan complete.');
}

function setFocusMode(active) {
  STATE.focusMode = active;
  document.body.classList.toggle('focus-mode', active);
  if (elements.focusPanel) {
    elements.focusPanel.classList.toggle('active', active);
    elements.focusPanel.setAttribute('aria-hidden', active ? 'false' : 'true');
  }
  if (!active) {
    STATE.focusTarget = null;
    if (elements.focusMicrostep) elements.focusMicrostep.textContent = '';
  }
}

function getNextFocusBlock() {
  const nowMinutes = getNowMinutes();
  const { replanned } = computeSchedulePreview();
  const blocks = replanned.filter((block) => block.kind !== 'buffer');
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (nowMinutes <= block.startMinutes + block.duration) {
      return block;
    }
  }
  return null;
}

function startNextFocus() {
  const next = getNextFocusBlock();
  if (!next) {
    showToast('No upcoming blocks.');
    return;
  }
  STATE.focusTarget = next;
  if (elements.focusTitle) {
    elements.focusTitle.textContent = next.title;
  }
  if (elements.focusSubtitle) {
    elements.focusSubtitle.textContent = `${next.start} · ${next.duration}m`;
  }
  if (elements.focusMicrostep) {
    let micro = '';
    if (next.taskIds && next.taskIds.length) {
      const task = STATE.today.tasks.find((item) => item.id === next.taskIds[0]);
      micro = task && task.microStep ? `First 30s: ${task.microStep}` : '';
    }
    elements.focusMicrostep.textContent = micro;
  }
  setFocusMode(true);
}

function markFocusDone() {
  const target = STATE.focusTarget;
  if (!target) return;
  if (target.kind === 'task' && target.taskIds) {
    target.taskIds.forEach((taskId) => {
      const task = STATE.today.tasks.find((item) => item.id === taskId);
      if (task) {
        task.status = 'done';
        task.priority = null;
      }
    });
  }
  saveState();
  setFocusMode(false);
  renderTodayView();
}

function setTimerSeconds(seconds, mode = 'custom') {
  STATE.timer.mode = mode;
  STATE.timer.total = seconds;
  STATE.timer.remaining = seconds;
  updateTimerDisplay();
  updateModeButtons();
}

function updateTimerDisplay() {
  const minutes = Math.floor(STATE.timer.remaining / 60);
  const seconds = STATE.timer.remaining % 60;
  elements.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateModeButtons() {
  document.querySelectorAll('.chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === STATE.timer.mode);
  });
}

function startTimer() {
  if (STATE.timer.running) return;
  STATE.timer.running = true;
  STATE.timer.intervalId = setInterval(() => {
    if (STATE.timer.remaining <= 0) {
      stopTimer();
      handleTimerComplete();
      return;
    }
    STATE.timer.remaining -= 1;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  STATE.timer.running = false;
  clearInterval(STATE.timer.intervalId);
  STATE.timer.intervalId = null;
}

function resetTimer() {
  stopTimer();
  const defaultSeconds = MODE_DURATIONS[STATE.timer.mode] || STATE.timer.total;
  STATE.timer.remaining = defaultSeconds;
  STATE.timer.total = defaultSeconds;
  updateTimerDisplay();
}

function handleTimerComplete() {
  showToast('Timer complete.');
  const block = STATE.blocks.find((b) => b.id === STATE.timer.linkedBlockId);
  if (block && !block.done) {
    const ok = window.confirm(`Mark block "${block.title}" as done?`);
    if (ok) {
      block.done = true;
      saveState();
      renderAll();
    }
  }
}

function renderAll() {
  renderWeek();
  renderDayOptions();
  renderBlocks();
  renderSelection();
  computeStreaks();
  renderTodayStats();
  applyTodayPrefs();
  renderTodayView();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const title = elements.blockTitle.value.trim();
  if (!title) return;

  if (STATE.blocks.length >= LIMITS.maxBlocks) {
    showToast('Block limit reached.');
    return;
  }

  const rawBlock = {
    id: `block_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    title,
    date: elements.blockDay.value,
    start: elements.blockStart.value,
    duration: Number(elements.blockDuration.value),
    type: elements.blockType.value,
    done: false,
  };
  const block = normalizeBlock(rawBlock, elements.blockDay.value);
  if (!block) {
    showToast('Invalid block data.');
    return;
  }
  STATE.blocks.push(block);
  STATE.selectedId = block.id;
  saveState();
  renderAll();
  elements.blockForm.reset();
  elements.blockStart.value = '09:00';
  elements.blockDuration.value = '90';
  const todayIso = formatISO(new Date());
  if (Array.from(elements.blockDay.options).some((opt) => opt.value === todayIso)) {
    elements.blockDay.value = todayIso;
  }
}

function exportJSON() {
  const blob = new Blob([JSON.stringify({
    version: 2,
    blocks: STATE.blocks,
    today: {
      tasks: STATE.today.tasks,
      events: STATE.today.events,
      prefs: STATE.today.prefs,
    },
  }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'focus-blocks.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function importJSON(file) {
  if (file.size > LIMITS.maxImportBytes) {
    showToast('File too large.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.blocks)) throw new Error('Invalid data');
      STATE.blocks = sanitizeBlocks(data.blocks);
      if (data.today) {
        STATE.today.tasks = sanitizeTasks(data.today.tasks || []);
        STATE.today.events = sanitizeEvents(data.today.events || []);
        STATE.today.prefs = sanitizePrefs(data.today.prefs || {});
      }
      STATE.selectedId = null;
      saveState();
      renderAll();
      showToast('Import complete.');
    } catch (err) {
      showToast('Import failed.');
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  elements.blockForm.addEventListener('submit', handleFormSubmit);
  if (elements.quickAddForm) {
    elements.quickAddForm.addEventListener('submit', handleQuickAdd);
  }

  document.addEventListener('pointermove', handleBlockDragMove);
  document.addEventListener('pointerup', handleBlockDragEnd);
  document.addEventListener('pointercancel', handleBlockDragEnd);

  document.getElementById('prev-week').addEventListener('click', () => {
    STATE.weekStart = addDays(STATE.weekStart, -7);
    renderAll();
  });

  document.getElementById('next-week').addEventListener('click', () => {
    STATE.weekStart = addDays(STATE.weekStart, 7);
    renderAll();
  });

  document.getElementById('today-btn').addEventListener('click', () => {
    STATE.weekStart = startOfWeek(new Date());
    setView('today');
    renderAll();
  });

  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view);
    });
  });

  const autoReplanBtn = document.getElementById('auto-replan');
  if (autoReplanBtn) autoReplanBtn.addEventListener('click', applyAutoReplan);
  const startNextBtn = document.getElementById('start-next');
  if (startNextBtn) startNextBtn.addEventListener('click', startNextFocus);
  const focusDone = document.getElementById('focus-done');
  if (focusDone) focusDone.addEventListener('click', markFocusDone);
  const focusExit = document.getElementById('focus-exit');
  if (focusExit) focusExit.addEventListener('click', () => setFocusMode(false));
  const focusStartTimer = document.getElementById('focus-start-timer');
  if (focusStartTimer) {
    focusStartTimer.addEventListener('click', () => {
      const target = STATE.focusTarget;
      if (!target) return;
      setTimerSeconds(target.duration * 60, 'custom');
      startTimer();
    });
  }

  if (elements.bufferMinutes) {
    elements.bufferMinutes.addEventListener('change', () => {
      STATE.today.prefs.bufferMinutes = clamp(Number(elements.bufferMinutes.value) || 5, 5, 10);
      saveState();
      renderTodayView();
    });
  }
  if (elements.density) {
    elements.density.addEventListener('change', () => {
      STATE.today.prefs.visualDensity = elements.density.value === 'compact' ? 'compact' : 'cozy';
      applyTodayPrefs();
      saveState();
    });
  }
  if (elements.reminderStyle) {
    elements.reminderStyle.addEventListener('change', () => {
      STATE.today.prefs.reminderStyle = elements.reminderStyle.value === 'off' ? 'off' : 'soft';
      saveState();
    });
  }

  document.getElementById('toggle-mode').addEventListener('click', () => {
    PREFS.simpleMode = !PREFS.simpleMode;
    if (PREFS.simpleMode && elements.blockType) {
      elements.blockType.value = 'focus';
    }
    savePrefs();
    applyPrefs();
    showToast(PREFS.simpleMode ? 'Simple mode on.' : 'Power mode on.');
  });

  document.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const seconds = MODE_DURATIONS[btn.dataset.mode];
      setTimerSeconds(seconds, btn.dataset.mode);
    });
  });

  document.getElementById('apply-custom').addEventListener('click', () => {
    const inputValue = Number(document.getElementById('custom-minutes').value) || 25;
    const mins = clamp(inputValue, LIMITS.customMin, LIMITS.customMax);
    setTimerSeconds(mins * 60, 'custom');
  });

  document.getElementById('timer-start').addEventListener('click', startTimer);
  document.getElementById('timer-pause').addEventListener('click', () => {
    stopTimer();
  });
  document.getElementById('timer-reset').addEventListener('click', resetTimer);

  document.getElementById('export-json').addEventListener('click', exportJSON);
  document.getElementById('import-json').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importJSON(file);
    event.target.value = '';
  });
}

function init() {
  document.documentElement.style.setProperty('--hour-height', `${CONFIG.hourHeight}px`);
  document.documentElement.style.setProperty('--calendar-height', `${(CONFIG.dayEnd - CONFIG.dayStart) * CONFIG.hourHeight}px`);
  loadPrefs();
  applyPrefs();
  loadState();
  applyTodayPrefs();
  renderHours();
  renderAll();
  setView(STATE.view);
  updateTimerDisplay();
  bindEvents();
  updateNextTransition();
  setInterval(updateNextTransition, 60 * 1000);
}

init();
