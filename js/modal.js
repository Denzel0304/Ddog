// =============================================
// modal.js — 할일 추가 / 수정 모달
// =============================================

let selectedImportance = 0;

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
}

function getDefaultDate() {
  if (currentTab === 'weekly' && selectedWeekDay) return selectedWeekDay;
  return AppState.selectedDate;
}

function openAddModal() {
  AppState.editingId = null;
  document.getElementById('modal-title-label').textContent = '할일 추가';
  resetModalForm();
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-title').focus(), 300);
}

function openEditModal(todo) {
  AppState.editingId = todo.id;
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

  if (todo.memo || todo.importance > 0 || todo.remind_days > 0 || todo.weekly_flag ||
      (todo.repeat_type && todo.repeat_type !== 'none')) {
    document.getElementById('detail-toggle').checked = true;
    document.getElementById('detail-section').classList.remove('hidden');
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-title').focus(), 300);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  AppState.editingId = null;
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
  resetRepeat();
}

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

  // 반복 해제 시 관련 필드 명시적 초기화
  if (repeatData.repeat_type === 'none') {
    repeatData.repeat_interval = 1;
    repeatData.repeat_day = null;
    repeatData.repeat_end_date = null;
    repeatData.repeat_meta = null;
  }

  const data = {
    title, memo,
    importance:  selectedImportance,
    date,
    remind_days: remind,
    weekly_flag: weeklyFlag,
    ...repeatData,
  };

  try {
    if (AppState.editingId) {
      await updateTodo(AppState.editingId, data);
      const idx = AppState.todos.findIndex(t => t.id === AppState.editingId);
      if (idx !== -1) AppState.todos[idx] = { ...AppState.todos[idx], ...data };
    } else {
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
    }
    closeModal();
    refreshCurrentTab();
    showToast(AppState.editingId ? '수정됐어요 ✓' : '추가됐어요 ✓');
  } catch(e) {
    showToast('저장 실패. 다시 시도해주세요');
    console.error(e);
  }
}