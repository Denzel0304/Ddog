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

  // 상세 토글
  document.getElementById('detail-toggle').addEventListener('change', e => {
    document.getElementById('detail-section').classList.toggle('hidden', !e.target.checked);
  });

  // 중요도 버튼
  document.querySelectorAll('.imp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedImportance = parseInt(btn.dataset.val);
      document.querySelectorAll('.imp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 저장
  document.getElementById('modal-save').addEventListener('click', handleSave);

  // 제목 입력 후 Enter → 저장 (상세 모드 아닐 때)
  document.getElementById('input-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const isDetail = document.getElementById('detail-toggle').checked;
      if (!isDetail) handleSave();
    }
  });
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

  document.getElementById('input-title').value = todo.title || '';
  document.getElementById('input-memo').value  = todo.memo  || '';
  document.getElementById('input-date').value  = todo.date  || todayStr();
  document.getElementById('input-remind').value = todo.remind_days || 0;

  // 중요도
  selectedImportance = todo.importance || 0;
  document.querySelectorAll('.imp-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.val) === selectedImportance);
  });

  // 메모나 중요도 있으면 상세 자동 열기
  if (todo.memo || todo.importance > 0 || todo.remind_days > 0) {
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
  document.getElementById('input-title').value = '';
  document.getElementById('input-memo').value  = '';
  document.getElementById('input-date').value  = AppState.selectedDate;
  document.getElementById('input-remind').value = 0;
  document.getElementById('detail-toggle').checked = false;
  document.getElementById('detail-section').classList.add('hidden');
  selectedImportance = 0;
  document.querySelectorAll('.imp-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.imp-btn[data-val="0"]').classList.add('active');
}

async function handleSave() {
  const title = document.getElementById('input-title').value.trim();
  const memo  = document.getElementById('input-memo').value.trim();
  const date  = document.getElementById('input-date').value || AppState.selectedDate;
  const remind = parseInt(document.getElementById('input-remind').value) || 0;

  // 제목 없어도 저장 (기획 요구사항)
  const data = {
    title,
    memo,
    importance: selectedImportance,
    date,
    remind_days: remind,
  };

  try {
    if (AppState.editingId) {
      // 수정
      await updateTodo(AppState.editingId, data);
      const idx = AppState.todos.findIndex(t => t.id === AppState.editingId);
      if (idx !== -1) AppState.todos[idx] = { ...AppState.todos[idx], ...data };
    } else {
      // 추가
      const newTodo = await insertTodo(data);

      // 선택된 날짜와 같은 날이면 목록에 즉시 추가
      if (date === AppState.selectedDate) {
        AppState.todos.unshift(newTodo);
      }

      // 상기용 복사본 추가
      if (remind > 0) {
        const remindDate = daysBeforeStr(date, remind);
        if (remindDate !== date) {
          await insertRemindCopy(newTodo, remindDate);
        }
      }
    }

    closeModal();
    renderTodos();
    updateMonthDots();
    showToast(AppState.editingId ? '수정됐어요 ✓' : '추가됐어요 ✓');
  } catch(e) {
    showToast('저장 실패. 다시 시도해주세요');
    console.error(e);
  }
}
