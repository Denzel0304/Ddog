// =============================================
// calendar.js — 달력 렌더링 & 인터랙션
// =============================================

function initCalendar() {
  document.getElementById('cal-prev').addEventListener('click', () => moveCalMonth(-1));
  document.getElementById('cal-next').addEventListener('click', () => moveCalMonth(1));
  document.getElementById('cal-year').addEventListener('click', openYearPopup);
  document.getElementById('cal-month').addEventListener('click', openMonthPopup);

  initCalendarSwipe();

  document.getElementById('year-cancel').addEventListener('click', closeYearPopup);
  document.getElementById('year-confirm').addEventListener('click', confirmYear);
  document.getElementById('year-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmYear();
  });

  document.getElementById('month-popup').addEventListener('click', e => {
    if (e.target.id === 'month-popup') closeMonthPopup();
  });
  document.getElementById('year-popup').addEventListener('click', e => {
    if (e.target.id === 'year-popup') closeYearPopup();
  });

  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.calMonth = parseInt(btn.dataset.m);
      closeMonthPopup();
      renderCalendar();
    });
  });

  renderCalendar();
}

function moveCalMonth(dir) {
  AppState.calMonth += dir;
  if (AppState.calMonth > 12) { AppState.calMonth = 1;  AppState.calYear++; }
  if (AppState.calMonth < 1)  { AppState.calMonth = 12; AppState.calYear--; }
  animateCalendar(dir);
  updateMonthDots();
}

function animateCalendar(dir) {
  const grid = document.getElementById('calendar-grid');
  const parent = grid.parentElement;

  // 기존 그리드 스냅샷
  const oldGrid = grid.cloneNode(true);
  oldGrid.style.cssText = `position:absolute;top:${grid.offsetTop}px;left:0;width:100%;z-index:1;pointer-events:none;`;
  parent.style.position = 'relative';
  parent.style.overflow = 'hidden';
  parent.appendChild(oldGrid);

  // 새 달 렌더
  renderCalendar();

  const fromX = dir > 0 ? '100%' : '-100%';
  const toX   = dir > 0 ? '-100%' : '100%';

  grid.style.cssText = `transform:translateX(${fromX});transition:none;`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const dur = '0.28s cubic-bezier(0.4,0,0.2,1)';
      grid.style.cssText = `transform:translateX(0);transition:transform ${dur};`;
      oldGrid.style.transition = `transform ${dur}`;
      oldGrid.style.transform  = `translateX(${toX})`;
      setTimeout(() => {
        oldGrid.remove();
        grid.style.cssText = '';
        parent.style.overflow = '';
      }, 300);
    });
  });
}

function renderCalendar() {
  const { calYear, calMonth, selectedDate } = AppState;
  document.getElementById('cal-year').textContent  = calYear;
  document.getElementById('cal-month').textContent = calMonth;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const firstDay     = new Date(calYear, calMonth - 1, 1).getDay();
  const lastDate     = new Date(calYear, calMonth, 0).getDate();
  const prevLastDate = new Date(calYear, calMonth - 1, 0).getDate();
  const today        = todayStr();

  for (let i = firstDay - 1; i >= 0; i--)
    grid.appendChild(makeCalCell(prevLastDate - i, calYear, calMonth - 1, true, today, selectedDate));
  for (let d = 1; d <= lastDate; d++)
    grid.appendChild(makeCalCell(d, calYear, calMonth, false, today, selectedDate));
  const remaining = (7 - grid.children.length % 7) % 7;
  for (let d = 1; d <= remaining; d++)
    grid.appendChild(makeCalCell(d, calYear, calMonth + 1, true, today, selectedDate));

  updateSelectedDateLabel();
}

function makeCalCell(day, year, month, isOtherMonth, today, selectedDate) {
  const date    = new Date(year, month - 1, day);
  const dateStr = toLocalDateStr(date);
  const dow     = date.getDay();

  const el = document.createElement('div');
  el.className = 'cal-day';
  el.innerHTML = `<span>${day}</span>`;
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
  const [y, m] = dateStr.split('-').map(Number);
  if (y !== AppState.calYear || m !== AppState.calMonth) {
    AppState.calYear  = y;
    AppState.calMonth = m;
    renderCalendar();
  } else {
    document.querySelectorAll('.cal-day').forEach(el => {
      el.classList.toggle('selected', el.dataset.date === dateStr);
    });
    updateSelectedDateLabel();
  }
  loadTodos();
}

function updateSelectedDateLabel() {
  const d    = new Date(AppState.selectedDate + 'T00:00:00');
  const days = ['일','월','화','수','목','금','토'];
  const dow  = d.getDay();
  const label = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[dow]})`;
  const el = document.getElementById('selected-date-label');
  el.textContent = label;
  el.className = dow === 0 ? 'date-label-sun' : dow === 6 ? 'date-label-sat' : 'date-label-weekday';
}

async function updateMonthDots() {
  try {
    const dates = await fetchDotDatesForMonth(AppState.calYear, AppState.calMonth);
    AppState.dotDates = new Set(dates);
    document.querySelectorAll('.cal-day').forEach(el => {
      el.classList.toggle('has-todo', AppState.dotDates.has(el.dataset.date));
    });
  } catch(e) { console.warn('dot dates fetch failed', e); }
}

function openYearPopup() {
  document.getElementById('year-input').value = AppState.calYear;
  document.getElementById('year-popup').classList.remove('hidden');
  setTimeout(() => document.getElementById('year-input').focus(), 100);
}
function closeYearPopup() { document.getElementById('year-popup').classList.add('hidden'); }
function confirmYear() {
  const val = parseInt(document.getElementById('year-input').value);
  if (val >= 2000 && val <= 2099) {
    AppState.calYear = val;
    closeYearPopup();
    renderCalendar();
  }
}

function openMonthPopup() {
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.classList.toggle('current', parseInt(btn.dataset.m) === AppState.calMonth);
  });
  document.getElementById('month-popup').classList.remove('hidden');
}
function closeMonthPopup() { document.getElementById('month-popup').classList.add('hidden'); }

function initCalendarSwipe() {
  const calSection = document.getElementById('calendar-section');
  const todoSection = document.getElementById('todo-list-section');
  const collapseBar = document.getElementById('cal-collapse-bar');
  let startX = 0, startY = 0, movedH = false, movedV = false;

  // 콜랩스 바 클릭 → 토글
  collapseBar.addEventListener('click', () => toggleCalendar());

  // 할일 목록 위로 드래그 → 달력 접기
  todoSection.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    movedV = false;
  }, { passive: true });
  todoSection.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    if (dy < -30) movedV = true;
  }, { passive: true });
  todoSection.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy < -60) collapseCalendar();
    else if (dy > 60) expandCalendar();
  }, { passive: true });

  // 달력 영역 터치 (좌우: 월 이동, 위아래: 접기/펴기)
  calSection.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    movedH = false; movedV = false;
  }, { passive: true });

  calSection.addEventListener('touchmove', e => {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > dy && dx > 10) movedH = true;
    if (dy > dx && dy > 10) movedV = true;
  }, { passive: true });

  calSection.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (movedH && Math.abs(dx) > 50) {
      moveCalMonth(dx < 0 ? 1 : -1);
    } else if (movedV && dy < -50) {
      collapseCalendar();
    }
  }, { passive: true });

  // PC 마우스 (달력 좌우)
  let mStartX = 0, mDown = false;
  calSection.addEventListener('mousedown', e => { mStartX = e.clientX; mDown = true; });
  calSection.addEventListener('mouseup', e => {
    if (!mDown) return; mDown = false;
    const dx = e.clientX - mStartX;
    if (Math.abs(dx) > 50) moveCalMonth(dx < 0 ? 1 : -1);
  });
  calSection.addEventListener('mouseleave', () => { mDown = false; });
}

let calCollapsed = false;

function collapseCalendar() {
  if (calCollapsed) return;
  calCollapsed = true;
  const cal = document.getElementById('calendar-section');
  const grid = document.getElementById('calendar-grid');
  const header = document.getElementById('calendar-header');
  const weekdays = document.getElementById('calendar-weekdays');

  // 오늘 날짜가 포함된 행만 남기기
  const todayEl = cal.querySelector('.cal-day.today, .cal-day.selected');
  const allRows = [...grid.querySelectorAll('.cal-day')];

  // 오늘/선택된 날의 행 인덱스 (7개씩)
  let targetRowStart = 0;
  if (todayEl) {
    const idx = allRows.indexOf(todayEl);
    targetRowStart = Math.floor(idx / 7) * 7;
  }

  // 현재 주 날짜들만 남기고 나머지 숨기기
  allRows.forEach((el, i) => {
    const rowIdx = Math.floor(i / 7);
    const targetRow = Math.floor(targetRowStart / 7);
    if (rowIdx !== targetRow) {
      el.style.transition = 'opacity 0.3s, max-height 0.3s';
      el.style.opacity = '0';
      el.style.maxHeight = '0';
      el.style.overflow = 'hidden';
      el.style.padding = '0';
      el.style.margin = '0';
    }
  });

  header.style.transition = 'opacity 0.3s, max-height 0.3s';
  header.style.opacity = '0';
  header.style.maxHeight = '0';
  header.style.overflow = 'hidden';
  header.style.marginBottom = '0';

  weekdays.style.transition = 'opacity 0.3s, max-height 0.3s';
  weekdays.style.opacity = '0';
  weekdays.style.maxHeight = '0';
  weekdays.style.overflow = 'hidden';
  weekdays.style.marginBottom = '0';
}

function expandCalendar() {
  if (!calCollapsed) return;
  calCollapsed = false;
  const cal = document.getElementById('calendar-section');
  const grid = document.getElementById('calendar-grid');
  const header = document.getElementById('calendar-header');
  const weekdays = document.getElementById('calendar-weekdays');

  grid.querySelectorAll('.cal-day').forEach(el => {
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '1';
    el.style.maxHeight = '';
    el.style.overflow = '';
    el.style.padding = '';
    el.style.margin = '';
  });

  header.style.opacity = '1';
  header.style.maxHeight = '';
  header.style.overflow = '';
  header.style.marginBottom = '';

  weekdays.style.opacity = '1';
  weekdays.style.maxHeight = '';
  weekdays.style.overflow = '';
  weekdays.style.marginBottom = '';
}

function toggleCalendar() {
  if (calCollapsed) expandCalendar();
  else collapseCalendar();
}

