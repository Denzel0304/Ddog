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

// ── 뒤로가기 → 팝업/패널 닫기, 탭 복귀, 종료 ──
function initBackButton() {
  // 스택을 [외부, 앱] 두 단계로 고정
  history.replaceState({ page: 'base' }, '');
  history.pushState({ page: 'app' }, '');

  window.addEventListener('popstate', e => {
    if (e.state && e.state.page === 'base') {
      if (hasOpenPopup()) {
        // closeTopPopup()이 true를 반환하면 설정 관련 패널을 닫은 것
        // → 할일 탭 복귀 단계가 추가로 필요하므로 스택을 하나 더 쌓음
        const wasSettings = closeTopPopup();
        if (wasSettings) {
          history.pushState({ page: 'app' }, ''); // 할일 탭 복귀용 여분 스택
        }
        history.pushState({ page: 'app' }, '');
      } else if (currentTab !== 'todo') {
        // 탭을 할일로 복귀 후 앱 스택 복원
        switchTab('todo');
        history.pushState({ page: 'app' }, '');
      }
      // 할일 탭이고 팝업도 없으면 → 그냥 통과 → 브라우저가 종료/홈으로
    }
  });
}

function hasOpenPopup() {
  if (!document.getElementById('repeat-overlay').classList.contains('hidden')) return true;
  if (!document.getElementById('action-popup').classList.contains('hidden')) return true;
  if (!document.getElementById('year-popup').classList.contains('hidden')) return true;
  if (!document.getElementById('month-popup').classList.contains('hidden')) return true;
  if (!document.getElementById('modal-overlay').classList.contains('hidden')) return true;
  if (document.getElementById('repeats-panel').classList.contains('open')) return true;
  if (document.getElementById('settings-panel').classList.contains('open')) return true;
  return false;
}

// 반환값: true = 설정/반복함 패널을 닫은 경우 → 할일 탭 복귀 단계가 추가로 필요
function closeTopPopup() {
  if (!document.getElementById('repeat-overlay').classList.contains('hidden')) {
    document.getElementById('repeat-overlay').classList.add('hidden');
    return false;
  }
  if (!document.getElementById('action-popup').classList.contains('hidden')) {
    closeActionPopup(); return false;
  }
  if (!document.getElementById('year-popup').classList.contains('hidden')) {
    closeYearPopup(); return false;
  }
  if (!document.getElementById('month-popup').classList.contains('hidden')) {
    closeMonthPopup(); return false;
  }
  if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
    closeModal(); return false;
  }
  if (document.getElementById('repeats-panel').classList.contains('open')) {
    // 반복함 닫기 → 설정 패널이 아직 열려 있으므로 true 반환
    closeRepeatsPanel(); return true;
  }
  if (document.getElementById('settings-panel').classList.contains('open')) {
    // 설정 패널 닫기 → 할일 탭 복귀 단계 필요하므로 true 반환
    closeSettingsPanelOnly(); return true;
  }
  return false;
}

function initTabs() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
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
