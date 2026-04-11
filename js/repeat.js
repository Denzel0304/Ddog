// =============================================
// repeat.js — 반복 설정 모달 & 반복 계산
// =============================================

// 현재 반복 설정 상태
let repeatConfig = {
  type: 'none',      // 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: 1,       // 매 N일/주/월
  day: null,         // 매월 N일 (monthly)
  endDate: null,     // 종료일
};

function initRepeat() {
  document.getElementById('repeat-btn').addEventListener('click', openRepeatModal);
  document.getElementById('repeat-modal-close').addEventListener('click', closeRepeatModal);
  document.getElementById('repeat-overlay').addEventListener('click', e => {
    if (e.target.id === 'repeat-overlay') closeRepeatModal();
  });
  document.getElementById('repeat-cancel-btn').addEventListener('click', () => {
    resetRepeat();
    closeRepeatModal();
  });
  document.getElementById('repeat-confirm-btn').addEventListener('click', confirmRepeat);

  // 반복 타입 버튼
  document.querySelectorAll('.rtype-btn').forEach(btn => {
    btn.addEventListener('click', () => selectRepeatType(btn.dataset.type));
  });

  // 종료일 토글
  document.getElementById('repeat-end-toggle').addEventListener('change', e => {
    document.getElementById('repeat-end-date-wrap').classList.toggle('hidden', !e.target.checked);
  });
}

function openRepeatModal() {
  // 현재 날짜 기준 초기값
  const baseDate = document.getElementById('input-date').value || getDefaultDate();
  const d = new Date(baseDate + 'T00:00:00');

  // monthly 기본값: 현재 날짜의 일
  document.getElementById('repeat-monthly-day').value = d.getDate();
  document.getElementById('repeat-custom-interval').value = repeatConfig.interval || 1;
  document.getElementById('repeat-end-date').value = repeatConfig.endDate || '';
  document.getElementById('repeat-end-toggle').checked = !!repeatConfig.endDate;
  document.getElementById('repeat-end-date-wrap').classList.toggle('hidden', !repeatConfig.endDate);

  selectRepeatType(repeatConfig.type || 'none');
  document.getElementById('repeat-overlay').classList.remove('hidden');
}

function closeRepeatModal() {
  document.getElementById('repeat-overlay').classList.add('hidden');
}

function selectRepeatType(type) {
  document.querySelectorAll('.rtype-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.rtype-btn[data-type="${type}"]`);
  if (btn) btn.classList.add('active');

  // 커스텀 옵션 표시
  document.getElementById('repeat-custom-wrap').classList.toggle('hidden', type !== 'custom');
  document.getElementById('repeat-monthly-wrap').classList.toggle('hidden', type !== 'monthly');

  repeatConfig.type = type;
}

function confirmRepeat() {
  const type = repeatConfig.type;
  if (type === 'none') {
    resetRepeat();
    closeRepeatModal();
    updateRepeatBtn();
    return;
  }

  if (type === 'monthly') {
    repeatConfig.day = parseInt(document.getElementById('repeat-monthly-day').value) || 1;
  }
  if (type === 'custom') {
    repeatConfig.interval = parseInt(document.getElementById('repeat-custom-interval').value) || 1;
  }
  if (document.getElementById('repeat-end-toggle').checked) {
    repeatConfig.endDate = document.getElementById('repeat-end-date').value || null;
  } else {
    repeatConfig.endDate = null;
  }

  closeRepeatModal();
  updateRepeatBtn();
}

function resetRepeat() {
  repeatConfig = { type: 'none', interval: 1, day: null, endDate: null };
  updateRepeatBtn();
}

function updateRepeatBtn() {
  const btn = document.getElementById('repeat-btn');
  const isSet = repeatConfig.type !== 'none';
  btn.classList.toggle('active', isSet);
  btn.title = isSet ? getRepeatLabel() : '반복 설정';
}

function getRepeatLabel() {
  switch(repeatConfig.type) {
    case 'daily':   return `매일`;
    case 'weekly':  return `매주`;
    case 'monthly': return `매월 ${repeatConfig.day}일`;
    case 'custom':  return `매 ${repeatConfig.interval}일마다`;
    default: return '';
  }
}

// ── 반복 날짜 계산 (마스터 행 기준으로 해당 날짜 해당되는지) ──
function isRepeatMatch(todo, dateStr) {
  if (!todo.repeat_type || todo.repeat_type === 'none') return false;
  if (todo.repeat_master_id) return false; // 예외 행은 직접 조회됨

  const base = new Date(todo.date + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');

  // 기준일 이전이면 해당 없음
  if (target < base) return false;
  // 종료일 이후이면 해당 없음
  if (todo.repeat_end_date) {
    const end = new Date(todo.repeat_end_date + 'T00:00:00');
    if (target > end) return false;
  }

  const diffDays = Math.round((target - base) / 86400000);

  switch(todo.repeat_type) {
    case 'daily':
      return diffDays % (todo.repeat_interval || 1) === 0;
    case 'weekly':
      return diffDays % 7 === 0;
    case 'monthly': {
      const targetDay = target.getDate();
      return targetDay === (todo.repeat_day || base.getDate());
    }
    case 'custom':
      return diffDays % (todo.repeat_interval || 1) === 0;
    default:
      return false;
  }
}
