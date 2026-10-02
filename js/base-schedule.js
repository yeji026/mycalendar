// 기본 신고일정 데이터 — 12월 결산 법인 기준
// freq: 'monthly'(매월) | 'yearly'(매년 특정 월)
// day: 숫자 | 'last'(말일)
// shift: 'next'(다음 영업일로 연장) | 'none'(그대로)
const BASE_SCHEDULE = [
  { id: 'wht',         cat: 'tax', freq: 'monthly',              day: 10,     shift: 'next', title: '원천세 신고·납부',                                  memo: '전월 지급분 · 법인별로 각각' },
  { id: 'ins-pay',     cat: 'hr',  freq: 'monthly',              day: 10,     shift: 'next', title: '4대보험료 납부',                                    memo: '전월분 고지서 기준' },
  { id: 'ins-acq',     cat: 'hr',  freq: 'monthly',              day: 15,     shift: 'next', title: '4대보험 취득·상실 신고 기한',                        memo: '전월 입·퇴사자' },
  { id: 'daily-stmt',  cat: 'tax', freq: 'monthly',              day: 'last', shift: 'next', title: '일용근로소득 지급명세서 제출',                        memo: '전월 지급분' },
  { id: 'simple-stmt', cat: 'tax', freq: 'monthly',              day: 'last', shift: 'next', title: '사업·기타소득 간이지급명세서 제출',                   memo: '전월 지급분' },
  { id: 'vat-2c',      cat: 'tax', freq: 'yearly', month: 1,     day: 25,     shift: 'next', title: '부가세 2기 확정 신고·납부',                          memo: '7~12월분' },
  { id: 'vat-1p',      cat: 'tax', freq: 'yearly', month: 4,     day: 25,     shift: 'next', title: '부가세 1기 예정 신고·납부',                          memo: '1~3월분' },
  { id: 'vat-1c',      cat: 'tax', freq: 'yearly', month: 7,     day: 25,     shift: 'next', title: '부가세 1기 확정 신고·납부',                          memo: '4~6월분' },
  { id: 'vat-2p',      cat: 'tax', freq: 'yearly', month: 10,    day: 25,     shift: 'next', title: '부가세 2기 예정 신고·납부',                          memo: '7~9월분' },
  { id: 'cit',         cat: 'tax', freq: 'yearly', month: 3,     day: 31,     shift: 'next', title: '법인세 신고·납부',                                   memo: '12월 결산법인' },
  { id: 'cit-local',   cat: 'tax', freq: 'yearly', month: 4,     day: 30,     shift: 'next', title: '법인지방소득세 신고·납부',                            memo: '사업장 소재지 지자체' },
  { id: 'cit-mid',     cat: 'tax', freq: 'yearly', month: 8,     day: 31,     shift: 'next', title: '법인세 중간예납',                                    memo: '1~6월분' },
  { id: 'resident',    cat: 'tax', freq: 'yearly', month: 8,     day: 31,     shift: 'next', title: '주민세(사업소분) 신고·납부',                          memo: '7/1 기준' },
  { id: 'yea-open',    cat: 'hr',  freq: 'yearly', month: 1,     day: 15,     shift: 'none', title: '연말정산 간소화 자료 개통 · 직원 안내',               memo: '' },
  { id: 'labor-h2',    cat: 'tax', freq: 'yearly', month: 1,     day: 'last', shift: 'next', title: '근로소득 간이지급명세서(하반기)',                     memo: '7~12월분' },
  { id: 'int-div',     cat: 'tax', freq: 'yearly', month: 2,     day: 'last', shift: 'next', title: '이자·배당·기타소득 지급명세서',                       memo: '' },
  { id: 'yea',         cat: 'tax', freq: 'yearly', month: 3,     day: 10,     shift: 'next', title: '연말정산 원천세 신고 · 근로·퇴직·사업소득 지급명세서', memo: '2월분 원천세와 함께' },
  { id: 'nhis-total',  cat: 'hr',  freq: 'yearly', month: 3,     day: 10,     shift: 'next', title: '건강보험 보수총액 신고',                              memo: '' },
  { id: 'ei-total',    cat: 'hr',  freq: 'yearly', month: 3,     day: 15,     shift: 'next', title: '고용·산재 보수총액 신고',                             memo: '' },
  { id: 'labor-h1',    cat: 'tax', freq: 'yearly', month: 7,     day: 'last', shift: 'next', title: '근로소득 간이지급명세서(상반기)',                     memo: '1~6월분' }
];
