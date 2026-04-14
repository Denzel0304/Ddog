// =============================================
// config.js — Supabase 설정 & 전역 상태
// =============================================

const SUPABASE_URL  = 'https://rcfayyhlgxubuakxhrxy.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZmF5eWhsZ3h1YnVha3hocnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ4MjYsImV4cCI6MjA5MTQyMDgyNn0.j7YtqXfN0zxM-35RLGcjcw47uq83etMjJbHip4td4xg';
const TABLE_NAME    = 'ddog';

// Supabase REST 클라이언트 (직접 fetch)
// 로그인 전: anon 키 사용 / 로그인 후: JWT 토큰으로 교체됨
const DB = {
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
};

// 로그인 후 JWT 토큰으로 Authorization 헤더 교체
function setAuthToken(jwt) {
  DB.headers['Authorization'] = `Bearer ${jwt}`;
}

// Supabase JS SDK 클라이언트 (Realtime용)
let supabaseClient = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseClient;
}

// ── 로그인 / 세션 관리 ──

// 로그인 처리: 이메일 + 비밀번호로 Supabase Auth에 요청
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || '로그인 실패');
  return data; // { access_token, refresh_token, expires_in, ... }
}

// 세션 저장 (localStorage)
function saveSession(session) {
  localStorage.setItem('sb_session', JSON.stringify(session));
}

// 세션 불러오기
function loadSession() {
  try {
    return JSON.parse(localStorage.getItem('sb_session'));
  } catch(e) { return null; }
}

// 세션 삭제 (로그아웃)
function clearSession() {
  localStorage.removeItem('sb_session');
}

// JWT 만료 여부 확인
function isTokenExpired(session) {
  if (!session || !session.expires_at) return true;
  // expires_at은 unix timestamp(초)
  return Date.now() / 1000 > session.expires_at - 60; // 1분 여유
}

// refresh_token으로 새 access_token 발급
async function refreshSession(session) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('세션 갱신 실패');
  return data;
}

// 앱 시작 시 세션 확인 → 유효하면 토큰 세팅 후 앱 진입, 없으면 로그인 화면 표시
async function initAuth() {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');

  let session = loadSession();

  if (session) {
    // 만료됐으면 갱신 시도
    if (isTokenExpired(session)) {
      try {
        session = await refreshSession(session);
        saveSession(session);
      } catch(e) {
        clearSession();
        session = null;
      }
    }
  }

  if (session && session.access_token) {
    // 세션 유효 → JWT로 헤더 교체 후 앱 표시
    setAuthToken(session.access_token);
    // Supabase SDK도 세션 세팅
    await getSupabaseClient().auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    loginScreen.style.display = 'none';
    app.style.display = '';
    return true;
  } else {
    // 세션 없음 → 로그인 화면 표시
    loginScreen.style.display = '';
    app.style.display = 'none';
    return false;
  }
}

// 로그인 폼 이벤트 연결
function initLoginForm() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  const btnText = document.getElementById('login-btn-text');
  const spinner = document.getElementById('login-spinner');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    btnText.textContent = '';
    spinner.style.display = 'inline-block';

    try {
      const session = await signIn(emailInput.value.trim(), passwordInput.value);
      saveSession(session);
      setAuthToken(session.access_token);
      await getSupabaseClient().auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      // 앱 초기화 및 전환
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = '';
      await initSync();
      initCalendar();
      initModal();
      initRepeat();
      initGesturePopup();
      initSearch();
      initWeekly();
      initSettings();
      initTabs();
      loadTodos();
      initBackButton();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById('date-bar-actions').style.visibility = 'visible';
        });
      });
    } catch(err) {
      errorEl.textContent = '이메일 또는 비밀번호가 올바르지 않아요';
    } finally {
      btnText.textContent = '로그인';
      spinner.style.display = 'none';
    }
  });
}

// 전역 앱 상태
const AppState = {
  selectedDate: toLocalDateStr(new Date()),  // 'YYYY-MM-DD'
  calYear:  new Date().getFullYear(),
  calMonth: new Date().getMonth() + 1,       // 1~12
  todos: [],           // 현재 날짜 할일 목록
  dotDates: new Set(), // 달력 점 표시용 날짜 set
  pastUndoneDates: new Set(), // 과거 미완료 날짜 set
  editingId: null,     // 수정 중인 todo id
  isOnline: navigator.onLine,
};

// 온/오프라인 상태 감지
window.addEventListener('online',  () => { AppState.isOnline = true;  onOnline(); });
window.addEventListener('offline', () => { AppState.isOnline = false; });

// 날짜를 로컬 기준 YYYY-MM-DD 문자열로 변환
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 오늘 날짜 문자열
function todayStr() {
  return toLocalDateStr(new Date());
}

// 내일 날짜 문자열
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

// N일 전 날짜 문자열
function daysBeforeStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d);
}

// 토스트 알림
function showToast(msg, duration = 2000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}
