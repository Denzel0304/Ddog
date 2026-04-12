// =============================================
// app.js — 앱 초기화 & 탭 전환
// =============================================

let currentTab = 'todo';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. 동기화 엔진 초기화 (IDB 열기 + Supabase 동기화 + Realtime 구독)
  await initSync();

  // 2. UI 초기화
  initCalendar();
  initModal();
  initRepeat();
  initGesturePopup();
  initSearch();
  initWeekly();
  initSettings();
  initTabs();
  loadTodos();
  initBackButton();
});

// ── 뒤로가기 → 팝업/패널/탭 한 단계씩 닫기 ──
function initBackButton() {
  window.addEventListener('popstate', () => {
    if (closeTopPopup()) {
      history.pushState({ popup: true }, '');
    }
  });
  history.pushState({ popup: true }, '');
}

function closeTopPopup() {
  const repeatOverlay = document.getElementById('repeat-overlay');
  if (repeatOverlay && !repeatOverlay.classList.contains('hidden')) {
    repeatOverlay.classList.add('hidden');
    return true;
  }

  const actionPopup = document.getElementById('action-popup');
  if (actionPopup && !actionPopup.classList.contains('hidden')) {
    closeActionPopup();
    return true;
  }

  const yearPopup = document.getElementById('year-popup');
  if (yearPopup && !yearPopup.classList.contains('hidden')) {
    closeYearPopup();
    return true;
  }

  const monthPopup = document.getElementById('month-popup');
  if (monthPopup && !monthPopup.classList.contains('hidden')) {
    closeMonthPopup();
    return true;
  }

  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay && !modalOverlay.classList.contains('hidden')) {
    closeModal();
    return true;
  }

  const repeatsPanel = document.getElementById('repeats-panel');
  if (repeatsPanel && repeatsPanel.classList.contains('open')) {
    closeRepeatsPanel();
    return true;
  }

  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel && settingsPanel.classList.contains('open')) {
    closeSettingsPanelOnly();
    return true;
  }

  if (currentTab === 'search' || currentTab === 'weekly') {
    switchTab('todo');
    return true;
  }

  return false;
}

function initTabs() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'settings') return;
      const targetTab = btn.dataset.tab;
      if (targetTab !== currentTab) {
        history.pushState({ popup: true }, '');
      }
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  if (tabName === 'todo') { loadTodos(); updateMonthDots(); }
  else if (tabName === 'weekly') { weekOffset = 0; loadWeekly(); }
  else if (tabName === 'search') { setTimeout(() => document.getElementById('search-input').focus(), 200); }
}

function refreshCurrentTab() {
  if (currentTab === 'todo') { loadTodos(); updateMonthDots(); }
  else if (currentTab === 'weekly') { loadWeekly(); }
}
