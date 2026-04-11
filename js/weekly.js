// =============================================
// weekly.js — 주간 일정 탭
// =============================================

let weekOffset = 0;
let selectedWeekDay = null; // 선택된 날짜 문자열

function initWeekly() {
  document.getElementById('week-prev').addEventListener('click', () => { weekOffset--; loadWeekly(); });
  document.getElementById('week-next').addEventListener('click', () => { weekOffset++; loadWeekly(); });
}

// 오늘 기준 다음주 월~일
function getWeekRange(offset) {
  const today = new Date();
  const dow = today.getDay();
  const diffToMon = (dow === 0) ? -6 : 1 - dow;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diffToMon);
  const monday = new Date(thisMonday);
  monday.setDate(thisMonday.getDate() + 7 * (offset + 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

async function loadWeekly() {
  const { monday, sunday } = getWeekRange(weekOffset);

  // 헤더 범위 라벨
  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  document.getElementById('week-range-label').textContent = `${fmt(monday)} ~ ${fmt(sunday)}`;

  // 기본 선택: 월요일
  if (!selectedWeekDay || !isInWeek(selectedWeekDay, monday)) {
    selectedWeekDay = toLocalDateStr(monday);
  }

  // 해당 주 전체 할일 미리 조회 (점 표시용)
  const fromStr = toLocalDateStr(monday);
  const toStr   = toLocalDateStr(sunday);
  let allRows = [];
  try {
    allRows = await dbFetch(
      `${TABLE_NAME}?date=gte.${fromStr}&date=lte.${toStr}&select=date,is_done`
    );
  } catch(e) { console.warn(e); }

  // 날짜별 할일 유무
  const hasTodo = {};
  allRows.forEach(r => { hasTodo[r.date] = true; });

  renderWeekDayCards(monday, hasTodo);
  loadWeekDayTodos(selectedWeekDay);
}

function isInWeek(dateStr, monday) {
  const d = new Date(dateStr + 'T00:00:00');
  const m = new Date(monday);
  const s = new Date(monday);
  s.setDate(monday.getDate() + 6);
  return d >= m && d <= s;
}

function renderWeekDayCards(monday, hasTodo) {
  const row = document.getElementById('week-day-row');
  row.innerHTML = '';
  const dayNames = ['일','월','화','수','목','금','토'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(d);
    const dow = d.getDay(); // 0=일,6=토 (월~일 순이므로 i=0→월, i=6→일)
    const actualDow = d.getDay();

    const card = document.createElement('div');
    card.className = 'week-day-card';
    if (actualDow === 6) card.classList.add('sat');
    if (actualDow === 0) card.classList.add('sun');
    if (dateStr === selectedWeekDay) card.classList.add('selected');
    if (hasTodo[dateStr]) card.classList.add('has-todo');

    card.innerHTML = `<span class="wdc-name">${dayNames[actualDow]}</span><span class="wdc-num">${d.getDate()}</span>`;

    card.addEventListener('click', () => {
      selectedWeekDay = dateStr;
      document.querySelectorAll('.week-day-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      updateWeekSelectedLabel();
      loadWeekDayTodos(dateStr);
    });

    row.appendChild(card);
  }

  updateWeekSelectedLabel();
}

function updateWeekSelectedLabel() {
  const d = new Date(selectedWeekDay + 'T00:00:00');
  const dayNames = ['일','월','화','수','목','금','토'];
  const dow = d.getDay();
  const label = `${d.getMonth()+1}/${d.getDate()} (${dayNames[dow]}) 할일`;
  const el = document.getElementById('week-selected-label');
  el.textContent = label;
  el.className = '';
  if (dow === 0) el.classList.add('week-sun');
  else if (dow === 6) el.classList.add('week-sat');
}

async function loadWeekDayTodos(dateStr) {
  const container = document.getElementById('weekly-todo-list');
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const rows = await dbFetch(
      `${TABLE_NAME}?date=eq.${dateStr}&order=sort_order.asc,created_at.desc`
    );
    renderWeekDayTodos(rows || []);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">불러오기 실패</div>';
  }
}

function renderWeekDayTodos(rows) {
  const container = document.getElementById('weekly-todo-list');
  container.innerHTML = '';

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✨</div>할일이 없어요</div>';
    return;
  }

  const active = rows.filter(t => !t.is_done);
  const done   = rows.filter(t => t.is_done);

  active.forEach(todo => container.appendChild(makeWeekTodoItem(todo, false)));

  if (done.length > 0) {
    const div = document.createElement('div');
    div.className = 'week-done-divider';
    div.textContent = '완료';
    container.appendChild(div);
    done.forEach(todo => container.appendChild(makeWeekTodoItem(todo, true)));
  }
}

function makeWeekTodoItem(todo, isDone) {
  const el = document.createElement('div');
  el.className = 'week-todo-item' + (isDone ? ' done' : '');

  const bar = document.createElement('div');
  bar.className = `imp-badge imp-${todo.importance}`;

  const check = document.createElement('div');
  check.className = 'todo-check' + (isDone ? ' checked' : '');
  check.addEventListener('click', async () => {
    try {
      await toggleDone(todo.id, !todo.is_done);
      loadWeekDayTodos(selectedWeekDay);
    } catch(e) { showToast('오류가 발생했어요'); }
  });

  const text = document.createElement('div');
  text.className = 'todo-text';
  const title = document.createElement('div');
  title.className = 'todo-title';
  title.textContent = todo.title || '(제목 없음)';
  text.appendChild(title);
  if (todo.memo) {
    const memo = document.createElement('div');
    memo.className = 'todo-memo';
    memo.textContent = todo.memo;
    text.appendChild(memo);
  }

  el.appendChild(bar);
  el.appendChild(check);
  el.appendChild(text);

  // 클릭 → 할일 탭 + 오늘 날짜
  text.addEventListener('click', () => {
    weekOffset = 0;
    selectedWeekDay = null;
    switchTab('todo');
    AppState.selectedDate = todayStr();
    AppState.calYear  = new Date().getFullYear();
    AppState.calMonth = new Date().getMonth() + 1;
    renderCalendar();
    loadTodos();
  });

  return el;
}
