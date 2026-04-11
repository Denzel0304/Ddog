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
  // 탭 컨텐츠
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // 네비 버튼
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // FAB: 할일 탭에서만 표시
  document.getElementById('fab-add').style.display = tabName === 'todo' ? 'flex' : 'none';

  // 검색 탭 진입 시 포커스
  if (tabName === 'search') {
    setTimeout(() => document.getElementById('search-input').focus(), 200);
  }
}
