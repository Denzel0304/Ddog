// =============================================
// db.js — 로컬캐시(IDB) 우선 CRUD
// 읽기: IDB에서 즉시
// 쓰기: IDB에 즉시 반영 + Supabase 백그라운드 push
// 오프라인: pending queue에 저장 후 나중에 flush
// =============================================

// ── Supabase push (백그라운드) ──

async function sbPush(path, method, body) {
  if (AppState.isOnline) {
    try {
      const res = await fetch(`${DB.url}/rest/v1/${path}`, {
        method,
        headers: DB.headers,
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) throw new Error(await res.text());
      if (res.status === 204) return null;
      return res.json();
    } catch(e) {
      // 네트워크 실패 → queue에 저장
      console.warn('[db] push 실패, queue에 저장:', e);
      await queuePush({ path, method, body });
      return null;
    }
  } else {
    // 오프라인 → queue에 저장
    await queuePush({ path, method, body });
    return null;
  }
}

// ── SELECT (IDB에서 읽기) ──

async function fetchTodosByDate(dateStr) {
  const all = await idbGetAll();
  return all
    .filter(t => t.date === dateStr)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
    });
}

async function fetchDotDatesForMonth(year, month) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  const all = await idbGetAll();
  return all
    .filter(t => t.date >= from && t.date <= to && !t.is_done)
    .map(t => t.date);
}

async function searchTodos(keyword) {
  const all = await idbGetAll();
  const kw = keyword.toLowerCase();
  return all
    .filter(t =>
      (t.title || '').toLowerCase().includes(kw) ||
      (t.memo  || '').toLowerCase().includes(kw)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return b.date > a.date ? 1 : -1;
      return (b.created_at || '') > (a.created_at || '') ? 1 : -1;
    });
}

// ── INSERT ──

async function insertTodo(data) {
  const minOrder = AppState.todos.length > 0
    ? Math.min(...AppState.todos.map(t => t.sort_order)) - 1
    : 0;

  const now = new Date().toISOString();
  const tempId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  const payload = {
    title:            data.title || '',
    memo:             data.memo  || '',
    importance:       data.importance ?? 0,
    date:             data.date  || todayStr(),
    remind_days:      data.remind_days ?? 0,
    weekly_flag:      data.weekly_flag ?? false,
    is_done:          false,
    sort_order:       minOrder,
    repeat_type:      data.repeat_type     || 'none',
    repeat_interval:  data.repeat_interval || 1,
    repeat_day:       data.repeat_day      || null,
    repeat_end_date:  data.repeat_end_date || null,
    repeat_meta:      data.repeat_meta     || null,
    repeat_master_id: null,
    repeat_exception: false,
    created_at:       now,
    updated_at:       now,
  };

  if (AppState.isOnline) {
    try {
      // Supabase에 저장해서 실제 id 받아오기
      const res = await fetch(`${DB.url}/rest/v1/${TABLE_NAME}`, {
        method: 'POST',
        headers: DB.headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      const saved = rows[0];
      await idbPut(saved);
      return saved;
    } catch(e) {
      console.warn('[db] insert 실패, 임시 id로 로컬 저장:', e);
    }
  }

  // 오프라인 or 실패 → 임시 id로 IDB 저장 + queue
  const localTodo = { ...payload, id: tempId };
  await idbPut(localTodo);
  await queuePush({ path: TABLE_NAME, method: 'POST', body: payload });
  return localTodo;
}

async function insertRemindCopy(original, remindDate, dateLabel) {
  const titleSuffix = dateLabel ? `(${dateLabel})` : '';
  const now = new Date().toISOString();
  const payload = {
    title:       `🔔 ${original.title}${titleSuffix}`,
    memo:        original.memo || '',
    importance:  original.importance,
    date:        remindDate,
    remind_days: 0,
    is_done:     false,
    sort_order:  0,
    created_at:  now,
    updated_at:  now,
  };

  if (AppState.isOnline) {
    try {
      const res = await fetch(`${DB.url}/rest/v1/${TABLE_NAME}`, {
        method: 'POST',
        headers: DB.headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const rows = await res.json();
        await idbPut(rows[0]);
        return rows[0];
      }
    } catch(e) {}
  }

  const tempId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const localTodo = { ...payload, id: tempId };
  await idbPut(localTodo);
  await queuePush({ path: TABLE_NAME, method: 'POST', body: payload });
  return localTodo;
}

// ── UPDATE ──

async function updateTodo(id, data) {
  const now = new Date().toISOString();
  const patch = { ...data, updated_at: now };

  // IDB 즉시 반영
  const existing = await idbGet(id);
  if (existing) {
    await idbPut({ ...existing, ...patch });
  }

  // Supabase 백그라운드
  const isTmp = String(id).startsWith('tmp_');
  if (!isTmp) {
    await sbPush(`${TABLE_NAME}?id=eq.${id}`, 'PATCH', patch);
  }
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
  await idbDelete(id);
  const isTmp = String(id).startsWith('tmp_');
  if (!isTmp) {
    await sbPush(`${TABLE_NAME}?id=eq.${id}`, 'DELETE', null);
  }
}

// ── 반복 관련 ──

async function fetchRepeatMasters(dateStr) {
  try {
    const all = await idbGetAll();
    return all.filter(t =>
      t.repeat_type && t.repeat_type !== 'none' &&
      t.date <= dateStr &&
      !t.repeat_master_id &&
      !t.repeat_exception
    );
  } catch(e) { return []; }
}

async function fetchRepeatExceptions(dateStr) {
  try {
    const all = await idbGetAll();
    return all.filter(t => t.date === dateStr && t.repeat_exception === true);
  } catch(e) { return []; }
}

async function insertRepeatException(masterId, dateStr, isDone = false) {
  const master = AppState.todos.find(t => t.id === masterId || t._masterId === masterId);
  const now = new Date().toISOString();
  const payload = {
    title:            master?.title || '',
    memo:             master?.memo  || '',
    importance:       master?.importance || 0,
    date:             dateStr,
    remind_days:      0,
    is_done:          isDone,
    done_at:          isDone ? now : null,
    sort_order:       0,
    repeat_type:      'none',
    repeat_master_id: masterId,
    repeat_exception: true,
    created_at:       now,
    updated_at:       now,
  };

  if (AppState.isOnline) {
    try {
      const res = await fetch(`${DB.url}/rest/v1/${TABLE_NAME}`, {
        method: 'POST',
        headers: DB.headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const rows = await res.json();
        await idbPut(rows[0]);
        return rows[0];
      }
    } catch(e) {}
  }

  const tempId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const localTodo = { ...payload, id: tempId };
  await idbPut(localTodo);
  await queuePush({ path: TABLE_NAME, method: 'POST', body: payload });
  return localTodo;
}
