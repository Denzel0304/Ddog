// =============================================
// db.js — Supabase CRUD 함수 모음
// =============================================

// 공통 fetch 래퍼
async function dbFetch(path, options = {}) {
  const res = await fetch(`${DB.url}/rest/v1/${path}`, {
    headers: DB.headers,
    ...options
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB Error: ${res.status} ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── SELECT ──

// 특정 날짜의 할일 가져오기
async function fetchTodosByDate(dateStr) {
  return dbFetch(`${TABLE_NAME}?date=eq.${dateStr}&order=sort_order.asc,created_at.desc`);
}

// 달력 점 표시용: 해당 월의 할일 날짜 목록
async function fetchDotDatesForMonth(year, month) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to   = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const rows = await dbFetch(
    `${TABLE_NAME}?date=gte.${from}&date=lte.${to}&select=date&is_done=eq.false`
  );
  return rows.map(r => r.date);
}

// 검색
async function searchTodos(keyword) {
  // title 또는 memo에 keyword 포함
  const encoded = encodeURIComponent(keyword);
  return dbFetch(
    `${TABLE_NAME}?or=(title.ilike.*${encoded}*,memo.ilike.*${encoded}*)&order=date.desc,created_at.desc`
  );
}

// ── INSERT ──

// 할일 추가
async function insertTodo(data) {
  // sort_order: 현재 날짜 할일 중 최상단에 오도록 (음수로 내림)
  const minOrder = AppState.todos.length > 0
    ? Math.min(...AppState.todos.map(t => t.sort_order)) - 1
    : 0;

  const payload = {
    title:       data.title || '',
    memo:        data.memo  || '',
    importance:  data.importance ?? 0,
    date:        data.date  || todayStr(),
    remind_days: data.remind_days ?? 0,
    is_done:     false,
    sort_order:  minOrder,
  };
  const rows = await dbFetch(TABLE_NAME, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return rows[0];
}

// 상기용 복사본 삽입 (N일 전)
async function insertRemindCopy(original, remindDate) {
  const payload = {
    title:      `🔔 ${original.title}`,
    memo:       original.memo || '',
    importance: original.importance,
    date:       remindDate,
    remind_days: 0,
    is_done:    false,
    sort_order: 0,
  };
  return dbFetch(TABLE_NAME, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// ── UPDATE ──

// 할일 수정
async function updateTodo(id, data) {
  return dbFetch(`${TABLE_NAME}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

// 완료 토글
async function toggleDone(id, isDone) {
  return updateTodo(id, {
    is_done: isDone,
    done_at: isDone ? new Date().toISOString() : null
  });
}

// 날짜 변경
async function moveTodoDate(id, newDate) {
  return updateTodo(id, { date: newDate, sort_order: 0 });
}

// sort_order 일괄 업데이트 (드래그 정렬 후)
async function updateSortOrders(todos) {
  const promises = todos.map((t, i) =>
    updateTodo(t.id, { sort_order: i })
  );
  return Promise.all(promises);
}

// ── DELETE ──

async function deleteTodo(id) {
  return dbFetch(`${TABLE_NAME}?id=eq.${id}`, {
    method: 'DELETE'
  });
}
