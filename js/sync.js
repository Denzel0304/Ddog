// =============================================
// sync.js — 로컬캐시(IndexedDB) + 동기화 엔진
// =============================================

const IDB_NAME    = 'ddog-cache';
const IDB_VERSION = 1;
const STORE_TODOS = 'todos';
const STORE_QUEUE = 'pending_queue';

let idb = null;

// ── IndexedDB 초기화 ──
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_TODOS)) {
        db.createObjectStore(STORE_TODOS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const qs = db.createObjectStore(STORE_QUEUE, { keyPath: 'qid', autoIncrement: true });
        qs.createIndex('by_time', 'ts');
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function getIDB() {
  if (!idb) idb = await openIDB();
  return idb;
}

// ── IDB CRUD helpers ──

async function idbGetAll() {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readonly');
    const req = tx.objectStore(STORE_TODOS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(id) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readonly');
    const req = tx.objectStore(STORE_TODOS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(todo) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readwrite');
    const req = tx.objectStore(STORE_TODOS).put(todo);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbPutMany(todos) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_TODOS, 'readwrite');
    const store = tx.objectStore(STORE_TODOS);
    todos.forEach(t => store.put(t));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbDelete(id) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readwrite');
    const req = tx.objectStore(STORE_TODOS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbClear() {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readwrite');
    const req = tx.objectStore(STORE_TODOS).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Pending Queue ──

async function queuePush(op) {
  // op: { method: 'POST'|'PATCH'|'DELETE', path: string, body?: object, ts: number }
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_QUEUE, 'readwrite');
    const req = tx.objectStore(STORE_QUEUE).add({ ...op, ts: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function queueGetAll() {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function queueDelete(qid) {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_QUEUE, 'readwrite');
    const req = tx.objectStore(STORE_QUEUE).delete(qid);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Supabase direct fetch (sync 엔진 내부용) ──

async function sbFetch(path, options = {}) {
  const res = await fetch(`${DB.url}/rest/v1/${path}`, {
    headers: DB.headers,
    ...options
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SB Error: ${res.status} ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── 초기 동기화: Supabase → IDB ──

async function initialSync() {
  try {
    const rows = await sbFetch(`${TABLE_NAME}?order=created_at.asc`);
    if (rows && rows.length > 0) {
      await idbClear();
      await idbPutMany(rows);
    }
    console.log('[sync] 초기 동기화 완료:', rows?.length, '건');
  } catch(e) {
    console.warn('[sync] 초기 동기화 실패 (오프라인?)', e);
  }
}

// ── Pending Queue flush ──

async function flushQueue() {
  const ops = await queueGetAll();
  if (!ops.length) return;
  console.log('[sync] queue flush:', ops.length, '건');

  for (const op of ops) {
    try {
      await sbFetch(op.path, {
        method: op.method,
        body: op.body ? JSON.stringify(op.body) : undefined
      });
      await queueDelete(op.qid);
    } catch(e) {
      console.warn('[sync] flush 실패, 다음에 재시도:', e);
      break; // 순서 보장을 위해 실패 시 중단
    }
  }
}

// 온라인 복귀 시
async function onOnline() {
  console.log('[sync] 온라인 복귀 → queue flush');
  await flushQueue();
}

// 브라우저 닫힐 때 — sendBeacon으로 최대한 전송
window.addEventListener('beforeunload', async () => {
  const ops = await queueGetAll().catch(() => []);
  ops.forEach(op => {
    try {
      const url  = `${DB.url}/rest/v1/${op.path}`;
      const blob = new Blob(
        [op.body ? JSON.stringify(op.body) : ''],
        { type: 'application/json' }
      );
      navigator.sendBeacon(url, blob);
    } catch(e) {}
  });
});

// ── Realtime 구독 ──

let realtimeChannel = null;

function startRealtime() {
  const client = getSupabaseClient();
  if (realtimeChannel) {
    client.removeChannel(realtimeChannel);
  }

  realtimeChannel = client
    .channel('ddog-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE_NAME },
      async payload => {
        console.log('[realtime]', payload.eventType, payload);
        await handleRealtimeEvent(payload);
      }
    )
    .subscribe(status => {
      console.log('[realtime] status:', status);
    });
}

async function handleRealtimeEvent(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    await idbPut(newRow);
  } else if (eventType === 'DELETE') {
    await idbDelete(oldRow.id);
  }

  // 현재 화면에 영향 있는 변경이면 UI 갱신
  refreshCurrentTab();
  updateMonthDots();
}

// ── 앱 시작 시 호출 ──

async function initSync() {
  await getIDB(); // IDB 열기

  const idbRows = await idbGetAll();

  if (idbRows.length === 0) {
    // 로컬캐시 없음 → 전체 다운로드 (새 기기)
    await initialSync();
  } else {
    // 로컬캐시 있음 → 바로 렌더링 후 백그라운드에서 최신화
    if (AppState.isOnline) {
      // 백그라운드 동기화: updated_at 기준으로 변경분만 가져오기
      bgSync().catch(e => console.warn('[sync] bg sync 실패', e));
    }
  }

  // pending queue 있으면 flush
  if (AppState.isOnline) {
    await flushQueue();
  }

  // Realtime 구독 시작
  startRealtime();
}

// 백그라운드 동기화 — 마지막 updated_at 이후 변경분만 가져오기
async function bgSync() {
  const all = await idbGetAll();
  if (!all.length) return;

  // IDB에서 가장 최근 updated_at 찾기
  const latest = all.reduce((max, t) => {
    const ts = t.updated_at || t.created_at || '';
    return ts > max ? ts : max;
  }, '');

  if (!latest) return;

  const rows = await sbFetch(
    `${TABLE_NAME}?updated_at=gt.${encodeURIComponent(latest)}&order=updated_at.asc`
  );

  if (rows && rows.length > 0) {
    await idbPutMany(rows);
    console.log('[sync] bg sync:', rows.length, '건 업데이트');
    refreshCurrentTab();
    updateMonthDots();
  }
}
