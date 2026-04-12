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

// ── 뒤로가기 → 팝업/패널/탭 순서대로 닫기 ──
function initBackButton() {
  window.addEventListener('popstate', () => {
    if (closeTopPopup()) {
      // 팝업을 닫았으면 다음 뒤로가기도 잡히도록 다시 push
      history.pushState({ popup: true }, '');
    }
    // 닫을 팝업/패널/탭이 없으면 브라우저 기본 동작(앱 종료)으로 흘러감
  });
  // 초기 더미 상태
  history.pushState({ popup: true }, '');
}

function closeTopPopup() {
  // 열려있는 팝업/패널을 우선순위대로 닫기 (가장 위에 떠있는 것부터)

  // 1. 반복 설정 모달
  const repeatOverlay = document.getElementById('repeat-overlay');
  if (repeatOverlay && !repeatOverlay.classList.contains('hidden')) {
    repeatOverlay.classList.add('hidden');
    return true;
  }

  // 2. 액션 팝업 (스와이프 메뉴)
  const actionPopup = document.getElementById('action-popup');
  if (actionPopup && !actionPopup.classList.contains('hidden')) {
    closeActionPopup();
    return true;
  }

  // 3. 년도 팝업
  const yearPopup = document.getElementById('year-popup');
  if (yearPopup && !yearPopup.classList.contains('hidden')) {
    closeYearPopup();
    return true;
  }

  // 4. 월 팝업
  const monthPopup = document.getElementById('month-popup');
  if (monthPopup && !monthPopup.classList.contains('hidden')) {
    closeMonthPopup();
    return true;
  }

  // 5. 할일 추가/수정 모달
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay && !modalOverlay.classList.contains('hidden')) {
    closeModal();
    return true;
  }

  // 6. 반복함 패널 (설정 패널 안쪽 depth → 먼저 닫아야 함)
  const repeatsPanel = document.getElementById('repeats-panel');
  if (repeatsPanel && repeatsPanel.classList.contains('open')) {
    closeRepeatsPanel();
    return true;
  }

  // 7. 설정 패널
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel && settingsPanel.classList.contains('open')) {
    closeSettingsPanel();
    return true;
  }

  // 8. 검색/주간 탭 → 할일 탭으로 복귀
  if (currentTab === 'search' || currentTab === 'weekly') {
    switchTab('todo');
    return true;
  }

  return false;
}

function initTabs() {
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      // 설정은 슬라이드 패널로 처리 (탭 전환 아님)
      if (btn.dataset.tab === 'settings') return;
      const targetTab = btn.dataset.tab;
      if (targetTab !== currentTab) {
        // 탭 전환 시 히스토리에 push → 뒤로가기로 이전 탭 복귀 가능
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
