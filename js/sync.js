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
      break;
    }
  }
}

// 온라인 복귀 시
async function onOnline() {
  console.log('[sync] 온라인 복귀 → queue flush');
  await flushQueue();
}

// 브라우저 닫힐 때
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
// [수정 ①] 채널 재생성 중복 실행 방지 플래그
let realtimeRestarting = false;

async function startRealtime() {
  // [수정 ①] 이미 재시작 중이면 무시 — visibilitychange 연속 호출 시 채널 충돌 방지
  if (realtimeRestarting) return;
  realtimeRestarting = true;

  try {
    const client = getSupabaseClient();

    if (realtimeChannel) {
      try {
        await client.removeChannel(realtimeChannel);
      } catch(e) {
        console.warn('[realtime] removeChannel 실패 (무시)', e);
      }
      realtimeChannel = null;
      // [수정 ①] SDK 내부 정리가 완전히 끝날 때까지 잠깐 대기
      await new Promise(r => setTimeout(r, 200));
    }

    // [수정 ①] 채널 이름에 타임스탬프를 붙여 매번 고유하게 생성
    //           → 이전 채널이 서버에서 미처 정리되지 않아도 새 채널과 충돌하지 않음
    const channelName = `ddog-changes-${Date.now()}`;

    realtimeChannel = client
      .channel(channelName)
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

        // [수정 ③] 채널이 CHANNEL_ERROR / TIMED_OUT 상태가 되면 bgSync로 즉시 폴백
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[realtime] 채널 오류 → bgSync 폴백');
          if (AppState.isOnline) {
            bgSync().catch(e => console.warn('[sync] bgSync 폴백 실패', e));
          }
        }
      });
  } finally {
    realtimeRestarting = false;
  }
}

async function handleRealtimeEvent(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    if (newRow && newRow.id) {
      await idbPut(newRow);
    }
  } else if (eventType === 'DELETE') {
    // oldRow.id가 없는 경우(RLS/REPLICA IDENTITY 문제) 방어 처리
    const deleteId = oldRow?.id;
    if (deleteId) {
      await idbDelete(deleteId);
    } else {
      // id를 못 받은 경우 → Supabase에서 전체 재동기화
      console.warn('[realtime] DELETE 이벤트에 id 없음 → 전체 재동기화');
      await fullResync();
      return;
    }
  }

  refreshCurrentTab();
  updateMonthDots();
}

// ── 전체 재동기화 (DELETE id 누락 등 비상용) ──
async function fullResync() {
  try {
    const rows = await sbFetch(`${TABLE_NAME}?order=created_at.asc`);
    if (rows) {
      await idbClear();
      if (rows.length > 0) await idbPutMany(rows);
    }
    refreshCurrentTab();
    updateMonthDots();
    console.log('[sync] 전체 재동기화 완료');
  } catch(e) {
    console.warn('[sync] 전체 재동기화 실패', e);
  }
}

// ── 앱 시작 시 호출 ──

async function initSync() {
  await getIDB();

  const idbRows = await idbGetAll();

  if (idbRows.length === 0) {
    // 로컬캐시 없음 → 전체 다운로드 (새 기기)
    await initialSync();
  } else {
    // 로컬캐시 있음 → 바로 렌더링 후 백그라운드에서 최신화
    // [수정 ②] bgSync 실패 시 콘솔 경고만 내고 조용히 넘어가던 것을
    //           실패해도 refreshCurrentTab/updateMonthDots는 반드시 호출되도록 보장
    if (AppState.isOnline) {
      bgSync().catch(e => {
        console.warn('[sync] bg sync 실패', e);
        refreshCurrentTab();
        updateMonthDots();
      });
    }
  }

  if (AppState.isOnline) {
    await flushQueue();
  }

  await startRealtime();

  // ── 포그라운드 복귀 시 재연결 (모바일 백그라운드 복귀 대응) ──
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      console.log('[sync] 포그라운드 복귀 → Realtime 재연결 + bgSync');
      // [수정 ①] startRealtime 내부에서 realtimeRestarting 플래그로 중복 실행 차단
      await startRealtime();
      if (AppState.isOnline) {
        // [수정 ②] bgSync 실패해도 화면 갱신은 반드시 수행
        bgSync().catch(e => {
          console.warn('[sync] bg sync 실패', e);
          refreshCurrentTab();
          updateMonthDots();
        });
      }
    }
  });
}

// ── 백그라운드 동기화 ──
// updated_at 변경분 + 삭제된 항목 감지를 위해 Supabase 전체 id 목록과 비교
async function bgSync() {
  const all = await idbGetAll();
  if (!all.length) return;

  // 1. updated_at 기준 변경분 가져오기
  const latest = all.reduce((max, t) => {
    const ts = t.updated_at || t.created_at || '';
    return ts > max ? ts : max;
  }, '');

  if (latest) {
    // gte(이상)로 조회 후 IDB와 실제 비교 → 경계값 누락 방지
    const updated = await sbFetch(
      `${TABLE_NAME}?updated_at=gte.${encodeURIComponent(latest)}&order=updated_at.asc`
    );
    if (updated && updated.length > 0) {
      // IDB와 실제로 다른 행만 저장 (gte 조회로 인한 중복 방지)
      const idbMap = new Map(all.map(t => [t.id, t]));
      const changed = updated.filter(r => {
        const local = idbMap.get(r.id);
        return !local || (r.updated_at > local.updated_at);
      });
      if (changed.length > 0) {
        await idbPutMany(changed);
        console.log('[sync] bg sync 변경:', changed.length, '건');
      }
    }
  }

  // 2. 삭제된 항목 감지: Supabase id 목록과 IDB id 목록 비교
  try {
    const sbIds = await sbFetch(`${TABLE_NAME}?select=id`);
    if (sbIds) {
      const sbIdSet = new Set(sbIds.map(r => r.id));
      const idbAll = await idbGetAll();
      const deletedLocally = idbAll.filter(t =>
        !String(t.id).startsWith('tmp_') && !sbIdSet.has(t.id)
      );
      if (deletedLocally.length > 0) {
        await Promise.all(deletedLocally.map(t => idbDelete(t.id)));
        console.log('[sync] bg sync 삭제 감지:', deletedLocally.length, '건');
      }
    }
  } catch(e) {
    console.warn('[sync] 삭제 감지 실패', e);
  }

  refreshCurrentTab();
  updateMonthDots();
}
