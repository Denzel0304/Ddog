// =============================================
// weekly.js — 주간 일정 탭
// =============================================

let weekOffset = 0;
let selectedWeekDay = null;

function initWeekly() {
  document.getElementById('week-prev').addEventListener('click', () => { weekOffset--; loadWeekly(); });
  document.getElementById('week-next').addEventListener('click', () => { weekOffset++; loadWeekly(); });
}

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

  const fmt = d => `${d.getMonth()+1}/${d.getDate()}`;
  document.getElementById('week-range-label').textContent = `${fmt(monday)} ~ ${fmt(sunday)}`;

  if (!selectedWeekDay || !isInWeek(selectedWeekDay, monday)) {
    selectedWeekDay = toLocalDateStr(monday);
  }

  const fromStr = toLocalDateStr(monday);
  const toStr   = toLocalDateStr(sunday);

  // 해당 주 전체 할일 한번에 조회
  let allRows = [];
  try {
    allRows = await dbFetch(
      `${TABLE_NAME}?date=gte.${fromStr}&date=lte.${toStr}&order=date.asc,sort_order.asc,created_at.desc`
    );
  } catch(e) { console.warn(e); }

  // 날짜별 유무 (카드 점 표시용)
  const hasTodo = {};
  allRows.forEach(r => { hasTodo[r.date] = true; });

  renderWeekDayCards(monday, hasTodo);
  renderWeekAllTodos(allRows, monday);
}

function isInWeek(dateStr, monday) {
  const d = new Date(dateStr + 'T00:00:00');
  const s = new Date(monday); s.setDate(monday.getDate() + 6);
  return d >= monday && d <= s;
}

function renderWeekDayCards(monday, hasTodo) {
  const row = document.getElementById('week-day-row');
  row.innerHTML = '';
  const dayNames = ['일','월','화','수','목','금','토'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(d);
    const dow = d.getDay();

    const card = document.createElement('div');
    card.className = 'week-day-card';
    if (dow === 6) card.classList.add('sat');
    if (dow === 0) card.classList.add('sun');
    if (dateStr === selectedWeekDay) card.classList.add('selected');
    if (hasTodo[dateStr]) card.classList.add('has-todo');

    card.innerHTML = `<span class="wdc-name">${dayNames[dow]}</span><span class="wdc-num">${d.getDate()}</span>`;

    card.addEventListener('click', () => {
      selectedWeekDay = dateStr;
      document.querySelectorAll('.week-day-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      // 해당 날짜 섹션으로 스크롤
      const section = document.getElementById(`week-section-${dateStr}`);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    row.appendChild(card);
  }
}

// 7일치 전체 목록 렌더링 (날짜별 섹션)
function renderWeekAllTodos(allRows, monday) {
  const container = document.getElementById('weekly-todo-list');
  container.innerHTML = '';

  // 날짜별 그룹핑
  const grouped = {};
  allRows.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });

  const dayNames = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  let hasAny = false;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(d);
    const dayTodos = grouped[dateStr];
    if (!dayTodos || dayTodos.length === 0) continue;

    hasAny = true;
    const dow = d.getDay();

    // 날짜 섹션 헤더
    const header = document.createElement('div');
    header.className = 'week-section-header';
    header.id = `week-section-${dateStr}`;
    if (dow === 0) header.classList.add('week-sun');
    if (dow === 6) header.classList.add('week-sat');
    header.textContent = `${d.getMonth()+1}월 ${d.getDate()}일 (${dayNames[dow]})`;
    container.appendChild(header);

    const active = dayTodos.filter(t => !t.is_done);
    const done   = dayTodos.filter(t => t.is_done);

    active.forEach(todo => container.appendChild(makeWeekTodoItem(todo, false)));

    if (done.length > 0) {
      const div = document.createElement('div');
      div.className = 'week-done-divider';
      div.textContent = '완료';
      container.appendChild(div);
      done.forEach(todo => container.appendChild(makeWeekTodoItem(todo, true)));
    }
  }

  if (!hasAny) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🗓</div>이번 주 할일이 없어요</div>';
  }
}

function makeWeekTodoItem(todo, isDone) {
  const el = document.createElement('div');
  el.className = 'week-todo-item' + (isDone ? ' done' : '');

  const bar = document.createElement('div');
  bar.className = `imp-badge imp-${todo.importance}`;

  const check = document.createElement('div');
  check.className = 'todo-check' + (isDone ? ' checked' : '');
  check.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await toggleDone(todo.id, !todo.is_done);
      loadWeekly();
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
    weekOffset = 0; selectedWeekDay = null;
    switchTab('todo');
    AppState.selectedDate = todayStr();
    AppState.calYear  = new Date().getFullYear();
    AppState.calMonth = new Date().getMonth() + 1;
    renderCalendar();
    loadTodos();
  });

  return el;
}
