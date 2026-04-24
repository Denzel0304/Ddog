// =============================================
// storage.js — 창고 탭 (날짜 없는 "곧 할일들")
// 독립 파일: todo.js / weekly.js 원본 미수정
// =============================================

function initStorage() {
  // 창고 탭은 헤더 고정 + 리스트만 → 별도 초기화 이벤트 없음.
  // 액션 팝업의 "1일 뒤" 버튼 표시/숨김은 openActionPopup에서 처리.
}

// 창고 항목 로드 & 렌더링
async function loadStorage() {
  const container = document.getElementById('storage-todo-list');
  if (!container) return;

  try {
    const rows = await fetchStorageTodos();
    renderStorageTodos(rows);
  } catch(e) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>불러오기 실패</div>';
    console.error(e);
  }
}

function renderStorageTodos(rows) {
  const container = document.getElementById('storage-todo-list');
  container.innerHTML = '';

  if (!rows || rows.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div>창고가 비었어요</div>';
    return;
  }

  // 정렬: 1차 중요도 내림차순, 2차 sort_order (드래그), 3차 최신순(created_at DESC)
  // ※ 반복 일정 로직은 창고에 없음 (창고 항목은 반복 불가)
  const sorted = [...rows].sort((a, b) => {
    if ((b.importance || 0) !== (a.importance || 0)) return (b.importance || 0) - (a.importance || 0);
    if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
    return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
  });

  sorted.forEach(todo => container.appendChild(makeStorageTodoItem(todo)));

  initStorageDragSort();
}

function makeStorageTodoItem(todo) {
  const el = document.createElement('div');
  el.className = 'storage-todo-item';
  el.dataset.id = todo.id;

  // 중요도 바 (창고는 반복 없음 → 항상 imp-N)
  const bar = document.createElement('div');
  bar.className = `imp-badge imp-${todo.importance || 0}`;

  // 텍스트 영역
  const textWrap = document.createElement('div');
  textWrap.className = 'todo-text';

  const titleEl = document.createElement('div');
  titleEl.className = 'todo-title';
  titleEl.textContent = todo.title || '(제목 없음)';
  textWrap.appendChild(titleEl);

  if (todo.memo) {
    const memoEl = document.createElement('div');
    memoEl.className = 'todo-memo';
    memoEl.textContent = todo.memo;
    textWrap.appendChild(memoEl);
  }

  // 드래그 핸들
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '<svg viewBox="0 0 24 14" width="22" height="14" fill="currentColor"><rect y="0" width="24" height="2.5" rx="1.2"/><rect y="5.5" width="24" height="2.5" rx="1.2"/><rect y="11" width="24" height="2.5" rx="1.2"/></svg>';
  handle.setAttribute('data-storage-drag-handle', '');

  // 점3개 메뉴 버튼
  const menuBtn = document.createElement('div');
  menuBtn.className = 'todo-menu-btn';
  menuBtn.innerHTML = '<svg viewBox="0 0 4 18" width="4" height="18" fill="currentColor"><circle cx="2" cy="2" r="1.6"/><circle cx="2" cy="9" r="1.6"/><circle cx="2" cy="16" r="1.6"/></svg>';
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    // 3번째 인자(targetDate)는 창고에선 의미 없음. todo 객체에 _fromStorage 플래그 주입.
    openActionPopup(todo.id, false, null, { ...todo, _fromStorage: true });
  });

  el.appendChild(bar);
  el.appendChild(textWrap);
  el.appendChild(handle);
  el.appendChild(menuBtn);

  // 클릭 → 편집 모달 (체크박스 없음, 핸들/메뉴 제외)
  textWrap.addEventListener('click', () => openEditModal(todo));
  bar.addEventListener('click', () => openEditModal(todo));

  initStorageItemGesture(el, todo);
  return el;
}

// ── 창고 항목 제스처: 좌→우(완료) 차단, 우→좌(액션) 허용 ──
function initStorageItemGesture(el, todo) {
  let startX = 0, startY = 0, moved = false, isHorizontal = null;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false; isHorizontal = null;
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
    // 좌→우 방향(dx>0)은 시각 피드백도 주지 않음 → 완료 불가
    if (dx < 0) {
      const clampedX = Math.max(-120, dx);
      el.style.transform = `translateX(${clampedX}px)`;
      el.style.background = `rgba(224,92,106,${Math.min(Math.abs(dx)/120, 0.25)})`;
    }
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!isHorizontal || !moved) { resetStorageItemStyle(el); return; }
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 60) {
      resetStorageItemStyle(el); return;
    }
    if (dx > 0) {
      // 좌→우: 창고에선 완료 불가 → 아무 동작 없이 복귀
      resetStorageItemStyle(el);
    } else {
      // 우→좌: 액션 팝업
      resetStorageItemStyle(el);
      openActionPopup(todo.id, false, null, { ...todo, _fromStorage: true });
    }
  }, { passive: true });
}

function resetStorageItemStyle(el) {
  el.style.transition = 'transform 0.2s ease, background 0.2s ease';
  el.style.transform = '';
  el.style.background = '';
  setTimeout(() => { el.style.transition = ''; }, 220);
}

// =============================================
// 창고 드래그 정렬 (todo.js 원본과 독립)
// =============================================
let _storageDragSrc = null;
let _storageAutoScrollRAF = null;
let _storageDragCurrentY = 0;

function _storageStartAutoScroll() {
  const scrollEl = document.getElementById('storage-list-section');
  if (!scrollEl) return;
  const ZONE = 80;
  const MAX_SPEED = 6;

  function step() {
    const rect = scrollEl.getBoundingClientRect();
    const distTop    = _storageDragCurrentY - rect.top;
    const distBottom = rect.bottom - _storageDragCurrentY;

    let speed = 0;
    if (distBottom < ZONE && distBottom > 0) {
      speed = MAX_SPEED * (1 - distBottom / ZONE);
    } else if (distTop < ZONE && distTop > 0) {
      speed = -MAX_SPEED * (1 - distTop / ZONE);
    }

    if (speed !== 0) scrollEl.scrollTop += speed;
    _storageAutoScrollRAF = requestAnimationFrame(step);
  }
  _storageAutoScrollRAF = requestAnimationFrame(step);
}

function _storageStopAutoScroll() {
  if (_storageAutoScrollRAF) {
    cancelAnimationFrame(_storageAutoScrollRAF);
    _storageAutoScrollRAF = null;
  }
}

function initStorageDragSort() {
  const items = document.querySelectorAll('.storage-todo-item');
  items.forEach(item => {
    const handle = item.querySelector('[data-storage-drag-handle]');
    if (!handle) return;
    handle.addEventListener('touchstart', _onStorageTouchDragStart, { passive: false });
    handle.addEventListener('mousedown', _onStorageMouseDragStart);
  });
}

function _onStorageMouseDragStart(e) {
  e.preventDefault();
  const item = e.currentTarget.closest('.storage-todo-item');
  _storageDragSrc = item;
  item.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  _storageDragCurrentY = e.clientY;
  const startY = e.clientY;
  let scrollStarted = false;

  const onMove = ev => {
    _storageDragCurrentY = ev.clientY;
    if (!scrollStarted && Math.abs(ev.clientY - startY) > 10) {
      scrollStarted = true;
      _storageStartAutoScroll();
    }
    const target = _getStorageDragTarget(ev.clientX, ev.clientY);
    _highlightStorageDragOver(target, ev.clientY);
  };
  const onUp = ev => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    _storageStopAutoScroll();
    _finishStorageDrag(ev.clientX, ev.clientY);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _onStorageTouchDragStart(e) {
  e.preventDefault();
  const item = e.currentTarget.closest('.storage-todo-item');
  _storageDragSrc = item;
  item.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  _storageDragCurrentY = e.touches[0].clientY;
  const startY = e.touches[0].clientY;
  let scrollStarted = false;

  const onMove = ev => {
    const t = ev.touches[0];
    _storageDragCurrentY = t.clientY;
    if (!scrollStarted && Math.abs(t.clientY - startY) > 10) {
      scrollStarted = true;
      _storageStartAutoScroll();
    }
    const target = _getStorageDragTarget(t.clientX, t.clientY);
    _highlightStorageDragOver(target, t.clientY);
  };
  const onEnd = ev => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    _storageStopAutoScroll();
    const t = ev.changedTouches[0];
    _finishStorageDrag(t.clientX, t.clientY);
  };
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });
}

function _getStorageDragTarget(x, y) {
  const els = document.elementsFromPoint(x, y);
  return els.find(el =>
    el.classList.contains('storage-todo-item') &&
    el !== _storageDragSrc
  );
}

function _highlightStorageDragOver(target, clientY) {
  document.querySelectorAll('.storage-todo-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const mid  = rect.top + rect.height / 2;
  if (clientY < mid) target.classList.add('drag-over-top');
  else               target.classList.add('drag-over-bottom');
}

async function _finishStorageDrag(x, y) {
  if (!_storageDragSrc) return;
  _storageDragSrc.classList.remove('dragging');

  const target = _getStorageDragTarget(x, y);
  document.querySelectorAll('.storage-todo-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  if (target && target !== _storageDragSrc) {
    const rect = target.getBoundingClientRect();
    const mid  = rect.top + rect.height / 2;
    if (y < mid) target.before(_storageDragSrc);
    else         target.after(_storageDragSrc);

    const container = document.getElementById('storage-todo-list');
    const srcId = _storageDragSrc.dataset.id;
    const newOrder = [...container.querySelectorAll('.storage-todo-item')]
      .map(el => el.dataset.id);

    try {
      // 각 항목의 IDB/Supabase sort_order 갱신
      await Promise.all(newOrder.map((id, i) => updateTodo(id, { sort_order: i })));
    } catch(e) { console.error('[storage] sort order save failed', e); }
  }

  _storageDragSrc = null;

  // 최종 렌더링은 중요도 우선으로 재정렬 (todo.js 패턴과 동일)
  loadStorage();
}
