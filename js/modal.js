// =============================================
// modal.js — 할일 추가 / 수정 모달
// =============================================

let selectedImportance = 0;

// 체크리스트 임시 상태 (모달 열려있는 동안)
let checklistItems = []; // [{id, text, checked}]

function initModal() {
  document.getElementById('fab-add').addEventListener('click', openAddModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('detail-toggle').addEventListener('change', e => {
    document.getElementById('detail-section').classList.toggle('hidden', !e.target.checked);
  });
  document.querySelectorAll('.imp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedImportance = parseInt(btn.dataset.val);
      document.querySelectorAll('.imp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.getElementById('modal-save').addEventListener('click', handleSave);
  document.getElementById('input-title').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !document.getElementById('detail-toggle').checked) handleSave();
  });
  const remindInput = document.getElementById('input-remind');
  remindInput.addEventListener('focus', () => { if (remindInput.value === '0') remindInput.value = ''; });
  remindInput.addEventListener('blur',  () => { if (remindInput.value === '')  remindInput.value = '0'; });

  // 체크리스트 토글 버튼
  document.getElementById('checklist-toggle').addEventListener('change', e => {
    if (e.target.checked) {
      openChecklistModal();
    } else {
      // 체크 해제 시 체크리스트 비움
      checklistItems = [];
      updateChecklistToggleUI();
    }
  });

  // 체크리스트 모달 초기화
  initChecklistModal();

  // 반복 수정 오버레이
  initRepeatEditOverlay();
}

function getDefaultDate() {
  if (currentTab === 'weekly' && selectedWeekDay) return selectedWeekDay;
  return AppState.selectedDate;
}

function openAddModal() {
  AppState.editingId = null;
  AppState.editingTodo = null;
  document.getElementById('modal-title-label').textContent = '할일 추가';
  resetModalForm();
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-title').focus(), 300);
}

function openEditModal(todo) {
  AppState.editingId = todo.id;
  AppState.editingTodo = todo;
  document.getElementById('modal-title-label').textContent = '할일 수정';
  resetModalForm();
  document.getElementById('input-title').value  = todo.title || '';
  document.getElementById('input-memo').value   = todo.memo  || '';
  document.getElementById('input-date').value   = todo.date  || todayStr();
  document.getElementById('input-remind').value = todo.remind_days || 0;
  document.getElementById('input-weekly-flag').checked = !!todo.weekly_flag;

  selectedImportance = todo.importance || 0;
  document.querySelectorAll('.imp-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.val) === selectedImportance);
  });

  if (todo.repeat_type && todo.repeat_type !== 'none') {
    repeatConfig = dataToRepeatConfig(todo);
    updateRepeatBtn();
  }

  // 체크리스트 복원
  if (todo.checklist) {
    try {
      checklistItems = JSON.parse(todo.checklist);
      if (!Array.isArray(checklistItems)) checklistItems = [];
    } catch(e) { checklistItems = []; }
  } else {
    checklistItems = [];
  }
  updateChecklistToggleUI();

  if (todo.memo || todo.importance > 0 || todo.remind_days > 0 || todo.weekly_flag ||
      (todo.repeat_type && todo.repeat_type !== 'none') || checklistItems.length > 0) {
    document.getElementById('detail-toggle').checked = true;
    document.getElementById('detail-section').classList.remove('hidden');
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-title').focus(), 300);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  AppState.editingId = null;
  AppState.editingTodo = null;
  checklistItems = [];
}

function resetModalForm() {
  document.getElementById('input-title').value  = '';
  document.getElementById('input-memo').value   = '';
  document.getElementById('input-date').value   = getDefaultDate();
  document.getElementById('input-remind').value = 0;
  document.getElementById('input-weekly-flag').checked = false;
  document.getElementById('detail-toggle').checked = false;
  document.getElementById('detail-section').classList.add('hidden');
  selectedImportance = 0;
  document.querySelectorAll('.imp-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.imp-btn[data-val="0"]').classList.add('active');
  checklistItems = [];
  updateChecklistToggleUI();
  resetRepeat();
}

// ─── 체크리스트 모달 ───

function initChecklistModal() {
  document.getElementById('checklist-modal-close').addEventListener('click', () => {
    closeChecklistModal(false);
  });
  document.getElementById('checklist-overlay').addEventListener('click', e => {
    if (e.target.id === 'checklist-overlay') closeChecklistModal(false);
  });
  document.getElementById('checklist-cancel-btn').addEventListener('click', () => {
    closeChecklistModal(false);
  });
  document.getElementById('checklist-confirm-btn').addEventListener('click', () => {
    closeChecklistModal(true);
  });

  const input = document.getElementById('checklist-input');
  const addBtn = document.getElementById('checklist-add-btn');

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItemFromInput();
    }
  });
  addBtn.addEventListener('click', addChecklistItemFromInput);
}

// 체크리스트 모달 열 때 기존 상태 백업
let _checklistBackup = [];

function openChecklistModal() {
  _checklistBackup = JSON.parse(JSON.stringify(checklistItems));
  renderChecklistItems();
  document.getElementById('checklist-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('checklist-input').focus(), 200);
}

function closeChecklistModal(save) {
  if (!save) {
    checklistItems = _checklistBackup;
  }
  updateChecklistToggleUI();
  document.getElementById('checklist-overlay').classList.add('hidden');
}

function addChecklistItemFromInput() {
  const input = document.getElementById('checklist-input');
  const text = input.value.trim();
  if (!text) return;
  const id = 'cl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  checklistItems.push({ id, text, checked: false });
  input.value = '';
  renderChecklistItems();
  // 포커스 유지
  input.focus();
}

function renderChecklistItems() {
  const container = document.getElementById('checklist-items');
  container.innerHTML = '';

  checklistItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'checklist-item-row';
    row.dataset.clid = item.id;

    // 드래그 핸들
    const handle = document.createElement('div');
    handle.className = 'checklist-drag-handle';
    handle.innerHTML = '<svg viewBox="0 0 24 14" width="18" height="12" fill="currentColor"><rect y="0" width="24" height="2.5" rx="1.2"/><rect y="5.5" width="24" height="2.5" rx="1.2"/><rect y="11" width="24" height="2.5" rx="1.2"/></svg>';

    // 체크박스
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'checklist-item-check';
    cb.checked = item.checked;
    cb.addEventListener('change', () => {
      const idx = checklistItems.findIndex(it => it.id === item.id);
      if (idx !== -1) checklistItems[idx].checked = cb.checked;
    });

    // 텍스트 입력
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'checklist-item-text';
    textInput.value = item.text;
    textInput.addEventListener('input', () => {
      const idx = checklistItems.findIndex(it => it.id === item.id);
      if (idx !== -1) checklistItems[idx].text = textInput.value;
    });
    textInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const rows = [...container.querySelectorAll('.checklist-item-row')];
        const curIdx = rows.findIndex(r => r.dataset.clid === item.id);
        if (curIdx < rows.length - 1) {
          rows[curIdx + 1].querySelector('.checklist-item-text').focus();
        } else {
          document.getElementById('checklist-input').focus();
        }
      }
    });

    // 삭제 버튼
    const delBtn = document.createElement('button');
    delBtn.className = 'checklist-item-del';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      const idx = checklistItems.findIndex(it => it.id === item.id);
      if (idx !== -1) checklistItems.splice(idx, 1);
      renderChecklistItems();
    });

    row.appendChild(handle);
    row.appendChild(cb);
    row.appendChild(textInput);
    row.appendChild(delBtn);
    container.appendChild(row);

    // 드래그 핸들 이벤트
    initChecklistItemDrag(handle, container, item.id);
  });
}

// ─── 체크리스트 드래그 정렬 ───

function initChecklistItemDrag(handle, container, itemId) {
  let startY = 0, startX = 0, isDragging = false, cloneEl = null, origRect = null, srcRow = null;

  const getRow = () => container.querySelector(`[data-clid="${itemId}"]`);

  const onStart = (clientX, clientY) => {
    startY = clientY;
    startX = clientX;
    srcRow = getRow();
  };

  const onMove = (clientX, clientY) => {
    if (!srcRow) return;
    if (!isDragging) {
      if (Math.abs(clientY - startY) > 6) {
        isDragging = true;
        srcRow.classList.add('cl-dragging');
        origRect = srcRow.getBoundingClientRect();
        cloneEl = srcRow.cloneNode(true);
        cloneEl.className = 'checklist-item-row cl-drag-clone';
        cloneEl.style.cssText = `position:fixed;left:${origRect.left}px;top:${origRect.top}px;width:${origRect.width}px;z-index:9999;pointer-events:none;opacity:0.85;background:var(--bg-hover);border-radius:8px;`;
        document.body.appendChild(cloneEl);
      } else return;
    }

    const dy = clientY - startY;
    cloneEl.style.top = (origRect.top + dy) + 'px';

    // 드롭 위치 표시 (녹색선)
    const rows = [...container.querySelectorAll('.checklist-item-row:not(.cl-dragging)')];
    rows.forEach(r => r.classList.remove('cl-drag-over-top', 'cl-drag-over-bottom'));
    const target = rows.find(r => {
      const rect = r.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    });
    if (target) {
      const rect = target.getBoundingClientRect();
      target.classList.add(clientY < rect.top + rect.height / 2 ? 'cl-drag-over-top' : 'cl-drag-over-bottom');
    }
  };

  const onEnd = (clientY) => {
    if (!srcRow) return;
    if (!isDragging) { srcRow = null; return; }
    isDragging = false;
    srcRow.classList.remove('cl-dragging');
    if (cloneEl) { cloneEl.remove(); cloneEl = null; }

    const rows = [...container.querySelectorAll('.checklist-item-row:not(.cl-dragging)')];
    rows.forEach(r => r.classList.remove('cl-drag-over-top', 'cl-drag-over-bottom'));

    // 드롭 위치 계산
    let dropIndex = checklistItems.length;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid) { dropIndex = i; break; }
    }

    const srcIdx = checklistItems.findIndex(it => it.id === itemId);
    if (srcIdx === -1) { srcRow = null; return; }
    const srcItem = checklistItems[srcIdx];
    checklistItems.splice(srcIdx, 1);
    const finalIdx = dropIndex > srcIdx ? dropIndex - 1 : dropIndex;
    checklistItems.splice(Math.max(0, Math.min(finalIdx, checklistItems.length)), 0, srcItem);

    srcRow = null;
    renderChecklistItems();
  };

  // 터치
  handle.addEventListener('touchstart', e => {
    e.preventDefault();
    onStart(e.touches[0].clientX, e.touches[0].clientY);
    const onMove2 = ev => onMove(ev.touches[0].clientX, ev.touches[0].clientY);
    const onEnd2 = ev => {
      document.removeEventListener('touchmove', onMove2);
      document.removeEventListener('touchend', onEnd2);
      onEnd(ev.changedTouches[0].clientY);
    };
    document.addEventListener('touchmove', onMove2, { passive: false });
    document.addEventListener('touchend', onEnd2, { passive: true });
  }, { passive: false });

  // 마우스
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    onStart(e.clientX, e.clientY);
    document.body.style.userSelect = 'none';
    const onMove2 = ev => onMove(ev.clientX, ev.clientY);
    const onEnd2 = ev => {
      document.removeEventListener('mousemove', onMove2);
      document.removeEventListener('mouseup', onEnd2);
      document.body.style.userSelect = '';
      onEnd(ev.clientY);
    };
    document.addEventListener('mousemove', onMove2);
    document.addEventListener('mouseup', onEnd2);
  });
}

function updateChecklistToggleUI() {
  const validItems = checklistItems.filter(it => it.text && it.text.trim());
  const toggle = document.getElementById('checklist-toggle');
  const label = document.getElementById('checklist-toggle-label');
  if (validItems.length > 0) {
    toggle.checked = true;
    label.querySelector('span').textContent = `리스트(${validItems.length})`;
  } else {
    toggle.checked = false;
    label.querySelector('span').textContent = '리스트';
  }
}

// ─── 반복 수정 오버레이 ───

let repeatEditCallback = null;

function initRepeatEditOverlay() {
  document.getElementById('repeat-edit-overlay').addEventListener('click', e => {
    if (e.target.id === 'repeat-edit-overlay') closeRepeatEditOverlay();
  });
  document.getElementById('repeat-edit-cancel').addEventListener('click', closeRepeatEditOverlay);

  document.getElementById('repeat-edit-only').addEventListener('click', async () => {
    if (!repeatEditCallback) return;
    const cb = repeatEditCallback;
    closeRepeatEditOverlay();
    await cb('only');
  });
  document.getElementById('repeat-edit-from').addEventListener('click', async () => {
    if (!repeatEditCallback) return;
    const cb = repeatEditCallback;
    closeRepeatEditOverlay();
    await cb('from');
  });
  document.getElementById('repeat-edit-all').addEventListener('click', async () => {
    if (!repeatEditCallback) return;
    const cb = repeatEditCallback;
    closeRepeatEditOverlay();
    await cb('all');
  });
}

function openRepeatEditOverlay(callback) {
  repeatEditCallback = callback;
  document.getElementById('repeat-edit-overlay').classList.remove('hidden');
}

function closeRepeatEditOverlay() {
  document.getElementById('repeat-edit-overlay').classList.add('hidden');
  repeatEditCallback = null;
}

// ─── 저장 처리 ───

async function handleSave() {
  const title       = document.getElementById('input-title').value.trim();
  const memo        = document.getElementById('input-memo').value.trim();
  const date        = document.getElementById('input-date').value || getDefaultDate();
  const remind      = parseInt(document.getElementById('input-remind').value) || 0;
  const weeklyFlag  = document.getElementById('input-weekly-flag').checked;

  if (!title) {
    document.getElementById('input-title').focus();
    document.getElementById('input-title').style.borderColor = 'var(--danger)';
    setTimeout(() => { document.getElementById('input-title').style.borderColor = ''; }, 1500);
    showToast('제목을 입력해주세요 ✏️');
    return;
  }

  const repeatData = repeatConfigToData();
  if (repeatData.repeat_type === 'none') {
    repeatData.repeat_interval = 1;
    repeatData.repeat_day = null;
    repeatData.repeat_end_date = null;
    repeatData.repeat_meta = null;
  }

  // 체크리스트 직렬화 (텍스트 없는 항목 제거)
  const validItems = checklistItems.filter(it => it.text && it.text.trim());
  const checklistJson = validItems.length > 0 ? JSON.stringify(validItems) : null;

  // 체크리스트 완료 여부: 모두 체크돼 있을 때만 완료
  let checklistDone = false;
  if (checklistJson) {
    checklistDone = validItems.every(it => it.checked);
  }

  const data = {
    title, memo,
    importance:  selectedImportance,
    date,
    remind_days: remind,
    weekly_flag: weeklyFlag,
    checklist:   checklistJson,
    ...repeatData,
  };

  // 체크리스트가 있으면 완료 상태도 데이터에 포함
  if (checklistJson) {
    data.is_done = checklistDone;
    data.done_at = checklistDone ? new Date().toISOString() : null;
  }

  try {
    if (AppState.editingId) {
      const editingTodo = AppState.editingTodo;
      const isVirtual = editingTodo && editingTodo._virtual;
      const isRepeatMaster = editingTodo &&
        editingTodo.repeat_type && editingTodo.repeat_type !== 'none' &&
        !editingTodo.repeat_master_id && !editingTodo.repeat_exception && !isVirtual;
      const isRepeatException = editingTodo && !!editingTodo.repeat_master_id;

      if (isRepeatMaster || isRepeatException || isVirtual) {
        const masterId = isVirtual ? editingTodo._masterId :
                         isRepeatException ? editingTodo.repeat_master_id : editingTodo.id;
        const dateStr  = isVirtual ? (editingTodo.date || AppState.selectedDate) :
                         isRepeatException ? editingTodo.date : editingTodo.date;

        openRepeatEditOverlay(async (mode) => {
          try {
            if (mode === 'only') {
              await updateRepeatOnlyDate(masterId, dateStr, data);
            } else if (mode === 'from') {
              await updateRepeatFromDate(masterId, dateStr, data);
            } else {
              await updateRepeatAll(masterId, data);
            }
            closeModal();
            refreshCurrentTab();
            updateMonthDots();
            showToast('수정됐어요 ✓');
          } catch(e) {
            showToast('저장 실패. 다시 시도해주세요');
            console.error(e);
          }
        });
        return;
      }

      // 일반 할일 수정
      await updateTodo(AppState.editingId, data);
      const idx = AppState.todos.findIndex(t => t.id === AppState.editingId);
      if (idx !== -1) AppState.todos[idx] = { ...AppState.todos[idx], ...data };
      closeModal();
      refreshCurrentTab();
      showToast('수정됐어요 ✓');
    } else {
      // 신규 추가
      const newTodo = await insertTodo(data);
      if (date === AppState.selectedDate) AppState.todos.unshift(newTodo);
      if (remind > 0) {
        const remindDate = daysBeforeStr(date, remind);
        if (remindDate !== date) {
          const d = new Date(date + 'T00:00:00');
          const dateLabel = `${d.getMonth()+1}월 ${d.getDate()}일`;
          await insertRemindCopy(newTodo, remindDate, dateLabel);
        }
      }
      closeModal();
      refreshCurrentTab();
      showToast('추가됐어요 ✓');
    }
  } catch(e) {
    showToast('저장 실패. 다시 시도해주세요');
    console.error(e);
  }
}
