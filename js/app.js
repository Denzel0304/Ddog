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
  initTabs();
  loadTodos();
});

function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // 탭 이동 시 항상 데이터 새로 불러오기
  if (tabName === 'todo') {
    loadTodos();
    updateMonthDots();
  } else if (tabName === 'weekly') {
    weekOffset = 0;
    loadWeekly();
  } else if (tabName === 'search') {
    setTimeout(() => document.getElementById('search-input').focus(), 200);
  }
}

// 저장/수정 후 현재 탭 갱신
function refreshCurrentTab() {
  if (currentTab === 'todo') {
    loadTodos();
    updateMonthDots();
  } else if (currentTab === 'weekly') {
    loadWeekly();
  }
}
