// 화면 렌더링과 이벤트 — 전역 스코프 공유

const CATS = {
  tax: { name: '세무신고' },
  hr:  { name: '인사·급여' },
  my:  { name: '내 업무' }
};
const STATUS_LABEL = { todo: '예정', doing: '진행중', done: '완료' };

const UI = {
  tab: 'calendar',
  year: 0,
  month: 0,      // 0-based
  selected: '',  // 'YYYY-MM-DD'
  listFilter: 'all'
};

let appRoot, toastEl, toastTimer;

// ---------- DOM 헬퍼 ----------
function h(tag, opts, children) {
  const e = document.createElement(tag);
  opts = opts || {};
  if (opts.class) e.className = opts.class;
  if (opts.text != null) e.textContent = opts.text;     // 사용자 입력은 항상 textContent
  if (opts.aria) e.setAttribute('aria-label', opts.aria);
  if (opts.type) e.type = opts.type;
  if (opts.attrs) for (const k in opts.attrs) e.setAttribute(k, opts.attrs[k]);
  if (opts.on) for (const ev in opts.on) e.addEventListener(ev, opts.on[ev]);
  if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
}

// ---------- 상태 조작 ----------
function cycleStatus(key) {
  const d = loadData();
  const cur = d.status[key] || 'todo';
  const next = cur === 'todo' ? 'doing' : cur === 'doing' ? 'done' : 'todo';
  if (next === 'todo') delete d.status[key]; else d.status[key] = next;
  saveData(d);
}
function setStatus(key, val) {
  const d = loadData();
  if (val === 'todo') delete d.status[key]; else d.status[key] = val;
  saveData(d);
}

// ---------- 날짜 유틸(화면용) ----------
function monthLabel(y, m) { return (m + 1) + '월'; }
function fullDayTitle(ymdStr) {
  const d = parseYmd(ymdStr);
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + DOW_NAMES[d.getDay()];
}
function catClass(prefix, cat) { return prefix + '-' + cat; }

function monthRange(y, m) {
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };
}

// ===================================================================
// 렌더 디스패치
// ===================================================================
function render() {
  clear(appRoot);
  appRoot.appendChild(renderHeader());
  const main = h('main');
  if (UI.tab === 'calendar') renderCalendarTab(main);
  else if (UI.tab === 'list') renderListTab(main);
  else renderFixedTab(main);
  appRoot.appendChild(main);
  appRoot.appendChild(renderTabbar());
  appRoot.appendChild(renderFab());
}

function renderHeader() {
  const header = h('div', { class: 'header' });
  const left = h('div', {}, [
    h('div', { class: 'h-year num', text: UI.year + '년' }),
    h('div', { class: 'h-month', text: monthLabel(UI.year, UI.month) })
  ]);
  const pill = h('div', { class: 'nav-pill' }, [
    h('button', { class: 'arrow', aria: '이전 달', text: '‹', on: { click: function () { moveMonth(-1); } } }),
    h('button', { text: '오늘', on: { click: goToday } }),
    h('button', { class: 'arrow', aria: '다음 달', text: '›', on: { click: function () { moveMonth(1); } } })
  ]);
  header.appendChild(left);
  header.appendChild(pill);
  return header;
}

function renderTabbar() {
  const bar = h('div', { class: 'tabbar' });
  [['calendar', '달력'], ['list', '목록'], ['fixed', '고정업무']].forEach(function (t) {
    bar.appendChild(h('button', {
      class: UI.tab === t[0] ? 'on' : '', text: t[1],
      on: { click: function () { UI.tab = t[0]; render(); window.scrollTo(0, 0); } }
    }));
  });
  return bar;
}

function renderFab() {
  return h('button', {
    class: 'fab', aria: '업무 추가', text: '+',
    on: { click: function () { openEditSheet(null, { repeat: UI.tab === 'fixed' ? 'monthly' : 'once' }); } }
  });
}

// ===================================================================
// 달력 탭
// ===================================================================
function renderCalendarTab(main) {
  main.appendChild(renderStrip());
  main.appendChild(renderCalendar());
  main.appendChild(renderSelectedDay());
}

// ---- 다가오는 띠 ----
function renderStrip() {
  const wrap = h('div');
  const t = today();
  const occs = expand(addDays(t, -20), addDays(t, 60));
  const overdue = occs.filter(function (o) {
    if (o.status === 'done') return false;
    if (o.cat !== 'tax' && o.cat !== 'hr') return false;
    const diff = daysBetween(ymd(t), o.date);
    return diff < 0 && diff >= -14;
  });
  const upcoming = occs.filter(function (o) {
    if (o.status === 'done') return false;
    if (o.cat !== 'tax' && o.cat !== 'hr') return false;
    const diff = daysBetween(ymd(t), o.date);
    return diff >= 0 && diff <= 45;
  }).slice(0, 4);

  const strip = h('div', { class: 'strip' });
  const items = overdue.concat(upcoming);
  if (items.length === 0) {
    strip.appendChild(h('div', { class: 'strip-empty', text: '45일 안에 남은 신고·납부가 없어요.' }));
  } else {
    items.forEach(function (o) {
      const diff = daysBetween(ymd(t), o.date);
      const over = diff < 0;
      const card = h('button', {
        class: 'strip-card ' + catClass('cat', o.cat) + (over ? ' overdue' : ''),
        on: { click: function () { selectDate(o.date); } }
      });
      card.appendChild(h('div', { class: 'sc-title', text: o.title }));
      const bottom = h('div', { class: 'sc-bottom' });
      const dd = over ? (-diff) + '일 지남' : diff === 0 ? '오늘' : 'D-' + diff;
      bottom.appendChild(h('span', { class: 'badge-dday', text: dd }));
      const md = parseYmd(o.date);
      bottom.appendChild(h('span', { class: 'sc-date num', text: (md.getMonth() + 1) + '.' + md.getDate() + ' (' + DOW_SHORT[md.getDay()] + ')' }));
      card.appendChild(bottom);
      strip.appendChild(card);
    });
  }
  wrap.appendChild(strip);
  return wrap;
}

// ---- 월 달력 ----
function renderCalendar() {
  const cal = h('div', { class: 'calendar' });

  const dowRow = h('div', { class: 'cal-dow' });
  DOW_SHORT.forEach(function (n, i) {
    dowRow.appendChild(h('div', { class: i === 0 ? 'sun' : i === 6 ? 'sat' : '', text: n }));
  });
  cal.appendChild(dowRow);

  // 6주(42칸): 그 달 1일이 속한 주의 일요일부터
  const first = new Date(UI.year, UI.month, 1);
  const gridStart = addDays(first, -first.getDay());
  const gridEnd = addDays(gridStart, 41);
  const occs = expand(gridStart, gridEnd);
  const byDate = groupByDate(occs);
  const tStr = ymd(today());

  const grid = h('div', { class: 'cal-grid' });
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const ds = ymd(d);
    const inMonth = d.getMonth() === UI.month;
    const dayOccs = byDate[ds] || [];
    const hasOpenTax = dayOccs.some(function (o) { return o.cat === 'tax' && o.status !== 'done'; });

    let cls = 'cal-cell';
    if (d.getDay() === 0 || isHoliday(d)) cls += ' sun';
    else if (d.getDay() === 6) cls += ' sat';
    if (!inMonth) cls += ' other';
    if (ds === tStr) cls += ' today';
    if (ds === UI.selected) cls += ' selected';
    else if (hasOpenTax) cls += ' tax-day';

    const cell = h('button', { class: cls, on: { click: (function (dd) { return function () { selectDate(dd); }; })(ds) } });
    cell.appendChild(h('div', { class: 'cal-num num', text: '' + d.getDate() }));

    const dots = h('div', { class: 'cal-dots' });
    dayOccs.slice(0, 3).forEach(function (o) {
      dots.appendChild(h('span', { class: 'cal-dot ' + o.cat + (o.status === 'done' ? ' done' : '') }));
    });
    if (dayOccs.length > 3) dots.appendChild(h('span', { class: 'cal-more', text: '+' + (dayOccs.length - 3) }));
    cell.appendChild(dots);
    grid.appendChild(cell);
  }
  cal.appendChild(grid);

  const legend = h('div', { class: 'legend' });
  [['tax', '세무신고'], ['hr', '인사·급여'], ['my', '내 업무']].forEach(function (c) {
    legend.appendChild(h('span', {}, [
      h('i', { attrs: { style: 'background:var(--' + c[0] + ')' } }),
      document.createTextNode(c[1])
    ]));
  });
  cal.appendChild(legend);

  attachSwipe(cal);
  return cal;
}

function attachSwipe(el) {
  let x0 = 0, y0 = 0, tracking = false;
  el.addEventListener('touchstart', function (e) {
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; tracking = true;
  }, { passive: true });
  el.addEventListener('touchend', function (e) {
    if (!tracking) return; tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      moveMonth(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

// ---- 선택한 날 목록 ----
function renderSelectedDay() {
  const wrap = h('div');
  const d = parseYmd(UI.selected);
  const head = h('div', { class: 'day-head' });
  const titleWrap = h('div');
  const title = h('span', { class: 'd-title', text: fullDayTitle(UI.selected) });
  titleWrap.appendChild(title);
  const hn = holidayName(d);
  if (hn) titleWrap.appendChild(h('span', { class: 'badge-holi', text: hn }));
  head.appendChild(titleWrap);

  const occs = expand(d, d);
  if (occs.length > 0) {
    head.appendChild(h('button', { class: 'btn-ghost', text: '전체 복사', on: { click: function () { openCopySheet(occs, UI.selected); } } }));
  }
  wrap.appendChild(head);

  if (occs.length === 0) {
    const box = h('div', { class: 'empty-box' });
    box.appendChild(h('p', { text: '이 날은 일정이 없어요.' }));
    box.appendChild(h('button', { class: 'btn-primary btn', attrs: { style: 'max-width:180px;margin:0 auto' }, text: '+ 업무 추가', on: { click: function () { openEditSheet(null, { repeat: 'once', start: UI.selected }); } } }));
    wrap.appendChild(box);
  } else {
    occs.forEach(function (o) { wrap.appendChild(scheduleCard(o)); });
  }
  return wrap;
}

// ===================================================================
// 일정 카드 (공통)
// ===================================================================
function scheduleCard(o) {
  const card = h('button', { class: 'card ' + (o.status === 'done' ? 'done' : ''), on: { click: function () { openDetailSheet(o); } } });

  const icon = h('div', { class: 'card-icon ' + catClass('icon', o.cat) }, [h('i')]);
  card.appendChild(icon);

  const body = h('div', { class: 'card-body' });
  body.appendChild(h('div', { class: 'card-title', text: o.title }));

  const sub = h('div', { class: 'card-sub' });
  const parts = [];
  parts.push(h('span', { text: CATS[o.cat].name }));
  if (o.repeatLabel) parts.push(h('span', { class: 'sep', text: o.repeatLabel }));
  if (o.shifted) {
    const od = parseYmd(o.orig);
    parts.push(h('span', { class: 'sep warn', text: '원래 ' + (od.getMonth() + 1) + '/' + od.getDate() + '(' + DOW_SHORT[od.getDay()] + ') → 연장' }));
  }
  // 기한 임박/지남 (tax·hr)
  if (o.cat === 'tax' || o.cat === 'hr') {
    if (o.status !== 'done') {
      const diff = daysBetween(ymd(today()), o.date);
      if (diff < 0) parts.push(h('span', { class: 'sep danger', text: '기한 지남' }));
      else if (diff === 0) parts.push(h('span', { class: 'sep danger', text: '오늘 마감' }));
      else if (diff <= 7) parts.push(h('span', { class: 'sep danger', text: 'D-' + diff }));
    }
  }
  const memoText = o.note || o.memo;
  if (memoText) parts.push(h('span', { class: 'sep', text: '📝 ' + memoText.slice(0, 20) }));
  parts.forEach(function (p) { sub.appendChild(p); });
  body.appendChild(sub);
  card.appendChild(body);

  const chip = h('span', {
    class: 'chip chip-' + o.status, text: STATUS_LABEL[o.status],
    attrs: { role: 'button', tabindex: '0', 'aria-label': '진행상황 ' + STATUS_LABEL[o.status] },
    on: {
      click: function (e) { e.stopPropagation(); cycleStatus(o.key); render(); },
      keydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); cycleStatus(o.key); render(); } }
    }
  });
  card.appendChild(chip);
  return card;
}

// ===================================================================
// 목록 탭
// ===================================================================
function renderListTab(main) {
  const filters = h('div', { class: 'filters' });
  [['all', '전체'], ['open', '미완료'], ['tax', '세무신고'], ['hr', '인사·급여'], ['my', '내 업무']].forEach(function (f) {
    filters.appendChild(h('button', {
      class: 'filter-chip ' + (UI.listFilter === f[0] ? 'on' : ''), text: f[1],
      on: { click: function () { UI.listFilter = f[0]; render(); } }
    }));
  });
  main.appendChild(filters);

  const r = monthRange(UI.year, UI.month);
  let occs = expand(r.start, r.end);
  const total = occs.length;
  const doneCount = occs.filter(function (o) { return o.status === 'done'; }).length;

  if (UI.listFilter === 'open') occs = occs.filter(function (o) { return o.status !== 'done'; });
  else if (UI.listFilter !== 'all') occs = occs.filter(function (o) { return o.cat === UI.listFilter; });

  const pr = h('div', { class: 'progress-row' });
  pr.appendChild(h('div', { class: 'p-label', text: total + '건 중 ' + doneCount + '건 완료' }));
  const bar = h('div', { class: 'progress-bar' }, [h('i', { attrs: { style: 'width:' + (total ? Math.round(doneCount / total * 100) : 0) + '%' } })]);
  pr.appendChild(bar);
  main.appendChild(pr);

  if (occs.length === 0) {
    main.appendChild(h('div', { class: 'empty-box' }, [h('p', { text: '해당하는 일정이 없어요.' })]));
    return;
  }

  const byDate = groupByDate(occs);
  const tStr = ymd(today());
  Object.keys(byDate).sort().forEach(function (ds) {
    const isToday = ds === tStr;
    main.appendChild(h('div', { class: 'list-group-title' + (isToday ? ' today' : ''), text: fullDayTitle(ds) + (isToday ? ' · 오늘' : '') }));
    byDate[ds].forEach(function (o) { main.appendChild(scheduleCard(o)); });
  });
}

// ===================================================================
// 고정업무 탭
// ===================================================================
function renderFixedTab(main) {
  const data = loadData();

  main.appendChild(h('div', { class: 'section-title', text: '내 고정 업무' }));
  const mine = (data.tasks || []).filter(function (t) { return t.repeat === 'monthly' || t.repeat === 'weekly'; });
  if (mine.length === 0) {
    const box = h('div', { class: 'empty-box' });
    box.appendChild(h('p', { text: '아직 고정 업무가 없어요. 매월·매주 반복하는 내 업무를 등록해 보세요.' }));
    box.appendChild(h('button', { class: 'btn-primary btn', attrs: { style: 'max-width:200px;margin:0 auto' }, text: '+ 고정 업무 추가', on: { click: function () { openEditSheet(null, { repeat: 'monthly' }); } } }));
    main.appendChild(box);
  } else {
    mine.forEach(function (t) {
      const row = h('button', { class: 'fixed-row', on: { click: function () { openEditSheet(t); } } });
      row.appendChild(h('div', { class: 'card-icon ' + catClass('icon', t.cat) }, [h('i')]));
      const b = h('div', { class: 'fr-body' });
      b.appendChild(h('div', { class: 'fr-title', text: t.title }));
      b.appendChild(h('div', { class: 'fr-sub', text: CATS[t.cat].name + ' · ' + taskRepeatLabel(t) }));
      row.appendChild(b);
      main.appendChild(row);
    });
  }

  main.appendChild(h('div', { class: 'section-title', text: '기본 일정' }));
  const hidden = new Set(data.hiddenBase || []);
  BASE_SCHEDULE.forEach(function (item) {
    const row = h('div', { class: 'fixed-row' });
    row.appendChild(h('div', { class: 'card-icon ' + catClass('icon', item.cat) }, [h('i')]));
    const b = h('div', { class: 'fr-body' });
    b.appendChild(h('div', { class: 'fr-title', text: item.title }));
    b.appendChild(h('div', { class: 'fr-sub', text: CATS[item.cat].name + ' · ' + baseRepeatLabel(item) }));
    row.appendChild(b);
    const on = !hidden.has(item.id);
    const tog = h('button', {
      class: 'toggle ' + (on ? 'on' : ''), aria: item.title + ' ' + (on ? '켜짐' : '꺼짐'),
      attrs: { role: 'switch', 'aria-checked': on ? 'true' : 'false' },
      on: { click: function () { toggleBase(item.id); } }
    });
    row.appendChild(tog);
    main.appendChild(row);
  });

  main.appendChild(h('div', { class: 'note-foot', text:
    '휴일 연장: 기한이 토·일·공휴일이면 다음 영업일로 자동 연장해 표시합니다(일부는 그대로 둠). ' +
    '공휴일은 ' + HOLIDAY_YEARS.join('·') + '년을 수록했습니다. ' +
    '기한 연장 고시가 있으면 홈택스 공지를 우선 확인하세요.' }));
}

function toggleBase(id) {
  const d = loadData();
  const set = new Set(d.hiddenBase || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  d.hiddenBase = Array.from(set);
  saveData(d);
  render();
}

// ===================================================================
// 네비게이션
// ===================================================================
function moveMonth(delta) {
  const nd = new Date(UI.year, UI.month + delta, 1);
  UI.year = nd.getFullYear();
  UI.month = nd.getMonth();
  render();
}
function goToday() {
  const t = today();
  UI.year = t.getFullYear(); UI.month = t.getMonth(); UI.selected = ymd(t);
  UI.tab = 'calendar';
  render();
}
function selectDate(ds) {
  UI.selected = ds;
  const d = parseYmd(ds);
  UI.year = d.getFullYear(); UI.month = d.getMonth();
  UI.tab = 'calendar';
  render();
}

// ===================================================================
// 바텀시트 공통
// ===================================================================
function openSheet(buildFn) {
  const overlay = h('div', { class: 'overlay', on: { mousedown: function (e) { if (e.target === overlay) closeSheet(overlay); } } });
  const sheet = h('div', { class: 'sheet' });
  sheet.appendChild(h('div', { class: 'sheet-grip' }));
  overlay.appendChild(sheet);
  buildFn(sheet, function () { closeSheet(overlay); });
  document.body.appendChild(overlay);
  requestAnimationFrame(function () { overlay.classList.add('open'); });
  const esc = function (e) { if (e.key === 'Escape') closeSheet(overlay); };
  overlay._esc = esc;
  document.addEventListener('keydown', esc);
  return { overlay: overlay, sheet: sheet };
}
function closeSheet(overlay) {
  overlay.classList.remove('open');
  if (overlay._esc) document.removeEventListener('keydown', overlay._esc);
  setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 240);
  render(); // 닫힐 때 다시 그린다
}

function tagEl(cat) { return h('span', { class: 'tag ' + catClass('cat', cat), text: CATS[cat].name }); }

// ---------- 상세 시트 ----------
function openDetailSheet(o) {
  openSheet(function (sheet, close) {
    const tagRow = h('div', { class: 'tag-row' });
    tagRow.appendChild(tagEl(o.cat));
    if (o.repeatLabel) tagRow.appendChild(h('span', { class: 'tag', attrs: { style: 'background:var(--soft);color:var(--muted)' }, text: o.repeatLabel }));
    sheet.appendChild(tagRow);

    sheet.appendChild(h('h2', { text: o.title }));

    const d = parseYmd(o.date);
    let dateStr = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + DOW_SHORT[d.getDay()] + ')';
    if (o.shifted) {
      const od = parseYmd(o.orig);
      dateStr += '  ·  원래 ' + (od.getMonth() + 1) + '/' + od.getDate() + '(' + DOW_SHORT[od.getDay()] + ') → 연장';
    }
    sheet.appendChild(h('div', { class: 'meta-line num', text: dateStr }));

    if (o.memo) sheet.appendChild(h('div', { class: 'memo-text', text: o.memo }));

    // 진행상황 세그먼트
    sheet.appendChild(h('div', { class: 'field status-seg' }, [
      h('label', { text: '진행상황' }),
      (function () {
        const seg = h('div', { class: 'seg' });
        ['todo', 'doing', 'done'].forEach(function (s) {
          seg.appendChild(h('button', {
            class: o.status === s ? 'on' : '', text: STATUS_LABEL[s],
            on: { click: function () { setStatus(o.key, s); o.status = s; Array.from(seg.children).forEach(function (c, i) { c.className = (['todo', 'doing', 'done'][i] === s) ? 'on' : ''; }); } }
          }));
        });
        return seg;
      })()
    ]));

    // 날짜별 메모 (자동 저장)
    const memoField = h('textarea', { class: 'input', attrs: { placeholder: '이 날짜에만 남길 메모', maxlength: '300' } });
    memoField.value = o.note || '';
    let saveTimer;
    memoField.addEventListener('input', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        const data = loadData();
        const v = memoField.value.trim();
        if (v) data.notes[o.key] = v; else delete data.notes[o.key];
        saveData(data);
        showToast('저장했어요');
      }, 600);
    });
    sheet.appendChild(h('div', { class: 'field' }, [h('label', { text: '날짜 메모' }), memoField]));

    // 버튼
    const actions = h('div', { class: 'sheet-actions' });
    actions.appendChild(h('button', { class: 'btn btn-soft', text: '닫기', on: { click: close } }));
    actions.appendChild(h('button', { class: 'btn btn-primary', text: '다른 날짜로 복사', on: { click: function () { close(); openCopySheet([o], o.date); } } }));

    if (o.source === 'custom') {
      const data = loadData();
      const task = (data.tasks || []).find(function (t) { return t.id === o.src; });
      actions.appendChild(h('button', { class: 'btn btn-soft btn-full', text: '수정', on: { click: function () { close(); openEditSheet(task); } } }));
      actions.appendChild(h('button', {
        class: 'btn btn-danger btn-full', text: '삭제',
        on: { click: function () {
          const msg = (task && (task.repeat === 'monthly' || task.repeat === 'weekly'))
            ? '반복 업무입니다. 삭제하면 모든 날짜에서 사라집니다. 삭제할까요?'
            : '이 업무를 삭제할까요?';
          if (confirm(msg)) { deleteTask(o.src); close(); showToast('삭제했어요'); }
        } }
      }));
    } else {
      actions.appendChild(h('button', {
        class: 'btn btn-soft btn-full', text: '이 기본 일정 숨기기',
        on: { click: function () { toggleBase(o.src); close(); showToast('숨겼어요'); } }
      }));
    }
    sheet.appendChild(actions);
  });
}

function deleteTask(id) {
  const d = loadData();
  d.tasks = (d.tasks || []).filter(function (t) { return t.id !== id; });
  Object.keys(d.status).forEach(function (k) { if (k.indexOf(id + '@') === 0) delete d.status[k]; });
  Object.keys(d.notes).forEach(function (k) { if (k.indexOf(id + '@') === 0) delete d.notes[k]; });
  saveData(d);
}

// ---------- 추가·수정 시트 ----------
function openEditSheet(task, prefill) {
  prefill = prefill || {};
  const editing = !!task;
  const model = editing ? {
    title: task.title, cat: task.cat, repeat: task.repeat,
    start: task.start, day: task.day, dow: task.dow, shift: task.shift || 'none', memo: task.memo || ''
  } : {
    title: '', cat: 'my', repeat: prefill.repeat || 'once',
    start: prefill.start || UI.selected, day: 1, dow: 0, shift: 'none', memo: ''
  };

  openSheet(function (sheet, close) {
    sheet.appendChild(h('h2', { text: editing ? '업무 수정' : '새 업무' }));

    // 업무명
    const titleInput = h('input', { class: 'input', attrs: { maxlength: '60', placeholder: '예: 정기지출 기안서 작성' } });
    titleInput.value = model.title;
    sheet.appendChild(h('div', { class: 'field' }, [h('label', { text: '업무명' }), titleInput]));

    // 분류
    const catSeg = buildSeg([['tax', '세무신고'], ['hr', '인사·급여'], ['my', '내 업무']], model.cat, function (v) { model.cat = v; });
    sheet.appendChild(h('div', { class: 'field' }, [h('label', { text: '분류' }), catSeg]));

    // 반복
    const repeatSeg = buildSeg([['once', '한 번'], ['monthly', '매월'], ['weekly', '매주']], model.repeat, function (v) { model.repeat = v; renderRepeatArea(); });
    sheet.appendChild(h('div', { class: 'field' }, [h('label', { text: '반복' }), repeatSeg]));

    // 날짜/옵션 영역
    const area = h('div');
    sheet.appendChild(area);

    function renderRepeatArea() {
      clear(area);
      const dateInput = h('input', { class: 'input', type: 'date' });
      dateInput.value = model.start;
      dateInput.addEventListener('change', function () { model.start = dateInput.value; });
      area.appendChild(h('div', { class: 'field' }, [h('label', { text: model.repeat === 'once' ? '날짜' : '시작일' }), dateInput]));

      if (model.repeat === 'monthly') {
        // 말일 체크
        const lastChk = h('input', { type: 'checkbox', attrs: { id: 'lastChk' } });
        lastChk.checked = model.day === 'last';
        const shiftSeg = buildSeg([['none', '그대로 두기'], ['prev', '앞 영업일로'], ['next', '다음 영업일로']], model.shift, function (v) { model.shift = v; });
        lastChk.addEventListener('change', function () { model.day = lastChk.checked ? 'last' : (parseYmd(model.start).getDate()); });
        if (model.day !== 'last') model.day = parseYmd(model.start).getDate();
        area.appendChild(h('div', { class: 'checkbox-row' }, [lastChk, h('label', { attrs: { for: 'lastChk' }, text: '매월 말일로' })]));
        area.appendChild(h('div', { class: 'field' }, [h('label', { text: '휴일에 걸리면' }), shiftSeg]));
      }
    }
    renderRepeatArea();

    // 메모
    const memoInput = h('textarea', { class: 'input', attrs: { placeholder: '메모 (선택)', maxlength: '300' } });
    memoInput.value = model.memo;
    sheet.appendChild(h('div', { class: 'field' }, [h('label', { text: '메모' }), memoInput]));

    const actions = h('div', { class: 'sheet-actions' });
    actions.appendChild(h('button', { class: 'btn btn-soft', text: '취소', on: { click: close } }));
    actions.appendChild(h('button', {
      class: 'btn btn-primary', text: '저장',
      on: { click: function () {
        const title = titleInput.value.trim();
        if (!title) { titleInput.focus(); showToast('업무명을 입력하세요'); return; }
        model.title = title; model.memo = memoInput.value.trim();
        if (model.repeat === 'monthly' && model.day !== 'last') model.day = parseYmd(model.start).getDate();
        if (model.repeat === 'weekly') model.dow = parseYmd(model.start).getDay();
        saveTask(task, model);
        close();
        selectDate(model.start);
        showToast(editing ? '저장했어요' : '추가했어요');
      } }
    }));
    sheet.appendChild(actions);

    // 새 업무일 때만 업무명에 포커스
    if (!editing) setTimeout(function () { titleInput.focus(); }, 260);
  });
}

function buildSeg(options, value, onChange) {
  const seg = h('div', { class: 'seg' });
  options.forEach(function (op) {
    seg.appendChild(h('button', {
      class: op[0] === value ? 'on' : '', text: op[1],
      on: { click: function () {
        onChange(op[0]);
        Array.from(seg.children).forEach(function (c, i) { c.className = options[i][0] === op[0] ? 'on' : ''; });
      } }
    }));
  });
  return seg;
}

function saveTask(existing, model) {
  const d = loadData();
  const obj = {
    id: existing ? existing.id : newId(),
    title: model.title, cat: model.cat, repeat: model.repeat,
    start: model.start, memo: model.memo
  };
  if (model.repeat === 'monthly') { obj.day = model.day; obj.shift = model.shift; }
  if (model.repeat === 'weekly') { obj.dow = model.dow; }
  if (existing) {
    const i = d.tasks.findIndex(function (t) { return t.id === existing.id; });
    if (i >= 0) d.tasks[i] = obj; else d.tasks.push(obj);
  } else {
    d.tasks.push(obj);
  }
  saveData(d);
}

// ---------- 복사 시트 ----------
function addMonthsClampDay(ymdStr, n, dayOverride) {
  const base = parseYmd(ymdStr);
  const day = dayOverride || base.getDate();
  const y = base.getFullYear(), m = base.getMonth() + n;
  const last = lastDayOfMonth(new Date(y, m, 1).getFullYear(), new Date(y, m, 1).getMonth());
  return new Date(y, m, Math.min(day, last));
}

function openCopySheet(occs, fromDate) {
  // 붙여넣을 기본 날짜: 원본 날짜의 다음 달 같은 날
  const defaultTarget = ymd(addMonthsClampDay(fromDate, 1));
  const state = { target: defaultTarget, mode: 'once', months: 1 };

  openSheet(function (sheet, close) {
    sheet.appendChild(h('h2', { text: occs.length > 1 ? '전체 복사 (' + occs.length + '건)' : '다른 날짜로 복사' }));

    const list = h('div', { class: 'copy-list' });
    occs.forEach(function (o) {
      list.appendChild(h('div', { class: 'ci' }, [
        h('i', { attrs: { style: 'background:var(--' + o.cat + ')' } }),
        h('span', { text: o.title })
      ]));
    });
    sheet.appendChild(list);

    const dateInput = h('input', { class: 'input', type: 'date' });
    dateInput.value = state.target;
    dateInput.addEventListener('change', function () { state.target = dateInput.value; });
    sheet.appendChild(h('div', { class: 'field' }, [h('label', { text: '붙여넣을 날짜' }), dateInput]));

    const monthsField = h('div', { class: 'field' }, [
      h('label', { text: '몇 개월치 복사할까요? (1~12)' }),
      (function () {
        const inp = h('input', { class: 'input num', type: 'number', attrs: { min: '1', max: '12' } });
        inp.value = '1';
        inp.addEventListener('input', function () { state.months = Math.max(1, Math.min(12, parseInt(inp.value || '1', 10))); });
        return inp;
      })()
    ]);

    const modeSeg = buildSeg([['once', '한 번'], ['monthly', '매월 반복'], ['weekly', '매주 반복']], 'once', function (v) {
      state.mode = v;
      monthsField.style.display = v === 'once' ? '' : 'none';
    });
    sheet.appendChild(h('div', { class: 'field' }, [h('label', { text: '방식' }), modeSeg]));
    sheet.appendChild(monthsField);

    const actions = h('div', { class: 'sheet-actions' });
    actions.appendChild(h('button', { class: 'btn btn-soft', text: '취소', on: { click: close } }));
    actions.appendChild(h('button', {
      class: 'btn btn-primary', text: '복사하기',
      on: { click: function () {
        const n = doCopy(occs, state);
        close();
        selectDate(state.target);
        if (state.mode === 'once') showToast(n + '건 복사했어요');
        else showToast('고정 업무로 등록했어요');
      } }
    }));
    sheet.appendChild(actions);
  });
}

function doCopy(occs, state) {
  const d = loadData();
  const target = parseYmd(state.target);
  const targetDay = target.getDate();
  const targetDow = target.getDay();
  let created = 0;

  occs.forEach(function (o) {
    const memo = o.note || o.memo || '';
    if (state.mode === 'once') {
      for (let i = 0; i < state.months; i++) {
        const dt = addMonthsClampDay(state.target, i, targetDay);
        d.tasks.push({ id: newId(), title: o.title, cat: o.cat, repeat: 'once', start: ymd(dt), memo: memo });
        created++;
      }
    } else if (state.mode === 'monthly') {
      d.tasks.push({ id: newId(), title: o.title, cat: o.cat, repeat: 'monthly', start: state.target, day: targetDay, shift: o.source === 'base' ? 'next' : 'none', memo: memo });
      created++;
    } else { // weekly
      d.tasks.push({ id: newId(), title: o.title, cat: o.cat, repeat: 'weekly', start: state.target, dow: targetDow, memo: memo });
      created++;
    }
  });
  saveData(d);
  return created;
}

// ===================================================================
// 부팅
// ===================================================================
function boot() {
  appRoot = document.getElementById('app');
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.body.appendChild(toastEl);

  const t = today();
  UI.year = t.getFullYear();
  UI.month = t.getMonth();
  UI.selected = ymd(t);
  render();
}

document.addEventListener('DOMContentLoaded', boot);
