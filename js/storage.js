// =============================================
// storage.js — 창고 탭 (날짜 없는 "곧 할일들")
// 독립 파일: todo.js / weekly.js / gesture.js 원본 미수정
// 자체 액션 시트를 사용 (기존 action-popup과 완전 분리)
// =============================================

function initStorage() {
  // 창고 전용 액션 시트는 필요할 때 동적으로 생성.
  // 초기화 시점엔 할 일 없음.
}

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

  // 정렬: 1차 중요도 내림차순, 2차 sort_order (드래그), 3차 최신순
  const sorted = [...rows].sort((a, b) => {
    if ((b.importance || 0) !== (a.importance || 0)) return (b.importance || 0) - (a.importance || 0);
    if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
    return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
  });

  sorted.forEach(todo => container.appendChild(makeStorageTodoItem(todo)));

  initStorageDragSort();
}

function makeStorageTodoItem(todo) {
  // 할일 탭 아이템(.todo-item)과 동일한 구조 사용 → 동일 디자인
  // 차이점: 체크박스 대신 투명 spacer, 제스처는 창고 전용
  const li = document.createElement('li');
  li.className = 'todo-item storage-item';
  li.dataset.id = todo.id;

  // 중요도 바 (창고는 반복 없음 → 항상 imp-N)
  const impBar = document.createElement('div');
  impBar.className = `imp-badge imp-${todo.importance || 0}`;

  // 체크박스 자리 → 투명 spacer (레이아웃 동일하게)
  const spacer = document.createElement('div');
  spacer.className = 'todo-check storage-check-spacer';

  // 텍스트 영역
  const textWrap = document.createElement('div');
  textWrap.className = 'todo-text';

  const titleEl = document.createElement('div');
  titleEl.className = 'todo-title';
  titleEl.appendChild(document.createTextNode(todo.title || '(제목 없음)'));
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

  // 드래그 핸들 (todo-item과 동일 스타일 클래스 사용)
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
    openStorageAction(todo);
  });

  li.appendChild(impBar);
  li.appendChild(spacer);
  li.appendChild(textWrap);
  li.appendChild(handle);
  li.appendChild(menuBtn);

  // 클릭 → 편집 모달 (핸들/메뉴 제외)
  textWrap.addEventListener('click', () => openEditModal(todo));
  impBar.addEventListener('click', () => openEditModal(todo));

  initStorageItemGesture(li, todo);
  return li;
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
    // 좌→우(dx>0)는 시각 피드백도 없음 → 창고에선 완료 불가
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
      resetStorageItemStyle(el);
    } else {
      resetStorageItemStyle(el);
      openStorageAction(todo);
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
// 창고 전용 액션 시트 (action-popup과 완전 분리)
//   - 날짜 선택 / 삭제 두 가지만 존재
//   - 모바일: 하단 시트 방식 (action-popup과 유사)
//   - PC:     마우스 위치 근처 드롭다운 (pcShowDropdown과 유사)
// =============================================

let _storageActionTodo = null;

function openStorageAction(todo) {
  _storageActionTodo = todo;
  const isPc = document.body.classList.contains('pc-layout');
  if (isPc) {
    _openStoragePcDropdown(todo);
  } else {
    _openStorageMobileSheet(todo);
  }
}

function closeStorageAction() {
  const mobile = document.getElementById('storage-action-popup');
  if (mobile) mobile.remove();
  const pc = document.getElementById('storage-pc-dropdown');
  if (pc) pc.remove();
  _storageActionTodo = null;
}

// ── 모바일: action-popup과 동일한 구조의 독립 시트 ──
function _openStorageMobileSheet(todo) {
  // 기존 시트 제거
  closeStorageAction();

  const overlay = document.createElement('div');
  overlay.id = 'storage-action-popup';
  overlay.className = 'overlay';

  const box = document.createElement('div');
  box.id = 'storage-action-box';
  box.className = 'action-box';

  const btnPick = document.createElement('button');
  btnPick.className = 'action-btn';
  btnPick.textContent = '🗓 날짜 선택';
  btnPick.addEventListener('click', () => _pickDateForStorage(todo.id));

  const btnDelete = document.createElement('button');
  btnDelete.className = 'action-btn danger';
  btnDelete.textContent = '🗑 삭제';
  btnDelete.addEventListener('click', async () => {
    try {
      await deleteTodo(todo.id);
      closeStorageAction();
      showToast('삭제됐어요');
      await loadStorage();
    } catch(e) { showToast('오류가 발생했어요'); }
  });

  const btnCancel = document.createElement('button');
  btnCancel.className = 'action-btn cancel';
  btnCancel.textContent = '취소';
  btnCancel.addEventListener('click', closeStorageAction);

  box.appendChild(btnPick);
  box.appendChild(btnDelete);
  box.appendChild(btnCancel);
  overlay.appendChild(box);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeStorageAction();
  });

  document.body.appendChild(overlay);
}

// ── PC: 점3개 버튼 근처 드롭다운 ──
function _openStoragePcDropdown(todo) {
  closeStorageAction();

  // 해당 항목의 점3개 버튼 찾기
  let refEl = null;
  document.querySelectorAll('.storage-item').forEach(el => {
    if (String(el.dataset.id) === String(todo.id)) {
      refEl = el.querySelector('.todo-menu-btn');
    }
  });
  if (!refEl) return;

  const rect = refEl.getBoundingClientRect();
  const dd = document.createElement('div');
  dd.id = 'storage-pc-dropdown';
  dd.className = 'pc-dropdown-clone';

  let top  = rect.bottom + 4;
  let left = rect.right - 160;
  if (left < 8) left = 8;
  if (top + 100 > window.innerHeight) top = rect.top - 104;
  dd.style.top  = top  + 'px';
  dd.style.left = left + 'px';

  const btnPick = document.createElement('button');
  btnPick.className = 'pc-dropdown-btn';
  btnPick.textContent = '🗓 날짜 선택';
  btnPick.addEventListener('click', () => {
    closeStorageAction();
    _pickDateForStoragePc(todo.id);
  });

  const btnDelete = document.createElement('button');
  btnDelete.className = 'pc-dropdown-btn danger';
  btnDelete.textContent = '🗑 삭제';
  btnDelete.addEventListener('click', async () => {
    closeStorageAction();
    try {
      await deleteTodo(todo.id);
      showToast('삭제됐어요');
      await loadStorage();
    } catch(e) { showToast('오류가 발생했어요'); }
  });

  dd.appendChild(btnPick);
  dd.appendChild(btnDelete);
  document.body.appendChild(dd);

  setTimeout(() => {
    document.addEventListener('click', function closeOut(e) {
      const el = document.getElementById('storage-pc-dropdown');
      if (el && !el.contains(e.target)) {
        closeStorageAction();
        document.removeEventListener('click', closeOut);
      }
    });
  }, 10);
}

// ── 모바일: 네이티브 date input을 이용한 날짜 선택 → convertStorageToTodo ──
function _pickDateForStorage(storageId) {
  // 화면 밖 임시 date input 생성 (네이티브 달력)
  const picker = document.createElement('input');
  picker.type = 'date';
  picker.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;pointer-events:none;';
  picker.value = AppState.selectedDate || todayStr();
  document.body.appendChild(picker);

  picker.addEventListener('change', async () => {
    const newDate = picker.value;
    picker.remove();
    if (!newDate) return;
    try {
      await convertStorageToTodo(storageId, newDate);
      closeStorageAction();
      showToast('할일로 옮겼어요');
      await loadStorage();
      if (newDate === AppState.selectedDate && typeof loadTodos === 'function') {
        await loadTodos();
      }
      updateMonthDots();
    } catch(e) {
      showToast('오류가 발생했어요');
      console.error('[storage] convert failed', e);
    }
  });

  // iOS/Android 호환: showPicker가 있으면 즉시 열기, 없으면 focus/click
  try {
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
    } else {
      picker.focus();
      picker.click();
    }
  } catch(e) {
    picker.focus();
    picker.click();
  }

  // 취소로 닫힐 경우를 위해 15초 후 자동 정리
  setTimeout(() => { if (picker.parentNode) picker.remove(); }, 15000);
}

// ── PC: 커스텀 달력 팝업으로 날짜 선택 ──
function _pickDateForStoragePc(storageId) {
  const existing = document.getElementById('pc-date-picker-popup');
  if (existing) existing.remove();

  const today = new Date();
  let pickerYear  = today.getFullYear();
  let pickerMonth = today.getMonth() + 1;
  const initDate = toLocalDateStr(today);

  const popup = document.createElement('div');
  popup.id = 'pc-date-picker-popup';
  popup.style.cssText = `
    position: fixed; z-index: 600;
    background: var(--bg-elevated);
    border: 1px solid var(--border-light);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.45);
    padding: 20px; width: 420px;
    user-select: none; font-family: var(--font-main);
  `;

  const centerEl = document.getElementById('pc-center');
  const cr = centerEl ? centerEl.getBoundingClientRect() :
             { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  popup.style.left = Math.round(cr.left + (cr.width - 420) / 2) + 'px';
  popup.style.top  = Math.round(cr.top  + (cr.height - 420) / 2) + 'px';

  function renderPicker() {
    popup.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '‹';
    prevBtn.style.cssText = 'font-size:28px;color:var(--text-secondary);background:none;border:none;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;';
    prevBtn.addEventListener('click', e => {
      e.stopPropagation();
      pickerMonth--; if (pickerMonth < 1) { pickerMonth = 12; pickerYear--; }
      renderPicker();
    });

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:18px;font-weight:700;color:var(--text-primary);';
    titleEl.textContent = `${pickerYear}년 ${pickerMonth}월`;

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '›';
    nextBtn.style.cssText = prevBtn.style.cssText;
    nextBtn.addEventListener('click', e => {
      e.stopPropagation();
      pickerMonth++; if (pickerMonth > 12) { pickerMonth = 1; pickerYear++; }
      renderPicker();
    });

    const thisMonthBtn = document.createElement('button');
    thisMonthBtn.textContent = '이번 달';
    thisMonthBtn.style.cssText = 'font-size:11px;font-weight:600;color:var(--accent);background:var(--accent-glow);border:1px solid var(--accent);cursor:pointer;padding:4px 10px;border-radius:12px;white-space:nowrap;margin-left:4px;';
    thisMonthBtn.addEventListener('click', e => {
      e.stopPropagation();
      const t = new Date();
      pickerYear  = t.getFullYear();
      pickerMonth = t.getMonth() + 1;
      renderPicker();
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'font-size:16px;color:var(--text-muted);background:none;border:none;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-left:4px;';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); popup.remove(); });

    header.appendChild(prevBtn);
    header.appendChild(titleEl);
    header.appendChild(nextBtn);
    header.appendChild(thisMonthBtn);
    header.appendChild(closeBtn);
    popup.appendChild(header);

    const wdays = document.createElement('div');
    wdays.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:6px;';
    ['일','월','화','수','목','금','토'].forEach((d, i) => {
      const span = document.createElement('div');
      span.textContent = d;
      span.style.cssText = `text-align:center;font-size:13px;font-weight:600;padding:4px 0;color:${i===0?'var(--danger)':i===6?'#6b9fd4':'var(--text-muted)'};`;
      wdays.appendChild(span);
    });
    popup.appendChild(wdays);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:2px;';

    const firstDay = new Date(pickerYear, pickerMonth - 1, 1).getDay();
    const lastDate = new Date(pickerYear, pickerMonth, 0).getDate();
    const todayStr2 = toLocalDateStr(new Date());

    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${pickerYear}-${String(pickerMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('button');
      cell.textContent = d;
      const isToday = dateStr === todayStr2;
      const dow = new Date(pickerYear, pickerMonth - 1, d).getDay();
      const color = dow === 0 ? 'var(--danger)' : dow === 6 ? '#6b9fd4' : 'var(--text-primary)';
      cell.style.cssText = `
        aspect-ratio:1;width:100%;border:none;cursor:pointer;border-radius:50%;
        font-size:16px;font-weight:${isToday?'700':'400'};
        background:${isToday?'var(--accent-glow)':'none'};
        color:${color};
        display:flex;align-items:center;justify-content:center;transition:background 0.12s;
      `;
      cell.addEventListener('mouseover', () => { cell.style.background = 'var(--bg-hover)'; });
      cell.addEventListener('mouseout',  () => { cell.style.background = isToday ? 'var(--accent-glow)' : 'none'; });
      cell.addEventListener('click', async e => {
        e.stopPropagation();
        popup.remove();
        try {
          await convertStorageToTodo(storageId, dateStr);
          showToast('할일로 옮겼어요');
          await loadStorage();
          if (dateStr === AppState.selectedDate && typeof loadTodos === 'function') {
            await loadTodos();
          }
          updateMonthDots();
        } catch(e2) {
          showToast('오류가 발생했어요');
          console.error('[storage pc] convert failed', e2);
        }
      });
      grid.appendChild(cell);
    }
    popup.appendChild(grid);
  }

  renderPicker();
  document.body.appendChild(popup);
  setTimeout(() => {
    document.addEventListener('click', function outsideClose(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', outsideClose);
      }
    });
  }, 10);
}

// =============================================
// 창고 드래그 정렬 (todo.js 드래그 로직과 독립)
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
  const items = document.querySelectorAll('.storage-item');
  items.forEach(item => {
    const handle = item.querySelector('[data-storage-drag-handle]');
    if (!handle) return;
    handle.addEventListener('touchstart', _onStorageTouchDragStart, { passive: false });
    handle.addEventListener('mousedown', _onStorageMouseDragStart);
  });
}

function _onStorageMouseDragStart(e) {
  e.preventDefault();
  const item = e.currentTarget.closest('.storage-item');
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
  const item = e.currentTarget.closest('.storage-item');
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
    el.classList.contains('storage-item') &&
    el !== _storageDragSrc
  );
}

function _highlightStorageDragOver(target, clientY) {
  document.querySelectorAll('.storage-item').forEach(el => {
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
  document.querySelectorAll('.storage-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  if (target && target !== _storageDragSrc) {
    const rect = target.getBoundingClientRect();
    const mid  = rect.top + rect.height / 2;
    if (y < mid) target.before(_storageDragSrc);
    else         target.after(_storageDragSrc);

    const container = document.getElementById('storage-todo-list');
    const newOrder = [...container.querySelectorAll('.storage-item')]
      .map(el => el.dataset.id);

    try {
      await Promise.all(newOrder.map((id, i) => updateTodo(id, { sort_order: i })));
    } catch(e) { console.error('[storage] sort order save failed', e); }
  }

  _storageDragSrc = null;
  loadStorage();
}
