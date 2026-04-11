// =============================================
// weekly.js — 주간 일정 탭
// =============================================

// 주간 오프셋 (0 = 다음주, 1 = 다다음주, -1 = 지난주 ...)
let weekOffset = 0;

function initWeekly() {
  document.getElementById('week-prev').addEventListener('click', () => { weekOffset--; loadWeekly(); });
  document.getElementById('week-next').addEventListener('click', () => { weekOffset++; loadWeekly(); });
}

// 오늘 기준 다음주 월~일 계산
function getWeekRange(offset) {
  const today = new Date();
  const dow = today.getDay(); // 0=일, 1=월 ...
  // 이번주 월요일
  const diffToMon = (dow === 0) ? -6 : 1 - dow;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + diffToMon);

  // offset 0 = 다음주 월요일
  const monday = new Date(thisMonday);
  monday.setDate(thisMonday.getDate() + 7 * (offset + 1));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { monday, sunday };
}

function formatWeekLabel(monday, sunday) {
  const fmt = d => `${d.getMonth()+1}월 ${d.getDate()}일`;
  return `${monday.getFullYear()}년 ${fmt(monday)} ~ ${fmt(sunday)}`;
}

async function loadWeekly() {
  const { monday, sunday } = getWeekRange(weekOffset);

  // 헤더 라벨
  document.getElementById('week-label').textContent = formatWeekLabel(monday, sunday);

  const container = document.getElementById('weekly-list');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const fromStr = toLocalDateStr(monday);
    const toStr   = toLocalDateStr(sunday);

    // 해당 주 전체 할일 조회
    const rows = await dbFetch(
      `${TABLE_NAME}?date=gte.${fromStr}&date=lte.${toStr}&order=date.asc,sort_order.asc,created_at.desc`
    );

    renderWeekly(rows || [], monday);
  } catch(e) {
    container.innerHTML = '<div class="empty-state">불러오기 실패</div>';
    console.error(e);
  }
}

function renderWeekly(rows, monday) {
  const container = document.getElementById('weekly-list');
  container.innerHTML = '';

  // 날짜별 그룹핑
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });

  // 월~일 순서로 날짜 있는 것만 표시
  let hasAny = false;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toLocalDateStr(d);
    const dayTodos = grouped[dateStr];
    if (!dayTodos || dayTodos.length === 0) continue;

    hasAny = true;

    // 날짜 헤더
    const header = document.createElement('div');
    header.className = 'week-date-header';
    const dow = d.getDay();
    const days = ['일','월','화','수','목','금','토'];
    header.textContent = `${d.getMonth()+1}월 ${d.getDate()}일 (${days[dow]})`;
    if (dow === 0) header.classList.add('week-sun');
    if (dow === 6) header.classList.add('week-sat');
    container.appendChild(header);

    // 해당 날짜 할일들
    const active = dayTodos.filter(t => !t.is_done);
    const done   = dayTodos.filter(t => t.is_done);

    active.forEach(todo => container.appendChild(makeWeekItem(todo)));

    if (done.length > 0) {
      const div = document.createElement('div');
      div.className = 'week-done-divider';
      div.textContent = '완료';
      container.appendChild(div);
      done.forEach(todo => container.appendChild(makeWeekItem(todo, true)));
    }
  }

  if (!hasAny) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🗓</div>이번 주 할일이 없어요</div>';
  }
}

function makeWeekItem(todo, isDone = false) {
  const el = document.createElement('div');
  el.className = 'week-item' + (isDone ? ' done' : '');

  // 중요도 바
  const bar = document.createElement('div');
  bar.className = `imp-badge imp-${todo.importance}`;

  // 체크
  const check = document.createElement('div');
  check.className = 'todo-check' + (isDone ? ' checked' : '');

  // 텍스트
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

  // 클릭 → 할일 탭으로 이동 (오늘 날짜 초기화)
  el.addEventListener('click', () => {
    weekOffset = 0;
    switchTab('todo');
    // 오늘 날짜로 초기화
    AppState.selectedDate = todayStr();
    AppState.calYear  = new Date().getFullYear();
    AppState.calMonth = new Date().getMonth() + 1;
    renderCalendar();
    loadTodos();
  });

  return el;
}
