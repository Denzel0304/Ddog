// =============================================
// calendar.js — 달력 렌더링 & 인터랙션
// =============================================

function initCalendar() {
  document.getElementById('cal-prev').addEventListener('click', () => moveCalMonth(-1));
  document.getElementById('cal-next').addEventListener('click', () => moveCalMonth(1));
  document.getElementById('cal-year').addEventListener('click', openYearPopup);
  document.getElementById('cal-month').addEventListener('click', openMonthPopup);

  // 달력 좌우 드래그 스와이프
  initCalendarSwipe();

  // 년도 팝업
  document.getElementById('year-cancel').addEventListener('click', closeYearPopup);
  document.getElementById('year-confirm').addEventListener('click', confirmYear);
  document.getElementById('year-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmYear();
  });

  // 월 팝업 (바깥 클릭 닫기)
  document.getElementById('month-popup').addEventListener('click', e => {
    if (e.target.id === 'month-popup') closeMonthPopup();
  });
  document.getElementById('year-popup').addEventListener('click', e => {
    if (e.target.id === 'year-popup') closeYearPopup();
  });

  // 월 버튼
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.calMonth = parseInt(btn.dataset.m);
      closeMonthPopup();
      renderCalendar();
    });
  });

  renderCalendar();
}

function renderCalendar() {
  const { calYear, calMonth, selectedDate } = AppState;

  document.getElementById('cal-year').textContent  = calYear;
  document.getElementById('cal-month').textContent = calMonth;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // 이번 달 1일 요일 (0=일)
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  // 이번 달 마지막 날
  const lastDate = new Date(calYear, calMonth, 0).getDate();
  // 저번 달 마지막 날
  const prevLastDate = new Date(calYear, calMonth - 1, 0).getDate();

  const today = todayStr();

  // 이전달 날짜 채우기
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevLastDate - i;
    const cell = makeCalCell(d, calYear, calMonth - 1, true, today, selectedDate);
    grid.appendChild(cell);
  }

  // 이번달 날짜
  for (let d = 1; d <= lastDate; d++) {
    const cell = makeCalCell(d, calYear, calMonth, false, today, selectedDate);
    grid.appendChild(cell);
  }

  // 다음달 날짜 채우기 (6줄 맞춤)
  const total = grid.children.length;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remaining; d++) {
    const cell = makeCalCell(d, calYear, calMonth + 1, true, today, selectedDate);
    grid.appendChild(cell);
  }

  updateSelectedDateLabel();
  updateMonthDots();
}

function makeCalCell(day, year, month, isOtherMonth, today, selectedDate) {
  // month 보정 (0월, 13월 등)
  const date = new Date(year, month - 1, day);
  const dateStr = toLocalDateStr(date);
  const dow = date.getDay();

  const el = document.createElement('div');
  el.className = 'cal-day';
  el.textContent = day;
  el.dataset.date = dateStr;

  if (isOtherMonth) el.classList.add('other-month');
  if (dow === 0) el.classList.add('sun');
  if (dow === 6) el.classList.add('sat');
  if (dateStr === today) el.classList.add('today');
  if (dateStr === selectedDate) el.classList.add('selected');
  if (AppState.dotDates.has(dateStr)) el.classList.add('has-todo');

  el.addEventListener('click', () => selectDate(dateStr));
  return el;
}

function selectDate(dateStr) {
  AppState.selectedDate = dateStr;

  // 달력이 다른 달을 보고 있으면 해당 달로 이동
  const [y, m] = dateStr.split('-').map(Number);
  if (y !== AppState.calYear || m !== AppState.calMonth) {
    AppState.calYear  = y;
    AppState.calMonth = m;
    renderCalendar();
  } else {
    // selected 클래스만 업데이트
    document.querySelectorAll('.cal-day').forEach(el => {
      el.classList.toggle('selected', el.dataset.date === dateStr);
    });
    updateSelectedDateLabel();
  }

  loadTodos();
}

function moveCalMonth(dir) {
  AppState.calMonth += dir;
  if (AppState.calMonth > 12) { AppState.calMonth = 1;  AppState.calYear++; }
  if (AppState.calMonth < 1)  { AppState.calMonth = 12; AppState.calYear--; }
  renderCalendar();
  updateMonthDots();
}

function updateSelectedDateLabel() {
  const d = new Date(AppState.selectedDate + 'T00:00:00');
  const days = ['일','월','화','수','목','금','토'];
  const label = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  document.getElementById('selected-date-label').textContent = label;
}

// 달력에 할일 있는 날 점 표시 업데이트
async function updateMonthDots() {
  try {
    const dates = await fetchDotDatesForMonth(AppState.calYear, AppState.calMonth);
    AppState.dotDates = new Set(dates);
    document.querySelectorAll('.cal-day').forEach(el => {
      const has = AppState.dotDates.has(el.dataset.date);
      el.classList.toggle('has-todo', has);
    });
  } catch(e) {
    console.warn('dot dates fetch failed', e);
  }
}

// ── 년도 팝업 ──
function openYearPopup() {
  document.getElementById('year-input').value = AppState.calYear;
  document.getElementById('year-popup').classList.remove('hidden');
  setTimeout(() => document.getElementById('year-input').focus(), 100);
}
function closeYearPopup() {
  document.getElementById('year-popup').classList.add('hidden');
}
function confirmYear() {
  const val = parseInt(document.getElementById('year-input').value);
  if (val >= 2000 && val <= 2099) {
    AppState.calYear = val;
    closeYearPopup();
    renderCalendar();
  }
}

// ── 월 팝업 ──
function openMonthPopup() {
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.classList.toggle('current', parseInt(btn.dataset.m) === AppState.calMonth);
  });
  document.getElementById('month-popup').classList.remove('hidden');
}
function closeMonthPopup() {
  document.getElementById('month-popup').classList.add('hidden');
}

// ── 달력 스와이프 ──
function initCalendarSwipe() {
  const el = document.getElementById('calendar-section');
  let startX = 0, startY = 0;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      moveCalMonth(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}
