// =============================================
// todo.js — 할일 목록 렌더링 & 드래그 정렬
// =============================================

// 할일 목록 로드 & 렌더링
async function loadTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '<div class="spinner"></div>';
  try {
    const dateStr = AppState.selectedDate;
    const allDirectRows = await fetchTodosByDate(dateStr);

    // 반복 마스터 행(repeat_type≠none, repeat_exception=false)은
    // 아래 가상 렌더링 로직이 담당 → directRows에서 제외해 중복 방지
    const directRows = (allDirectRows || []).filter(r =>
      !r.repeat_type || r.repeat_type === 'none' || r.repeat_exception === true
    );

    // 반복 마스터 가상 렌더링 (컬럼 없으면 건너뜀)
    let virtualRows = [];
    try {
      const repeatMasters = await fetchRepeatMasters(dateStr);
      const exceptions = await fetchRepeatExceptions(dateStr);
      const exceptionIds = new Set((exceptions || []).map(e => e.repeat_master_id));
      virtualRows = (repeatMasters || [])
        .filter(m => isRepeatMatch(m, dateStr) && !exceptionIds.has(m.id))
        .map(m => ({ ...m, _virtual: true, _masterId: m.id, date: dateStr }));
    } catch(e) { /* 반복 컬럼 미존재 시 무시 */ }

    AppState.todos = [...directRows, ...virtualRows];
    renderTodos();
    updateMonthDots();
  } catch(e) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>불러오기 실패</div>';
    console.error(e);
  }
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';

  const todos = AppState.todos;
  if (!todos.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div>할일이 없어요</div>';
    return;
  }

  // 정렬: 중요도 높은 것 → 미완료 → 완료
  const active = sortActiveTodos(todos.filter(t => !t.is_done));
  const done   = todos.filter(t => t.is_done);

  active.forEach(todo => list.appendChild(makeTodoItem(todo)));

  if (done.length > 0) {
    const divider = document.createElement('li');
    divider.className = 'done-divider';
    divider.textContent = '완료';
    list.appendChild(divider);
    done.forEach(todo => list.appendChild(makeTodoItem(todo)));
  }

  initDragSort();
}

// 활성 할일 정렬: 중요도 있는 것 먼저(높은순), 그 다음 sort_order
function sortActiveTodos(todos) {
  return [...todos].sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return a.sort_order - b.sort_order;
  });
}

function makeTodoItem(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.is_done ? ' done' : '');
  li.dataset.id = todo.id;

  // 중요도 바
  const impBar = document.createElement('div');
  impBar.className = `imp-badge imp-${todo.importance}`;

  // 체크박스
  const check = document.createElement('div');
  check.className = 'todo-check' + (todo.is_done ? ' checked' : '');
  check.addEventListener('click', () => handleToggleDone(todo));

  // 텍스트 영역
  const textWrap = document.createElement('div');
  textWrap.className = 'todo-text';

  const titleEl = document.createElement('div');
  titleEl.className = 'todo-title';
  // 반복 아이콘 (제목 맨 앞)
  if (todo.repeat_type && todo.repeat_type !== 'none') {
    const icon = document.createElement('span');
    icon.className = 'repeat-icon';
    icon.textContent = '🔁 ';
    titleEl.appendChild(icon);
  }
  // weekly_flag 별표
  if (todo.weekly_flag) {
    const flag = document.createElement('span');
    flag.className = 'weekly-flag-icon';
    flag.textContent = '★ ';
    titleEl.appendChild(flag);
  }
  titleEl.appendChild(document.createTextNode(todo.title));

  textWrap.appendChild(titleEl);

  if (todo.memo) {
    const metaEl = document.createElement('div');
    metaEl.className = 'todo-meta';
    const memoEl = document.createElement('span');
    memoEl.className = 'todo-memo';
    memoEl.textContent = todo.memo;
    metaEl.appendChild(memoEl);
    textWrap.appendChild(metaEl);
  }

  // 드래그 핸들 (미완료만)
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '<svg viewBox="0 0 24 14" width="22" height="14" fill="currentColor"><rect y="0" width="24" height="2.5" rx="1.2"/><rect y="5.5" width="24" height="2.5" rx="1.2"/><rect y="11" width="24" height="2.5" rx="1.2"/></svg>';
  handle.setAttribute('data-drag-handle', '');

  li.appendChild(impBar);
  li.appendChild(check);
  li.appendChild(textWrap);
  if (!todo.is_done) li.appendChild(handle);

  // 클릭 → 수정 모달 (체크/핸들 제외)
  textWrap.addEventListener('click', () => openEditModal(todo));
  impBar.addEventListener('click', () => openEditModal(todo));

  // 제스처 (gesture.js)
  initItemGesture(li, todo);

  return li;
}

// 완료 토글 처리 (반복 가상 항목 포함)
async function handleToggleDone(todo) {
  const newDone = !todo.is_done;
  try {
    if (todo._virtual) {
      // 반복 가상 항목 → 예외 행 생성
      const exRow = await insertRepeatException(todo._masterId, AppState.selectedDate, newDone);
      // 로컬에 예외 행으로 교체
      const idx = AppState.todos.findIndex(t => t._masterId === todo._masterId && t._virtual);
      if (idx !== -1) AppState.todos[idx] = { ...exRow, _wasVirtual: true };
    } else {
      await toggleDone(todo.id, newDone);
      const t = AppState.todos.find(t => t.id === todo.id);
      if (t) { t.is_done = newDone; t.done_at = newDone ? new Date().toISOString() : null; }
    }
    renderTodos();
    updateMonthDots();
  } catch(e) {
    showToast('오류가 발생했어요');
    console.error(e);
  }
}

// =============================================
// 드래그 정렬 (미완료 항목만)
// =============================================
let dragSrc = null;

function initDragSort() {
  const items = document.querySelectorAll('.todo-item:not(.done)');
  items.forEach(item => {
    const handle = item.querySelector('[data-drag-handle]');
    if (!handle) return;

    // 터치 드래그
    handle.addEventListener('touchstart', onTouchDragStart, { passive: false });
    // 마우스 드래그
    handle.addEventListener('mousedown', onMouseDragStart);
  });
}

// ── 마우스 드래그 ──
function onMouseDragStart(e) {
  e.preventDefault();
  const item = e.currentTarget.closest('.todo-item');
  dragSrc = item;
  item.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';

  const onMove = ev => {
    const target = getDragTarget(ev.clientX, ev.clientY);
    highlightDragOver(target);
  };
  const onUp = ev => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    finishDrag(ev.clientX, ev.clientY);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── 터치 드래그 ──
function onTouchDragStart(e) {
  e.preventDefault();
  const item = e.currentTarget.closest('.todo-item');
  dragSrc = item;
  item.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';

  const onMove = ev => {
    const t = ev.touches[0];
    const target = getDragTarget(t.clientX, t.clientY);
    highlightDragOver(target);
  };
  const onEnd = ev => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    const t = ev.changedTouches[0];
    finishDrag(t.clientX, t.clientY);
  };
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });
}

function getDragTarget(x, y) {
  const els = document.elementsFromPoint(x, y);
  return els.find(el =>
    el.classList.contains('todo-item') &&
    !el.classList.contains('done') &&
    el !== dragSrc
  );
}

function highlightDragOver(target) {
  document.querySelectorAll('.todo-item').forEach(el => el.classList.remove('drag-over'));
  if (target) {
    // 드래그 목표 다음 형제(아래 아이템)에 표시
    const next = target.nextElementSibling;
    if (next && next.classList.contains('todo-item') && !next.classList.contains('done')) {
      next.classList.add('drag-over');
    } else {
      target.classList.add('drag-over');
    }
  }
}

async function finishDrag(x, y) {
  if (!dragSrc) return;
  dragSrc.classList.remove('dragging');

  const target = getDragTarget(x, y);
  document.querySelectorAll('.todo-item').forEach(el => el.classList.remove('drag-over'));

  if (target && target !== dragSrc) {
    const list = document.getElementById('todo-list');
    const items = [...list.querySelectorAll('.todo-item:not(.done)')];
    const srcIdx = items.indexOf(dragSrc);
    const tgtIdx = items.indexOf(target);

    // DOM 순서 변경
    if (srcIdx < tgtIdx) {
      target.after(dragSrc);
    } else {
      target.before(dragSrc);
    }

    // AppState 순서 업데이트 & DB 저장 (virtual 항목 제외)
    const newOrder = [...list.querySelectorAll('.todo-item:not(.done)')]
      .map(el => AppState.todos.find(t => String(t.id) === String(el.dataset.id)))
      .filter(t => t && !t._virtual);

    try {
      await updateSortOrders(newOrder);
      newOrder.forEach((t, i) => { t.sort_order = i; });
    } catch(e) {
      console.error('sort order save failed', e);
    }
  }

  dragSrc = null;
}