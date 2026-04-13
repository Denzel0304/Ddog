// =============================================
// config.js — Supabase 설정 & 전역 상태
// =============================================

const SUPABASE_URL  = 'https://rcfayyhlgxubuakxhrxy.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZmF5eWhsZ3h1YnVha3hocnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ4MjYsImV4cCI6MjA5MTQyMDgyNn0.j7YtqXfN0zxM-35RLGcjcw47uq83etMjJbHip4td4xg';
const TABLE_NAME    = 'ddog';

// Supabase REST 클라이언트 (직접 fetch)
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

// Supabase JS SDK 클라이언트 (Realtime용)
// index.html에서 CDN으로 로드한 supabase global 사용
let supabaseClient = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseClient;
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
