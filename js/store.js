// 저장/불러오기 — localStorage 키: workcal.v1
const STORE_KEY = 'workcal.v1';

function defaultData() {
  return {
    v: 1,
    tasks: [],
    status: {},     // { [key]: 'doing'|'done' } — 없으면 예정
    notes: {},      // { [key]: '날짜별 메모' }
    hiddenBase: [], // 끈 기본일정 id
    updatedAt: 0
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultData();
    const d = JSON.parse(raw);
    const base = defaultData();
    return {
      v: 1,
      tasks: Array.isArray(d.tasks) ? d.tasks : base.tasks,
      status: d.status && typeof d.status === 'object' ? d.status : base.status,
      notes: d.notes && typeof d.notes === 'object' ? d.notes : base.notes,
      hiddenBase: Array.isArray(d.hiddenBase) ? d.hiddenBase : base.hiddenBase,
      updatedAt: d.updatedAt || 0
    };
  } catch (e) {
    console.warn('데이터를 불러오지 못했습니다. 초기화합니다.', e);
    return defaultData();
  }
}

function saveData(d) {
  d.v = 1;
  d.updatedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(d));
  } catch (e) {
    console.error('저장 실패', e);
  }
  return d;
}

// 고유 id 생성 (crypto 우선, 없으면 시간+카운터)
let _idCounter = 0;
function newId() {
  if (window.crypto && crypto.randomUUID) return 't-' + crypto.randomUUID().slice(0, 8);
  _idCounter++;
  return 't-' + Date.now().toString(36) + '-' + _idCounter;
}
