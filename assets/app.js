// ===== JADWALKU APP =====
'use strict';

// ---- DATA STORE ----
const DB = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

let tasks = DB.get('tasks');
let jadwalKuliah = DB.get('jadwalKuliah');
let jadwalKerja = DB.get('jadwalKerja');

// ---- UTILS ----
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

function today() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function deadlineStatus(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0) return { label: 'Lewat deadline', cls: 'deadline-past' };
  if (diff <= 3) return { label: diff === 0 ? 'Hari ini!' : `${diff} hari lagi`, cls: 'deadline-soon' };
  return { label: `${diff} hari lagi`, cls: 'deadline-ok' };
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ---- NAVIGATION ----
let currentSection = 'beranda';

function navigate(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + section).classList.add('active');
  document.getElementById('nav-' + section).classList.add('active');
  currentSection = section;
  renderAll();
  window.location.hash = section;
}

// ---- DATE HEADER ----
function updateHeader() {
  const d = new Date();
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  document.getElementById('header-date').textContent =
    `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ---- GREETING ----
function updateGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Selamat Pagi ☀️' : h < 15 ? 'Selamat Siang 🌤️' : h < 18 ? 'Selamat Sore 🌅' : 'Selamat Malam 🌙';
  document.getElementById('greeting-text').textContent = greet;

  const pending = tasks.filter(t => !t.completed).length;
  const todayIdx = new Date().getDay();
  const dayNames = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
  const todayDay = dayNames[todayIdx];
  const todayKuliah = jadwalKuliah.filter(j => j.hari === todayDay).length;
  const todayKerja = jadwalKerja.filter(j => j.hari === todayDay).length;

  document.getElementById('stat-tugas').textContent = pending;
  document.getElementById('stat-kuliah').textContent = jadwalKuliah.length;
  document.getElementById('stat-kerja').textContent = jadwalKerja.length;
  document.getElementById('stat-hari-ini').textContent = todayKuliah + todayKerja;
}

// ---- UPCOMING TASKS (BERANDA) ----
function renderUpcoming() {
  const container = document.getElementById('upcoming-list');
  const upcoming = tasks
    .filter(t => !t.completed && t.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3);

  if (upcoming.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>Tidak ada tugas mendatang.<br>Yeay, semua beres!</p></div>`;
    return;
  }
  container.innerHTML = upcoming.map(t => renderTaskItem(t, true)).join('');
}

// ---- JADWAL HARI INI (BERANDA) ----
function renderTodaySchedule() {
  const container = document.getElementById('today-schedule');
  const todayIdx = new Date().getDay();
  const dayNames = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
  const todayDay = dayNames[todayIdx];

  const all = [
    ...jadwalKuliah.filter(j => j.hari === todayDay).map(j => ({...j, type: 'kuliah'})),
    ...jadwalKerja.filter(j => j.hari === todayDay).map(j => ({...j, type: 'kerja'}))
  ].sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

  if (all.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><p>Tidak ada jadwal hari ini.<br>Waktu istirahat!</p></div>`;
    return;
  }
  container.innerHTML = all.map(j => renderScheduleItem(j)).join('');
}

// ---- TASKS ----
let taskFilter = 'semua';

function renderTasks() {
  const container = document.getElementById('task-list');
  let filtered = [...tasks];

  if (taskFilter === 'kuliah') filtered = filtered.filter(t => t.kategori === 'kuliah');
  else if (taskFilter === 'kerja') filtered = filtered.filter(t => t.kategori === 'kerja');
  else if (taskFilter === 'aktif') filtered = filtered.filter(t => !t.completed);
  else if (taskFilter === 'selesai') filtered = filtered.filter(t => t.completed);

  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>Belum ada tugas di sini.<br>Tambah tugas baru!</p></div>`;
    return;
  }
  container.innerHTML = filtered.map(t => renderTaskItem(t, false)).join('');
}

function renderTaskItem(task, mini = false) {
  const dl = deadlineStatus(task.deadline);
  const badgeCls = task.kategori === 'kuliah' ? 'badge-kuliah' : 'badge-kerja';
  const badgeLabel = task.kategori === 'kuliah' ? '📚 Kuliah' : '💼 Kerja';
  const checkedCls = task.completed ? 'checked' : '';
  const completedCls = task.completed ? 'completed' : '';
  const priorityCls = `priority-${task.prioritas || 'medium'}`;

  return `
    <div class="task-item ${completedCls} ${priorityCls}" id="task-${task.id}">
      <div class="task-check ${checkedCls}" onclick="toggleTask('${task.id}')">
        ${task.completed ? '✓' : ''}
      </div>
      <div class="task-content">
        <div class="task-title">${task.judul}</div>
        <div class="task-meta">
          <span class="task-badge ${badgeCls}">${badgeLabel}</span>
          ${task.matkul ? `<span>· ${task.matkul}</span>` : ''}
          ${dl ? `<span class="deadline-badge ${dl.cls}">${dl.label}</span>` : ''}
        </div>
        ${task.catatan && !mini ? `<div style="font-size:0.78rem;color:var(--text-soft);margin-top:0.3rem;font-weight:600;">${task.catatan}</div>` : ''}
      </div>
      ${!mini ? `<div class="task-actions">
        <button class="btn-icon" onclick="deleteTask('${task.id}')" title="Hapus">🗑️</button>
      </div>` : ''}
    </div>`;
}

function toggleTask(id) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  tasks[idx].completed = !tasks[idx].completed;
  DB.set('tasks', tasks);
  renderAll();
  showToast(tasks[idx].completed ? '✅ Tugas selesai!' : '↩️ Tugas dibatalkan');
}

function deleteTask(id) {
  if (!confirm('Hapus tugas ini?')) return;
  tasks = tasks.filter(t => t.id !== id);
  DB.set('tasks', tasks);
  renderAll();
  showToast('🗑️ Tugas dihapus');
}

// ---- JADWAL KULIAH ----
let selectedDayKuliah = null;
let selectedDayKerja = null;

const DAYS = ['senin','selasa','rabu','kamis','jumat','sabtu','minggu'];
const DAYS_LABEL = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

function initDayTabs() {
  const todayIdx = new Date().getDay();
  const todayName = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][todayIdx];
  selectedDayKuliah = todayName;
  selectedDayKerja = todayName;
  renderDayTabs('kuliah-day-tabs', selectedDayKuliah, 'kuliah');
  renderDayTabs('kerja-day-tabs', selectedDayKerja, 'kerja');
}

function renderDayTabs(containerId, selected, type) {
  const container = document.getElementById(containerId);
  const todayName = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][new Date().getDay()];

  // Get dates for current week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const orderedDays = ['senin','selasa','rabu','kamis','jumat','sabtu','minggu'];
  const orderedLabels = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

  container.innerHTML = orderedDays.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const isToday = day === todayName;
    const isSelected = day === selected;
    return `<div class="day-tab ${isSelected ? 'active' : ''} ${isToday && !isSelected ? 'today' : ''}"
      onclick="selectDay('${type}', '${day}')">
      <span class="day-short">${orderedLabels[i]}</span>
      <span class="day-num">${d.getDate()}</span>
    </div>`;
  }).join('');
}

function selectDay(type, day) {
  if (type === 'kuliah') {
    selectedDayKuliah = day;
    renderDayTabs('kuliah-day-tabs', day, 'kuliah');
    renderJadwalKuliah();
  } else {
    selectedDayKerja = day;
    renderDayTabs('kerja-day-tabs', day, 'kerja');
    renderJadwalKerja();
  }
}

function renderScheduleItem(item) {
  const colorCls = item.type === 'kuliah' ? 'color-kuliah' : 'color-kerja';
  const typeBadgeStyle = item.type === 'kuliah'
    ? 'background:var(--purple-light);color:var(--purple-dark)'
    : 'background:var(--blue-light);color:#1565c0';
  const typeLabel = item.type === 'kuliah' ? '📚 Kuliah' : '💼 Kerja';

  return `
    <div class="schedule-item" id="sched-${item.id}">
      <div class="schedule-time">
        <div class="time-start">${item.jamMulai}</div>
        <div class="time-end">${item.jamSelesai}</div>
      </div>
      <div class="schedule-line">
        <div class="time-dot ${colorCls}"></div>
        <div class="time-bar"></div>
      </div>
      <div class="schedule-content">
        <div class="schedule-title">
          ${item.nama}
          <span class="schedule-type-badge" style="${typeBadgeStyle}">${typeLabel}</span>
        </div>
        <div class="schedule-detail">
          ${item.ruangan ? `📍 ${item.ruangan}` : ''}
          ${item.dosen || item.posisi ? ` · 👤 ${item.dosen || item.posisi}` : ''}
          ${item.catatan ? ` · ${item.catatan}` : ''}
        </div>
      </div>
      <button class="btn-icon" onclick="deleteSchedule('${item.type}', '${item.id}')" title="Hapus">🗑️</button>
    </div>`;
}

function renderJadwalKuliah() {
  const container = document.getElementById('kuliah-list');
  const items = jadwalKuliah
    .filter(j => j.hari === selectedDayKuliah)
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
    .map(j => ({...j, type: 'kuliah'}));

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Tidak ada kuliah hari ini.<br>Santai aja!</p></div>`;
    return;
  }
  container.innerHTML = items.map(renderScheduleItem).join('');
}

function renderJadwalKerja() {
  const container = document.getElementById('kerja-list');
  const items = jadwalKerja
    .filter(j => j.hari === selectedDayKerja)
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
    .map(j => ({...j, type: 'kerja'}));

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💼</div><p>Tidak ada jadwal kerja hari ini.<br>Waktu buat istirahat!</p></div>`;
    return;
  }
  container.innerHTML = items.map(renderScheduleItem).join('');
}

function deleteSchedule(type, id) {
  if (!confirm('Hapus jadwal ini?')) return;
  if (type === 'kuliah') {
    jadwalKuliah = jadwalKuliah.filter(j => j.id !== id);
    DB.set('jadwalKuliah', jadwalKuliah);
    renderJadwalKuliah();
  } else {
    jadwalKerja = jadwalKerja.filter(j => j.id !== id);
    DB.set('jadwalKerja', jadwalKerja);
    renderJadwalKerja();
  }
  updateGreeting();
  showToast('🗑️ Jadwal dihapus');
}

// ---- MODAL ----
function openModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ---- FORM SUBMIT: TUGAS ----
document.getElementById('form-tugas').addEventListener('submit', function(e) {
  e.preventDefault();
  const fd = new FormData(this);
  const task = {
    id: genId(),
    judul: fd.get('judul'),
    kategori: fd.get('kategori'),
    matkul: fd.get('matkul'),
    deadline: fd.get('deadline'),
    prioritas: fd.get('prioritas'),
    catatan: fd.get('catatan'),
    completed: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  DB.set('tasks', tasks);
  this.reset();
  closeModal('modal-tugas');
  renderAll();
  showToast('✅ Tugas berhasil ditambahkan!');
});

// ---- FORM SUBMIT: JADWAL KULIAH ----
document.getElementById('form-kuliah').addEventListener('submit', function(e) {
  e.preventDefault();
  const fd = new FormData(this);
  const item = {
    id: genId(),
    nama: fd.get('nama'),
    hari: fd.get('hari'),
    jamMulai: fd.get('jamMulai'),
    jamSelesai: fd.get('jamSelesai'),
    ruangan: fd.get('ruangan'),
    dosen: fd.get('dosen'),
    catatan: fd.get('catatan'),
  };
  jadwalKuliah.push(item);
  DB.set('jadwalKuliah', jadwalKuliah);
  this.reset();
  closeModal('modal-kuliah');
  if (item.hari === selectedDayKuliah) renderJadwalKuliah();
  updateGreeting();
  renderTodaySchedule();
  showToast('📚 Jadwal kuliah ditambahkan!');
});

// ---- FORM SUBMIT: JADWAL KERJA ----
document.getElementById('form-kerja').addEventListener('submit', function(e) {
  e.preventDefault();
  const fd = new FormData(this);
  const item = {
    id: genId(),
    nama: fd.get('nama'),
    hari: fd.get('hari'),
    jamMulai: fd.get('jamMulai'),
    jamSelesai: fd.get('jamSelesai'),
    ruangan: fd.get('ruangan'),
    posisi: fd.get('posisi'),
    catatan: fd.get('catatan'),
  };
  jadwalKerja.push(item);
  DB.set('jadwalKerja', jadwalKerja);
  this.reset();
  closeModal('modal-kerja');
  if (item.hari === selectedDayKerja) renderJadwalKerja();
  updateGreeting();
  renderTodaySchedule();
  showToast('💼 Jadwal kerja ditambahkan!');
});

// ---- FILTER TABS ----
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    taskFilter = this.dataset.filter;
    renderTasks();
  });
});

// ---- PWA INSTALL ----
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-banner').style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').style.display = 'none';
  showToast('🎉 Jadwalku berhasil diinstal!');
});

document.getElementById('btn-install').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') showToast('🎉 Instalasi berhasil!');
  deferredPrompt = null;
});

// ---- SERVICE WORKER REGISTER ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(reg => {
      console.log('SW registered:', reg.scope);
      document.getElementById('pwa-status').style.display = 'flex';
    })
    .catch(err => console.error('SW error:', err));
}

// ---- RENDER ALL ----
function renderAll() {
  updateGreeting();
  renderUpcoming();
  renderTodaySchedule();
  renderTasks();
  renderJadwalKuliah();
  renderJadwalKerja();
}

// ---- INIT ----
function init() {
  updateHeader();
  initDayTabs();
  renderAll();

  // Check hash
  const hash = window.location.hash.replace('#', '');
  const valid = ['beranda','tugas','kuliah','kerja'];
  if (valid.includes(hash)) navigate(hash);
  else navigate('beranda');

  // Hide install banner by default
  document.getElementById('install-banner').style.display = 'none';

  // Check if running as PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('pwa-status').style.display = 'flex';
    document.getElementById('install-banner').style.display = 'none';
  }
}

init();
