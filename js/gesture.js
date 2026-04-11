// =============================================
// gesture.js — 할일 아이템 스와이프 제스처
// =============================================

let actionTargetId = null;

function initGesturePopup() {
  // 팝업 바깥 클릭 닫기
  document.getElementById('action-popup').addEventListener('click', e => {
    if (e.target.id === 'action-popup') closeActionPopup();
  });

  document.getElementById('action-tomorrow').addEventListener('click', async () => {
    if (!actionTargetId) return;
    try {
      await moveTodoDate(actionTargetId, tomorrowStr());
      closeActionPopup();
      showToast('내일로 이동했어요');
      await loadTodos();
    } catch(e) { showToast('오류가 발생했어요'); }
  });

  document.getElementById('action-pick-date').addEventListener('click', () => {
    const picker = document.getElementById('action-date-picker');
    picker.value = AppState.selectedDate;
    picker.classList.remove('hidden');
    picker.showPicker?.();
    picker.addEventListener('change', async function onPick() {
      picker.removeEventListener('change', onPick);
      picker.classList.add('hidden');
      if (!picker.value || !actionTargetId) return;
      try {
        await moveTodoDate(actionTargetId, picker.value);
        closeActionPopup();
        showToast('날짜를 변경했어요');
        await loadTodos();
      } catch(e) { showToast('오류가 발생했어요'); }
    });
  });

  document.getElementById('action-delete').addEventListener('click', async () => {
    if (!actionTargetId) return;
    try {
      await deleteTodo(actionTargetId);
      AppState.todos = AppState.todos.filter(t => t.id !== actionTargetId);
      closeActionPopup();
      renderTodos();
      updateMonthDots();
      showToast('삭제됐어요');
    } catch(e) { showToast('오류가 발생했어요'); }
  });
}

function openActionPopup(id) {
  actionTargetId = id;
  document.getElementById('action-popup').classList.remove('hidden');
}

function closeActionPopup() {
  document.getElementById('action-popup').classList.add('hidden');
  document.getElementById('action-date-picker').classList.add('hidden');
  actionTargetId = null;
}

// ── 아이템별 제스처 초기화 ──
function initItemGesture(el, todo) {
  let startX = 0, startY = 0;
  let moved = false;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) moved = true;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!moved) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 60) return;

    if (dx > 0) {
      // 좌→우: 완료 처리
      handleSwipeComplete(el, todo);
    } else {
      // 우→좌: 액션 팝업
      openActionPopup(todo.id);
    }
  }, { passive: true });
}

async function handleSwipeComplete(el, todo) {
  if (todo.is_done) return; // 이미 완료면 무시
  el.classList.add('swipe-complete');
  setTimeout(async () => {
    try {
      await toggleDone(todo.id, true);
      const t = AppState.todos.find(t => t.id === todo.id);
      if (t) { t.is_done = true; t.done_at = new Date().toISOString(); }
      renderTodos();
      updateMonthDots();
    } catch(e) {
      el.classList.remove('swipe-complete');
      showToast('오류가 발생했어요');
    }
  }, 300);
}
