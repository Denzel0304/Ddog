// =============================================
// app.js — 앱 초기화 & 탭 전환
// =============================================

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
