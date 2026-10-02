// 일정 펼치기 (반복 → 실제 날짜)
// key 형식: 원본id@원래날짜(YYYY-MM-DD) — 휴일 연장 전의 날짜를 쓴다.

const CAT_ORDER = { tax: 0, hr: 1, my: 2 };

// 반복 라벨
function baseRepeatLabel(item) {
  const dayLabel = item.day === 'last' ? '말일' : item.day + '일';
  if (item.freq === 'monthly') return '매월 ' + dayLabel;
  return '매년 ' + item.month + '월 ' + dayLabel;
}

function taskRepeatLabel(t) {
  if (t.repeat === 'once') {
    const d = parseYmd(t.start);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }
  if (t.repeat === 'monthly') {
    return '매월 ' + (t.day === 'last' ? '말일' : t.day + '일');
  }
  if (t.repeat === 'weekly') {
    return '매주 ' + DOW_SHORT[t.dow] + '요일';
  }
  return '';
}

// startDate, endDate: Date. 범위 안의 모든 발생 건 배열 반환.
function expand(startDate, endDate) {
  const out = [];
  const data = loadData();
  const hidden = new Set(data.hiddenBase || []);
  const status = data.status || {};
  const notes = data.notes || {};

  function pushOcc(src, source, title, cat, origDate, shiftMode, memo, repeatLabel) {
    const shifted = shiftBusiness(origDate, shiftMode);
    if (shifted < startDate || shifted > endDate) return;
    const origYmd = ymd(origDate);
    const shiftedYmd = ymd(shifted);
    const key = src + '@' + origYmd;
    out.push({
      key: key,
      src: src,
      source: source,
      title: title,
      cat: cat,
      date: shiftedYmd,
      orig: origYmd,
      shifted: shiftedYmd !== origYmd,
      memo: memo || '',
      note: notes[key] || '',
      status: status[key] || 'todo',
      repeatLabel: repeatLabel || ''
    });
  }

  // 월 단위 순회: 시작일 한 달 전 ~ 종료일 32일 뒤
  const startIter = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
  const endBound = addDays(endDate, 32);
  const endIter = new Date(endBound.getFullYear(), endBound.getMonth(), 1);

  let cur = new Date(startIter.getFullYear(), startIter.getMonth(), 1);
  while (cur <= endIter) {
    const y = cur.getFullYear();
    const m = cur.getMonth();

    // 기본일정
    BASE_SCHEDULE.forEach(function (item) {
      if (hidden.has(item.id)) return;
      if (item.freq === 'yearly' && (item.month - 1) !== m) return;
      const dnum = resolveDay(y, m, item.day);
      const origDate = new Date(y, m, dnum);
      pushOcc(item.id, 'base', item.title, item.cat, origDate, item.shift, item.memo, baseRepeatLabel(item));
    });

    // 내 업무 — 매월 반복
    (data.tasks || []).forEach(function (t) {
      if (t.repeat !== 'monthly') return;
      const startD = parseYmd(t.start);
      const dnum = resolveDay(y, m, t.day);
      const origDate = new Date(y, m, dnum);
      if (origDate < new Date(startD.getFullYear(), startD.getMonth(), startD.getDate())) return;
      pushOcc(t.id, 'custom', t.title, t.cat, origDate, t.shift || 'none', t.memo, taskRepeatLabel(t));
    });

    cur = new Date(y, m + 1, 1);
  }

  // 내 업무 — 한 번 / 매주 반복 (월 순회와 별개)
  (data.tasks || []).forEach(function (t) {
    if (t.repeat === 'once') {
      const d = parseYmd(t.start);
      pushOcc(t.id, 'custom', t.title, t.cat, d, 'none', t.memo, taskRepeatLabel(t));
    } else if (t.repeat === 'weekly') {
      const startD = parseYmd(t.start);
      let d = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
      let guard = 0;
      while (d <= endDate && guard < 400) {
        if (d >= startDate) {
          pushOcc(t.id, 'custom', t.title, t.cat, new Date(d.getFullYear(), d.getMonth(), d.getDate()), 'none', t.memo, taskRepeatLabel(t));
        }
        d = addDays(d, 7);
        guard++;
      }
    }
  });

  // 정렬: 날짜순, 같은 날이면 tax -> hr -> my
  out.sort(function (a, b) {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return (CAT_ORDER[a.cat] - CAT_ORDER[b.cat]);
  });

  return out;
}

// 발생 건들을 날짜별로 묶기
function groupByDate(occs) {
  const map = {};
  occs.forEach(function (o) {
    (map[o.date] || (map[o.date] = [])).push(o);
  });
  return map;
}
