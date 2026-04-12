// =============================================
// db.js — Supabase CRUD 함수 모음
// =============================================

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

async function fetchTodosByDate(dateStr) {
  return dbFetch(`${TABLE_NAME}?date=eq.${dateStr}&order=sort_order.asc,created_at.desc`);
}

async function fetchDotDatesForMonth(year, month) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const rows = await dbFetch(`${TABLE_NAME}?date=gte.${from}&date=lte.${to}&is_done=eq.false&select=date`);
  return (rows || []).map(r => r.date);
}

async function searchTodos(keyword) {
  const encoded = encodeURIComponent(keyword);
  return dbFetch(`${TABLE_NAME}?or=(title.ilike.*${encoded}*,memo.ilike.*${encoded}*)&order=date.desc,created_at.desc`);
}

// ── INSERT ──

async function insertTodo(data) {
  const minOrder = AppState.todos.length > 0
    ? Math.min(...AppState.todos.map(t => t.sort_order)) - 1
    : 0;
  const payload = {
    title:           data.title || '',
    memo:            data.memo  || '',
    importance:      data.importance ?? 0,
    date:            data.date  || todayStr(),
    remind_days:     data.remind_days ?? 0,
    weekly_flag:     data.weekly_flag ?? false,
    is_done:         false,
    sort_order:      minOrder,
    repeat_type:     data.repeat_type     || 'none',
    repeat_interval: data.repeat_interval || 1,
    repeat_day:      data.repeat_day      || null,
    repeat_end_date: data.repeat_end_date || null,
    repeat_meta:     data.repeat_meta     || null,
    repeat_master_id: null,
    repeat_exception: false,
  };
  const rows = await dbFetch(TABLE_NAME, { method: 'POST', body: JSON.stringify(payload) });
  return rows[0];
}

async function insertRemindCopy(original, remindDate, dateLabel) {
  const titleSuffix = dateLabel ? `(${dateLabel})` : '';
  const payload = {
    title:      `🔔 ${original.title}${titleSuffix}`,
    memo:       original.memo || '',
    importance: original.importance,
    date:       remindDate,
    remind_days: 0,
    is_done:    false,
    sort_order: 0,
  };
  return dbFetch(TABLE_NAME, { method: 'POST', body: JSON.stringify(payload) });
}

// ── UPDATE ──

async function updateTodo(id, data) {
  return dbFetch(`${TABLE_NAME}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

async function toggleDone(id, isDone) {
  return updateTodo(id, {
    is_done: isDone,
    done_at: isDone ? new Date().toISOString() : null
  });
}

async function moveTodoDate(id, newDate) {
  return updateTodo(id, { date: newDate, sort_order: 0 });
}

async function updateSortOrders(todos) {
  return Promise.all(todos.map((t, i) => updateTodo(t.id, { sort_order: i })));
}

// ── DELETE ──

async function deleteTodo(id) {
  return dbFetch(`${TABLE_NAME}?id=eq.${id}`, { method: 'DELETE' });
}

// ── 반복 관련 (오류 발생시 빈 배열 반환) ──

async function fetchRepeatMasters(dateStr) {
  try {
    return await dbFetch(
      `${TABLE_NAME}?repeat_type=neq.none&date=lte.${dateStr}&repeat_master_id=is.null&repeat_exception=eq.false&order=created_at.asc`
    ) || [];
  } catch(e) { return []; }
}

async function fetchRepeatExceptions(dateStr) {
  try {
    return await dbFetch(
      `${TABLE_NAME}?date=eq.${dateStr}&repeat_exception=eq.true`
    ) || [];
  } catch(e) { return []; }
}

async function insertRepeatException(masterId, dateStr, isDone = false) {
  const master = AppState.todos.find(t => t.id === masterId || t._masterId === masterId);
  const payload = {
    title:            master?.title || '',
    memo:             master?.memo  || '',
    importance:       master?.importance || 0,
    date:             dateStr,
    remind_days:      0,
    is_done:          isDone,
    done_at:          isDone ? new Date().toISOString() : null,
    sort_order:       0,
    repeat_type:      'none',
    repeat_master_id: masterId,
    repeat_exception: true,
  };
  const rows = await dbFetch(TABLE_NAME, { method: 'POST', body: JSON.stringify(payload) });
  return rows[0];
}