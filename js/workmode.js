// =============================================
// workmode.js — 일반 / 업무 모드 전환
// - 데이터 분리: config.js(TABLE_NAME) + sync.js(IDB_NAME)가 APP_MODE에 따라 결정
// - 이 파일: 업무 탭 동작, 모드 전환(새로고침), 전환 후 목적지 이동,
//            검색용 다른 모드 데이터 조회, 업무 모드 표시용 스타일
// =============================================

const MODE_TARGET_KEY = 'ddog_mode_target';

// ── 업무 모드 표시 ──
if (APP_MODE === 'work') document.body.classList.add('mode-work');

(function injectWorkModeStyle() {
  const css = `
    /* 업무 모드: '할일' 대신 '업무' 탭을 활성 표시 */
    body.mode-work #nav-todo.active { color: var(--text-muted); border-bottom-color: transparent; background: none; }
    body.mode-work #nav-todo.active + #nav-work { color: var(--accent); }
    body.mode-work #nav-todo.active + #nav-work.pc-nav-btn { border-bottom-color: var(--accent); background: var(--accent-glow); }
    /* 업무 모드에는 주간·창고가 없으므로 입력창의 주간/창고 체크 숨김 */
    body.mode-work #weekly-flag-label,
    body.mode-work #storage-flag-label { display: none !important; }
    /* 날짜줄 '업무' 표시 */
    body.mode-work #selected-date-label::before {
      content: '업무'; display: inline-block; vertical-align: middle;
      font-size: 11px; font-weight: 700; line-height: 1.5;
      padding: 0 7px; margin-right: 6px; border-radius: 6px;
      background: var(--accent); color: #1a1a2e;
    }
    /* 검색 결과 '업무' 표시 */
    .s-mode-badge {
      display: inline-block; font-size: 10px; font-weight: 700; line-height: 1.5;
      padding: 0 6px; margin-right: 6px; border-radius: 5px;
      background: var(--accent-glow); color: var(--accent);
    }
  `;
  const style = document.createElement('style');
  style.id = 'workmode-style';
  style.textContent = css;
  document.head.appendChild(style);
})();

// ── 탭 클릭 가로채기 (기존 탭 핸들러보다 먼저 실행되도록 capture 단계) ──
//  - '업무' 탭: 일반 모드면 업무로 전환 / 업무 모드면 업무 할일 화면으로
//  - 업무 모드에서 '할일': 일반 모드로 전환
//  - 업무 모드에서 '주간'·'창고': 일반 모드로 전환 후 해당 탭 열기
//  - 검색·설정은 그대로 (업무 모드에서도 사용)
document.addEventListener('click', e => {
  const btn = e.target && e.target.closest ? e.target.closest('.nav-btn') : null;
  if (!btn) return;

  if (btn.id === 'nav-work') {
    e.preventDefault(); e.stopPropagation();
    if (APP_MODE !== 'work') switchAppMode('work');
    else if (currentTab !== 'todo') switchTab('todo');
    return;
  }

  if (APP_MODE !== 'work') return;
  const tab = btn.dataset.tab;
  if (tab === 'todo') {
    e.preventDefault(); e.stopPropagation();
    switchAppMode('personal');
  } else if (tab === 'weekly' || tab === 'storage') {
    e.preventDefault(); e.stopPropagation();
    switchAppMode('personal', { tab });
  }
}, true);

// ── 모드 전환 ──
// 메모리 상태(AppState, 실시간 채널, 타이머 등)가 섞이지 않도록 새로고침으로 전환.
// target: 전환 후 이동할 곳 { tab: 'todo'|'weekly'|'storage', date?: 'YYYY-MM-DD' }
let _modeSwitching = false;

async function switchAppMode(mode, target) {
  if (_modeSwitching) return;
  _modeSwitching = true;

  // 현재 모드의 미전송 변경분을 가능한 한 먼저 서버로 (최대 1.5초)
  try {
    if (AppState.isOnline && typeof flushQueue === 'function') {
      await Promise.race([flushQueue(), new Promise(r => setTimeout(r, 1500))]);
    }
  } catch (e) {}

  try {
    sessionStorage.setItem('ddog_mode', mode === 'work' ? 'work' : 'personal');
    if (target) sessionStorage.setItem(MODE_TARGET_KEY, JSON.stringify(target));
    else sessionStorage.removeItem(MODE_TARGET_KEY);
  } catch (e) {}

  // 뒤로가기 기록이 쌓이지 않도록: 'app' 기록에서 한 칸 뒤('base')로 간 뒤 새로고침
  // (새로고침 후 initBackButton이 base/app 기록을 다시 만듦)
  if (history.state && history.state.page === 'app') {
    try { currentTab = 'todo'; } catch (e) {}
    window.addEventListener('popstate', ev => {
      ev.stopImmediatePropagation();
      location.reload();
    }, { capture: true, once: true });
    setTimeout(() => location.reload(), 800);   // 만일을 위한 대비
    history.back();
  } else {
    location.reload();
  }
}

// ── 전환 직후 목적지 적용 (app.js bootApp에서 호출) ──
function applyModeTarget() {
  let t = null;
  try {
    t = JSON.parse(sessionStorage.getItem(MODE_TARGET_KEY) || 'null');
    sessionStorage.removeItem(MODE_TARGET_KEY);
  } catch (e) { t = null; }
  if (!t) return;
  try {
    if (t.tab && t.tab !== 'todo' && document.getElementById(`tab-${t.tab}`)) {
      switchTab(t.tab);
    } else if (t.date) {
      selectDate(t.date);
    }
  } catch (e) {
    console.warn('[workmode] 목적지 이동 실패', e);
  }
}

// ── 검색: 다른 모드 데이터 조회 ──
// 다른 모드의 로컬DB(읽기 전용) + 온라인이면 서버 검색으로 최신화
const _OTHER_MODE = APP_MODE === 'work'
  ? { mode: 'personal', table: 'ddog',      idb: 'ddog-cache' }
  : { mode: 'work',     table: 'ddog_work', idb: 'ddog-cache-work' };

let _otherIdbPromise = null;

function _openOtherIDB() {
  if (_otherIdbPromise) return _otherIdbPromise;
  _otherIdbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(_OTHER_MODE.idb, IDB_VERSION);
    // 처음 만들어지는 경우 sync.js와 완전히 같은 구조로 생성 (나중에 그 모드가 정상적으로 열리도록)
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
    req.onerror   = e => { _otherIdbPromise = null; reject(e.target.error); };
  });
  return _otherIdbPromise;
}

async function _otherIdbGetAll() {
  const db = await _openOtherIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_TODOS, 'readonly');
    const req = tx.objectStore(STORE_TODOS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function _otherServerSearch(keyword) {
  if (!AppState.isOnline) return null;
  const v = encodeURIComponent('*' + keyword + '*');
  try {
    const all = Promise.all([
      sbFetch(`${_OTHER_MODE.table}?title=ilike.${v}`, { signal: _timeoutSignal(3000) }),
      sbFetch(`${_OTHER_MODE.table}?memo=ilike.${v}`,  { signal: _timeoutSignal(3000) }),
    ]);
    const [a, b] = await Promise.race([
      all,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    return [...(a || []), ...(b || [])];
  } catch (e) {
    console.warn('[workmode] 다른 모드 서버 검색 실패 → 기기 데이터 사용', e);
    return null;
  }
}

async function searchOtherModeTodos(keyword) {
  const kw = (keyword || '').toLowerCase();
  if (!kw) return [];

  let local = [];
  try { local = await _otherIdbGetAll(); } catch (e) {}

  const server = await _otherServerSearch(keyword);

  let pool;
  if (Array.isArray(server)) {
    // 서버 결과 기준. 단, 기기에 더 최신 수정이 있으면 기기 것 사용 + 아직 서버에 없는 tmp 행 포함
    const toTime = v => (v ? (Date.parse(v) || 0) : 0);
    const localMap = new Map(local.map(t => [String(t.id), t]));
    const merged = new Map();
    server.forEach(r => {
      const l = localMap.get(String(r.id));
      merged.set(String(r.id), (l && toTime(l.updated_at) > toTime(r.updated_at)) ? l : r);
    });
    local.forEach(t => {
      if (String(t.id).startsWith('tmp_')) merged.set(String(t.id), t);
    });
    pool = [...merged.values()];
  } else {
    pool = local;
  }

  // db.js searchTodos와 같은 기준으로 거르기
  const mastersWithException = new Set(
    [...local, ...pool]
      .filter(t => t.repeat_exception === true)
      .map(t => String(t.repeat_master_id))
  );

  return pool
    .filter(t => {
      const matches =
        (t.title || '').toLowerCase().includes(kw) ||
        (t.memo  || '').toLowerCase().includes(kw);
      if (!matches) return false;
      if (t.repeat_deleted) return false;
      const isMaster =
        t.repeat_type && t.repeat_type !== 'none' &&
        !t.repeat_master_id &&
        !t.repeat_exception;
      if (isMaster && mastersWithException.has(String(t.id))) return false;
      return true;
    })
    .map(t => ({ ...t, _mode: _OTHER_MODE.mode }));
}
