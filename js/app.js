// =============================================
// app.js — 앱 초기화 & 탭 전환
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  initCalendar();
  initModal();
  initGesturePopup();
  initSearch();
  initTabs();

  // 첫 로드: 오늘 날짜 할일
  loadTodos();
});

// ── 탭 전환 ──
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
}
