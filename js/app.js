// =============================================
// app.js — 앱 초기화 & 탭 전환
// =============================================

// 현재 활성 탭 추적
let currentTab = 'todo';

document.addEventListener('DOMContentLoaded', () => {
  initCalendar();
  initModal();
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

  if (tabName === 'search') {
    setTimeout(() => document.getElementById('search-input').focus(), 200);
  }
  if (tabName === 'weekly') {
    weekOffset = 0;
    loadWeekly();
  }
}

// 저장 후 현재 탭에 맞게 목록 갱신
function refreshCurrentTab() {
  if (currentTab === 'todo') {
    renderTodos();
    updateMonthDots();
  } else if (currentTab === 'weekly') {
    loadWeekly();
  }
}
