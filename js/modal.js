// =============================================
// modal.js — 할일 추가 / 수정 모달
// =============================================

let selectedImportance = 0;
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

  // 체크리스트 토글: 항목 없을 때만 클릭 가능 → 모달 열기
  document.getElementById('checklist-toggle').addEventListener('change', e => {
    const validItems = checklistItems.filter(it => it.text && it.text.trim());
    if (validItems.length > 0) {
      // 항목 있으면 체크 해제 불가 → 원상복귀
      e.target.checked = true;
      return;
    }
    if (e.target.checked) {
      openChecklistModal();
    }
  });

  // 체크리스트 버튼 클릭 (항목 있을 때 표시되는 버튼)
  document.getElementById('checklist-open-btn').addEventListener('click', () => {
    openChecklistModal();
  });

  initChecklistModal();
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
  updateChecklistUI();

  if (todo.memo || todo.importance > 0 || todo.remind_days > 0 || todo.weekly_flag ||
      (todo.repeat_type && todo.repeat_type !== 'none') || checklistItems.length > 0) {
    document.getElementById('detail-toggle').checked = true;
    document.getElementById('detail-section').classList.remove('hidden');
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
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
  updateChecklistUI();
  resetRepeat();
}

// ─── 체크리스트 UI 상태 관리 ───
// 항목 0개: 체크박스 활성화, 버튼 숨김
// 항목 1개+: 체크박스 비활성화(checked=true 고정), 버튼 표시

function updateChecklistUI() {
  const validItems = checklistItems.filter(it => it.text && it.text.trim());
  const toggle = document.getElementById('checklist-toggle');
  const label  = document.getElementById('checklist-toggle-label');
  const btn    = document.getElementById('checklist-open-btn');
  const prog   = getChecklistProgress({ checklist: validItems.length > 0 ? JSON.stringify(checklistItems) : null });

  if (validItems.length > 0) {
    // 비활성화 상태: 체크박스 숨기고 버튼 표시
    toggle.checked = true;
    toggle.disabled = true;
    label.classList.add('hidden');
    btn.classList.remove('hidden');
    // 버튼 텍스트: 진행도 표시
    if (prog) {
      btn.textContent = `☑ 리스트 (${prog.done}/${prog.total})`;
    } else {
      btn.textContent = '☑ 리스트';
    }
    btn.classList.toggle('active', prog && prog.done === prog.total);
  } else {
    // 활성화 상태: 체크박스 표시, 버튼 숨김
    toggle.checked = false;
    toggle.disabled = false;
    label.classList.remove('hidden');
    btn.classList.add('hidden');
  }
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
  document.getElementById('checklist-add-btn').addEventListener('click', addChecklistItemFromInput);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addChecklistItemFromInput(); }
  });
}

let _checklistBackup = [];

function openChecklistModal() {
  // 현재 상태 백업
  _checklistBackup = JSON.parse(JSON.stringify(checklistItems));

  // 저장 버튼 텍스트: 신규(editingId 없음)이면 '확인', 수정이면 '저장'
  const confirmBtn = document.getElementById('checklist-confirm-btn');
  confirmBtn.textContent = AppState.editingId ? '저장' : '확인';

  renderChecklistItems();
  document.getElementById('checklist-overlay').classList.remove('hidden');
  // 기존 항목이 없을 때만 입력창에 포커스 (항목 있으면 키보드 안 띄움)
  const validItems = checklistItems.filter(it => it.text && it.text.trim());
  if (validItems.length === 0) {
    setTimeout(() => document.getElementById('checklist-input').focus(), 200);
  }
}

function closeChecklistModal(save) {
  if (save) {
    // 저장: editingId가 있으면 즉시 DB 저장
    const validItems = checklistItems.filter(it => it.text && it.text.trim());
    const checklistJson = validItems.length > 0 ? JSON.stringify(validItems) : null;

    if (AppState.editingId && !String(AppState.editingId).startsWith('tmp_')) {
      // 체크리스트 완료 여부도 함께 업데이트
      const isDone = checklistJson ? validItems.every(it => it.checked) : false;
      const patch = { checklist: checklistJson, is_done: isDone, done_at: isDone ? new Date().toISOString() : null };

      // 반복 일정인지 확인
      const editingTodo = AppState.editingTodo;
      const isVirtual = editingTodo && editingTodo._virtual;
      const isRepeatMaster = editingTodo &&
        editingTodo.repeat_type && editingTodo.repeat_type !== 'none' &&
        !editingTodo.repeat_master_id && !editingTodo.repeat_exception && !isVirtual;
      const isRepeatException = editingTodo && !!editingTodo.repeat_master_id;

      if (isRepeatMaster || isVirtual) {
        // 반복 마스터/가상 → 이 날짜만 수정 (예외 행 생성)
        const masterId = isVirtual ? editingTodo._masterId : editingTodo.id;
        const dateStr  = isVirtual ? (editingTodo.date || AppState.selectedDate) : editingTodo.date;
        updateRepeatOnlyDate(masterId, dateStr, patch)
          .then(() => { refreshCurrentTab(); updateMonthDots(); })
          .catch(e => console.error(e));
      } else {
        // 일반 할일 또는 예외 행
        updateTodo(AppState.editingId, patch)
          .then(() => {
            const idx = AppState.todos.findIndex(t => t.id === AppState.editingId);
            if (idx !== -1) AppState.todos[idx] = { ...AppState.todos[idx], ...patch };
            refreshCurrentTab(); updateMonthDots();
          })
          .catch(e => console.error(e));
      }
      showToast('체크리스트 저장됐어요 ✓');
    }
    // 신규일 때는 임시 보관만 (할일 모달 저장 시 함께 저장)
  } else {
    // 취소: 백업으로 복원
    checklistItems = _checklistBackup;
  }

  updateChecklistUI();
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
  input.focus();
}

function renderChecklistItems() {
  const container = document.getElementById('checklist-items');
  container.innerHTML = '';

  checklistItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'checklist-item-row';
    row.dataset.clid = item.id;

    const handle = document.createElement('div');
    handle.className = 'checklist-drag-handle';
    handle.innerHTML = '<svg viewBox="0 0 24 14" width="18" height="12" fill="currentColor"><rect y="0" width="24" height="2.5" rx="1.2"/><rect y="5.5" width="24" height="2.5" rx="1.2"/><rect y="11" width="24" height="2.5" rx="1.2"/></svg>';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'checklist-item-check';
    cb.checked = item.checked;
    cb.addEventListener('change', () => {
      const idx = checklistItems.findIndex(it => it.id === item.id);
      if (idx !== -1) checklistItems[idx].checked = cb.checked;
    });

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

    initChecklistItemDrag(handle, container, item.id);
  });
}

// ─── 체크리스트 드래그 정렬 ───

function initChecklistItemDrag(handle, container, itemId) {
  let startY = 0, isDragging = false, cloneEl = null, origRect = null, srcRow = null;

  const getRow = () => container.querySelector(`[data-clid="${itemId}"]`);

  const onStart = (clientY) => {
    startY = clientY;
    srcRow = getRow();
  };

  const onMove = (clientY) => {
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
    cloneEl.style.top = (origRect.top + (clientY - startY)) + 'px';

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

    let dropIndex = checklistItems.length;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { dropIndex = i; break; }
    }

    const srcIdx = checklistItems.findIndex(it => it.id === itemId);
    if (srcIdx === -1) { srcRow = null; return; }
    const srcItem = checklistItems[srcIdx];
    checklistItems.splice(srcIdx, 1);
    const finalIdx = Math.max(0, Math.min(dropIndex > srcIdx ? dropIndex - 1 : dropIndex, checklistItems.length));
    checklistItems.splice(finalIdx, 0, srcItem);

    srcRow = null;
    renderChecklistItems();
  };

  handle.addEventListener('touchstart', e => {
    e.preventDefault();
    onStart(e.touches[0].clientY);
    const mv = ev => onMove(ev.touches[0].clientY);
    const en = ev => {
      document.removeEventListener('touchmove', mv);
      document.removeEventListener('touchend', en);
      onEnd(ev.changedTouches[0].clientY);
    };
    document.addEventListener('touchmove', mv, { passive: false });
    document.addEventListener('touchend', en, { passive: true });
  }, { passive: false });

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    onStart(e.clientY);
    document.body.style.userSelect = 'none';
    const mv = ev => onMove(ev.clientY);
    const en = ev => {
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', en);
      document.body.style.userSelect = '';
      onEnd(ev.clientY);
    };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', en);
  });
}

// ─── 반복 수정 오버레이 ───

let repeatEditCallback = null;

function initRepeatEditOverlay() {
  document.getElementById('repeat-edit-overlay').addEventListener('click', e => {
    if (e.target.id === 'repeat-edit-overlay') closeRepeatEditOverlay();
  });
  document.getElementById('repeat-edit-cancel').addEventListener('click', closeRepeatEditOverlay);
  document.getElementById('repeat-edit-only').addEventListener('click', async () => {
    const cb = repeatEditCallback; closeRepeatEditOverlay(); if (cb) await cb('only');
  });
  document.getElementById('repeat-edit-from').addEventListener('click', async () => {
    const cb = repeatEditCallback; closeRepeatEditOverlay(); if (cb) await cb('from');
  });
  document.getElementById('repeat-edit-all').addEventListener('click', async () => {
    const cb = repeatEditCallback; closeRepeatEditOverlay(); if (cb) await cb('all');
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
  const title      = document.getElementById('input-title').value.trim();
  const memo       = document.getElementById('input-memo').value.trim();
  const date       = document.getElementById('input-date').value || getDefaultDate();
  const remind     = parseInt(document.getElementById('input-remind').value) || 0;
  const weeklyFlag = document.getElementById('input-weekly-flag').checked;

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

  // 체크리스트 직렬화
  const validItems = checklistItems.filter(it => it.text && it.text.trim());
  const checklistJson = validItems.length > 0 ? JSON.stringify(validItems) : null;
  const checklistDone = checklistJson ? validItems.every(it => it.checked) : false;

  const data = {
    title, memo,
    importance:  selectedImportance,
    date,
    remind_days: remind,
    weekly_flag: weeklyFlag,
    checklist:   checklistJson,
    ...repeatData,
  };
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
                         editingTodo.date;

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
