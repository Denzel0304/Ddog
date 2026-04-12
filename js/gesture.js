// =============================================
// gesture.js — 할일 아이템 스와이프 제스처
// =============================================

let actionTargetId = null;
let actionFromWeekly = false;

function initGesturePopup() {
  document.getElementById('action-popup').addEventListener('click', e => {
    if (e.target.id === 'action-popup') closeActionPopup();
  });

  document.getElementById('action-tomorrow').addEventListener('click', async () => {
    if (!actionTargetId) return;
    try {
      await moveTodoDate(actionTargetId, tomorrowStr());
      closeActionPopup();
      showToast('내일로 이동했어요');
      actionFromWeekly ? loadWeekly() : await loadTodos();
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
        actionFromWeekly ? loadWeekly() : await loadTodos();
      } catch(e) { showToast('오류가 발생했어요'); }
    });
  });

  document.getElementById('action-delete').addEventListener('click', async () => {
    if (!actionTargetId) return;
    try {
      await deleteTodo(actionTargetId);
      AppState.todos = AppState.todos.filter(t => t.id !== actionTargetId);
      closeActionPopup();
      showToast('삭제됐어요');
      // 양쪽 모두 갱신
      if (actionFromWeekly) {
        await loadWeekly();
      } else {
        renderTodos();
        updateMonthDots();
      }
    } catch(e) { showToast('오류가 발생했어요'); }
  });
}

function openActionPopup(id, fromWeekly = false) {
  actionTargetId = id;
  actionFromWeekly = fromWeekly;
  document.getElementById('action-popup').classList.remove('hidden');
}

function closeActionPopup() {
  document.getElementById('action-popup').classList.add('hidden');
  document.getElementById('action-date-picker').classList.add('hidden');
  actionTargetId = null;
  actionFromWeekly = false;
}

// ── 할일탭 아이템 제스처 ──
function initItemGesture(el, todo) {
  let startX = 0, startY = 0, moved = false, currentX = 0, isHorizontal = null;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false; currentX = 0; isHorizontal = null;
    el.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (isHorizontal === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8)
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      return;
    }
    if (!isHorizontal) return;
    moved = true;
    currentX = dx;
    const clampedX = Math.max(-120, Math.min(120, dx));
    el.style.transform = `translateX(${clampedX}px)`;
    if (dx > 20)       el.style.background = `rgba(126,207,160,${Math.min(dx/120, 0.3)})`;
    else if (dx < -20) el.style.background = `rgba(224,92,106,${Math.min(Math.abs(dx)/120, 0.25)})`;
    else               el.style.background = '';
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!isHorizontal || !moved) { resetItemStyle(el); return; }
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 60) { resetItemStyle(el); return; }

    if (dx > 0 && !todo.is_done) {
      el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      el.style.transform = 'translateX(110%)';
      el.style.opacity = '0';
      setTimeout(async () => {
        try {
          await toggleDone(todo.id, true);
          const t = AppState.todos.find(t => t.id === todo.id);
          if (t) { t.is_done = true; t.done_at = new Date().toISOString(); }
          renderTodos();
          updateMonthDots();
        } catch(e) { resetItemStyle(el); showToast('오류가 발생했어요'); }
      }, 250);
    } else if (dx < 0) {
      resetItemStyle(el);
      openActionPopup(todo.id, false);
    } else {
      resetItemStyle(el);
    }
  }, { passive: true });
}

function resetItemStyle(el) {
  el.style.transition = 'transform 0.2s ease, background 0.2s ease';
  el.style.transform = '';
  el.style.background = '';
  setTimeout(() => { el.style.transition = ''; }, 220);
}
