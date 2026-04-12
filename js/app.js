// =============================================
// app.js — 앱 초기화 & 탭 전환
// =============================================

let currentTab = 'todo';

document.addEventListener('DOMContentLoaded', () => {
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

// ── 뒤로가기 → 팝업 닫기 ──
function initBackButton() {
  // 팝업이 열릴 때마다 history에 더미 상태를 push해서
  // 뒤로가기 시 popstate로 잡아 팝업만 닫는다
  window.addEventListener('popstate', () => {
    if (closeTopPopup()) {
      // 팝업 닫혔으면 다시 더미 상태를 push해서 앱이 종료되지 않게
      history.pushState({ popup: true }, '');
    }
  });
  // 초기 더미 상태
  history.pushState({ popup: true }, '');
}

function closeTopPopup() {
  // 열려있는 팝업을 우선순위대로 닫기
  const checks = [
    { el: 'repeat-overlay',   close: () => document.getElementById('repeat-overlay').classList.add('hidden') },
    { el: 'action-popup',     close: closeActionPopup },
    { el: 'year-popup',       close: closeYearPopup },
    { el: 'month-popup',      close: closeMonthPopup },
    { el: 'modal-overlay',    close: closeModal },
    { el: 'repeats-panel',    fn: 'open', close: closeRepeatsPanel },
    { el: 'settings-panel',   fn: 'open', close: closeSettingsPanel },
  ];
  for (const { el, fn, close } of checks) {
    const dom = document.getElementById(el);
    if (!dom) continue;
    const isVisible = fn === 'open'
      ? dom.classList.contains('open')
      : !dom.classList.contains('hidden');
    if (isVisible) { close(); return true; }
  }
  return false;
}

function initTabs() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      // 설정은 슬라이드 패널로 처리 (탭 전환 아님)
      if (btn.dataset.tab === 'settings') return;
      switchTab(btn.dataset.tab);
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