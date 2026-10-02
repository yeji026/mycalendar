// 날짜 유틸 + 영업일 연장 계산
// 전역 스코프 공유 (모듈 없음)

const DOW_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const DOW_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

// Date -> 'YYYY-MM-DD' (로컬 기준)
function ymd(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// 'YYYY-MM-DD' -> Date (로컬 자정)
function parseYmd(s) {
  const p = s.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function lastDayOfMonth(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}

// 해당 월에서 day(숫자|'last')를 실제 '일'로 해석. 31일이 없는 달은 말일로.
function resolveDay(year, month0, day) {
  const last = lastDayOfMonth(year, month0);
  if (day === 'last') return last;
  return Math.min(day, last);
}

function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function isHoliday(d) {
  return !!HOLIDAYS[ymd(d)];
}

function holidayName(d) {
  return HOLIDAYS[ymd(d)] || '';
}

// 토·일·공휴일은 쉬는 날
function isOffDay(d) {
  return isWeekend(d) || isHoliday(d);
}

// 영업일 연장. mode: 'next' | 'prev' | 'none'
function shiftBusiness(d, mode) {
  if (mode === 'none' || !mode) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const step = mode === 'prev' ? -1 : 1;
  let guard = 0;
  while (isOffDay(r) && guard < 40) {
    r = addDays(r, step);
    guard++;
  }
  return r;
}

// 두 Date가 같은 날인지
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// D-day 계산: 대상 - 오늘 (일수). 음수면 지남.
function daysBetween(fromYmd, toYmd) {
  const a = parseYmd(fromYmd), b = parseYmd(toYmd);
  return Math.round((b - a) / 86400000);
}
