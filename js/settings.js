// =============================================
// settings.js — 설정 패널 & 반복함
// =============================================

const THEMES = [
  { id: 'default',  label: '기본',        color: '#7ecfa0' },
  { id: 'sage',     label: '연한 녹색',   color: '#7ec87e' },
  { id: 'sky',      label: '하늘색',      color: '#7ab8e8' },
  { id: 'rose',     label: '연한 붉은색', color: '#e88888' },
  { id: 'lavender', label: '연한 자주색', color: '#b088e8' },
  { id: 'navy',     label: '진한 청색',   color: '#5080e0' },
];

function applyTheme(themeId) {
  THEMES.forEach(t => document.body.classList.remove('theme-' + t.id));
  if (themeId && themeId !== 'default') {
    document.body.classList.add('theme-' + themeId);
  }
  localStorage.setItem('app-theme', themeId || 'default');
}

function initTheme() {
  const saved = localStorage.getItem('app-theme') || 'default';
  applyTheme(saved);
}

function openThemePanel() {
  const existing = document.getElementById('theme-sheet');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.id = 'theme-sheet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1200;';

  const sheet = document.createElement('div');
  sheet.id = 'theme-sheet';
  sheet.style.cssText = [
    'position:fixed;bottom:0;left:0;right:0;z-index:1201;',
    'background:var(--bg-elevated);',
    'border-radius:20px 20px 0 0;',
    'padding:20px 20px 40px;',
    'box-shadow:0 -4px 32px rgba(0,0,0,0.4);',
    'animation:slideUp 0.25s ease;'
  ].join('');

  const title = document.createElement('div');
  title.style.cssText = 'font-size:15px;font-weight:600;color:var(--text-secondary);margin-bottom:16px;text-align:center;';
  title.textContent = '테마 선택';
  sheet.appendChild(title);

  const current = localStorage.getItem('app-theme') || 'default';

  THEMES.forEach(t => {
    const btn = document.createElement('button');
    const isActive = t.id === current;
    btn.style.cssText = [
      'display:flex;align-items:center;gap:14px;',
      'width:100%;padding:13px 16px;margin-bottom:8px;',
      'border-radius:12px;',
      'border:2px solid ' + (isActive ? 'var(--accent)' : 'transparent') + ';',
      'background:var(--bg-surface);cursor:pointer;',
      'font-family:var(--font-main);transition:border-color 0.15s;'
    ].join('');

    const dot = document.createElement('div');
    dot.style.cssText = 'width:24px;height:24px;border-radius:50%;background:' + t.color + ';flex-shrink:0;';

    const label = document.createElement('span');
    label.style.cssText = 'font-size:15px;color:var(--text-primary);flex:1;text-align:left;';
    label.textContent = t.label;

    btn.appendChild(dot);
    btn.appendChild(label);

    if (isActive) {
      const check = document.createElement('span');
      check.style.cssText = 'color:var(--accent);font-size:18px;';
      check.textContent = '✓';
      btn.appendChild(check);
    }

    btn.addEventListener('click', () => {
      applyTheme(t.id);
      overlay.remove();
      sheet.remove();
      closeSettingsPanel();
    });
    sheet.appendChild(btn);
  });

  overlay.addEventListener('click', () => { overlay.remove(); sheet.remove(); });
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
}

function initSettings() {
  document.getElementById('nav-settings').addEventListener('click', openSettingsPanel);
  document.getElementById('settings-close').addEventListener('click', closeSettingsPanel);
  document.getElementById('settings-overlay').addEventListener('click', closeSettingsPanel);
  document.getElementById('menu-repeats').addEventListener('click', openRepeatsPanel);
  document.getElementById('menu-theme').addEventListener('click', openThemePanel);
  document.getElementById('repeats-back').addEventListener('click', closeRepeatsPanel);
  document.getElementById('menu-logout').addEventListener('click', openLogoutConfirm);
}

function openLogoutConfirm() {
  document.getElementById('logout-modal').style.display = 'flex';
}

function closeLogoutConfirm() {
  document.getElementById('logout-modal').style.display = 'none';
}

async function doLogout() {
  closeLogoutConfirm();
  try { await getSupabaseClient().auth.signOut({ scope: 'local' }); } catch(e) {}
  clearSession();
  location.reload();
}

function openSettingsPanel() {
  document.getElementById('settings-overlay').classList.remove('hidden');
  document.getElementById('settings-panel').classList.remove('hidden');
  requestAnimationFrame(() => {
    document.getElementById('settings-panel').classList.add('open');
  });
}

function closeSettingsPanelOnly() {
  const panel = document.getElementById('settings-panel');
  panel.classList.remove('open');
  setTimeout(() => {
    panel.classList.add('hidden');
    document.getElementById('settings-overlay').classList.add('hidden');
    const repeatsPanel = document.getElementById('repeats-panel');
    repeatsPanel.classList.remove('open');
    repeatsPanel.classList.add('hidden');
  }, 300);
}

function closeSettingsPanel() {
  closeRepeatsPanel();
  closeSettingsPanelOnly();
}

function openRepeatsPanel() {
  loadRepeats();
  document.getElementById('repeats-panel').classList.remove('hidden');
  requestAnimationFrame(() => {
    document.getElementById('repeats-panel').classList.add('open');
  });
}

function closeRepeatsPanel() {
  const panel = document.getElementById('repeats-panel');
  panel.classList.remove('open');
  setTimeout(() => panel.classList.add('hidden'), 300);
}

async function loadRepeats() {
  const list = document.getElementById('repeats-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    // IDB에서 읽기
    const all = await idbGetAll();
    const rows = all.filter(t =>
      t.repeat_type && t.repeat_type !== 'none' &&
      !t.repeat_master_id &&
      !t.repeat_exception
    ).sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1);

    if (!rows.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔁</div>반복 일정이 없어요</div>';
      return;
    }

    list.innerHTML = '';
    rows.forEach(todo => list.appendChild(makeRepeatItem(todo)));
  } catch(e) {
    list.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

function makeRepeatItem(todo) {
  const el = document.createElement('div');
  el.className = 'repeat-list-item';

  const info = document.createElement('div');
  info.className = 'repeat-item-info';

  const title = document.createElement('div');
  title.className = 'repeat-item-title';
  title.textContent = todo.title;

  const sub = document.createElement('div');
  sub.className = 'repeat-item-sub';
  sub.textContent = getRepeatDescFromTodo(todo);

  info.appendChild(title);
  info.appendChild(sub);

  const delBtn = document.createElement('button');
  delBtn.className = 'repeat-item-del';
  delBtn.textContent = '삭제';
  delBtn.addEventListener('click', () => showRepeatDeleteOptions(todo, el));

  el.appendChild(info);
  el.appendChild(delBtn);
  return el;
}

function getRepeatDescFromTodo(todo) {
  let meta = {};
  try { meta = JSON.parse(todo.repeat_meta || '{}'); } catch(e) {}
  const days = ['일','월','화','수','목','금','토'];
  switch(todo.repeat_type) {
    case 'daily': return '매일';
    case 'weekly': return '매주 ' + (meta.weekdays || []).map(d => days[d]).join(',');
    case 'monthly':
      if (meta.monthMode === 'week') {
        const weeks = ['첫째','둘째','셋째','넷째','마지막'];
        return `매월 ${weeks[(meta.monthWeek||1)-1]}주 ${days[meta.monthWeekday??1]}`;
      }
      return `매월 ${todo.repeat_day||1}일`;
    case 'yearly': return `매년 ${meta.yearlyMonth||1}월 ${meta.yearlyDay||1}일`;
    case 'custom': return '매주 ' + (meta.customDays || []).map(d => days[d]).join(',');
    default: return '';
  }
}

function showRepeatDeleteOptions(todo, el) {
  el.querySelectorAll('.repeat-del-options').forEach(e => e.remove());

  const opts = document.createElement('div');
  opts.className = 'repeat-del-options';

  const choices = [
    {
      label: '오늘 이후 삭제',
      action: async () => {
        await deleteRepeatFromDate(todo.id, todayStr());
        showToast('오늘 이후 반복을 삭제했어요');
      }
    },
    {
      label: '전체 반복 삭제',
      action: async () => {
        await deleteRepeatAll(todo.id);
        showToast('반복 일정을 삭제했어요');
      }
    },
  ];

  choices.forEach(({ label, action }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (label.includes('전체')) btn.classList.add('danger');
    btn.addEventListener('click', async () => {
      await action();
      loadRepeats();
      refreshCurrentTab();
    });
    opts.appendChild(btn);
  });

  const cancel = document.createElement('button');
  cancel.textContent = '취소';
  cancel.className = 'cancel';
  cancel.addEventListener('click', () => opts.remove());
  opts.appendChild(cancel);

  el.appendChild(opts);
  // 최하단 아이템의 경우 삭제 옵션이 잘리지 않도록 스크롤
  setTimeout(() => opts.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}


