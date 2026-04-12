// =============================================
// weekly.js — 주간 일정 탭
// =============================================

let weekOffset = 0;
let selectedWeekDay = null;
let weekAllRows = [];
let weekImportantOnly = false;

function initWeekly() {
  document.getElementById('week-prev').addEventListener('click', () => { weekOffset--; loadWeekly(); });
  document.getElementById('week-next').addEventListener('click', () => { weekOffset++; loadWeekly(); });
  document.getElementById('week-important-btn').addEventListener('click', () => {
    weekImportantOnly = !weekImportantOnly;
    document.getElementById('week-important-btn').classList.toggle('active', weekImportantOnly);
    renderWeekAllTodos(weekAllRows, getWeekRange(weekOffset).monday);
  });
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
  const container = document.getElementById('weekly-todo-list');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    weekAllRows = await dbFetch(
      `${TABLE_NAME}?date=gte.${fromStr}&date=lte.${toStr}&order=date.asc,sort_order.asc,created_at.desc`
    ) || [];
  } catch(e) {
    container.innerHTML = '<div class="empty-state">불러오기 실패</div>';
    return;
  }

  const hasTodo = {};
  weekAllRows.forEach(r => { hasTodo[r.date] = true; });
  renderWeekDayCards(monday, hasTodo);
  renderWeekAllTodos(weekAllRows, monday);
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
    });
    row.appendChild(card);
  }
}

function renderWeekAllTodos(allRows, monday) {
  const container = document.getElementById('weekly-todo-list');
  container.innerHTML = '';

  // 중요 필터: weekly_flag 체크된 것만
  const filtered = weekImportantOnly ? allRows.filter(r => r.weekly_flag) : allRows;

  const grouped = {};
  filtered.forEach(r => {
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
    const msg = weekImportantOnly ? '주간 표시된 할일이 없어요' : '이번 주 할일이 없어요';
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓</div>${msg}</div>`;
  }
}

function makeWeekTodoItem(todo, isDone) {
  const el = document.createElement('div');
  el.className = 'week-todo-item' + (isDone ? ' done' : '');

  const bar = document.createElement('div');
  bar.className = `imp-badge imp-${todo.importance || 0}`;

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
  if (todo.weekly_flag) {
    const flag = document.createElement('span');
    flag.className = 'weekly-flag-icon';
    flag.textContent = ' ★';
    title.appendChild(flag);
  }
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

  initWeekItemGesture(el, todo);
  return el;
}

function initWeekItemGesture(el, todo) {
  let startX = 0, startY = 0, moved = false, isHorizontal = null;
  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    moved = false; isHorizontal = null; el.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (isHorizontal === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) isHorizontal = Math.abs(dx) > Math.abs(dy);
      return;
    }
    if (!isHorizontal) return;
    moved = true;
    const clampedX = Math.max(-120, Math.min(120, dx));
    el.style.transform = `translateX(${clampedX}px)`;
    if (dx > 20) el.style.background = `rgba(126,207,160,${Math.min(dx/120,0.3)})`;
    else if (dx < -20) el.style.background = `rgba(224,92,106,${Math.min(Math.abs(dx)/120,0.25)})`;
    else el.style.background = '';
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!isHorizontal || !moved) { resetWeekItemStyle(el); return; }
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 60) { resetWeekItemStyle(el); return; }
    if (dx > 0 && !todo.is_done) {
      el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      el.style.transform = 'translateX(110%)'; el.style.opacity = '0';
      setTimeout(async () => {
        try { await toggleDone(todo.id, true); loadWeekly(); }
        catch(e) { resetWeekItemStyle(el); showToast('오류가 발생했어요'); }
      }, 250);
    } else if (dx < 0) {
      resetWeekItemStyle(el);
      openActionPopup(todo.id, true);
    } else { resetWeekItemStyle(el); }
  }, { passive: true });
}

function resetWeekItemStyle(el) {
  el.style.transition = 'transform 0.2s ease, background 0.2s ease';
  el.style.transform = ''; el.style.background = '';
  setTimeout(() => { el.style.transition = ''; }, 220);
}
