/**
 * 욕설·실명·개인정보 거르기. 학생 글(기록·의견·큰 별 이유·키워드)과 닉네임을 저장하기 전에 확인한다.
 * 클라이언트 검사라 우회는 가능하지만, 실수로 남기는 것을 막는 1차 안전장치다.
 */

// 띄어쓰기·특수문자·숫자를 끼워 넣어 피하는 경우("시 발", "씨1발")도 잡도록 비교 전에 걷어낸다.
function squash(s: string): string {
  return s.toLowerCase().replace(/[\s\d.,!?~*_\-^'"`/\\|()[\]{}<>@#$%&+=:;…·]/g, '')
}

// "새끼손가락·등신대·불이 꺼져"처럼 평범한 말과 겹치는 단어는 일부러 뺐다.
const PROFANITY = [
  '씨발', '시발', '씨바', '쌍년', '썅', 'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', '병신', '븅신', '빙신',
  '개새', '개색', '개세끼', '좆', '존나', '졸라', 'ㅈㄴ', '지랄', 'ㅈㄹ',
  '미친놈', '미친년', '미친새', '닥쳐', '엠창', '느금', '니애미', '니애비',
  '염병', '찐따', 'fuck', 'shit', 'bitch',
]
const SAFE_WORDS = ['시발점', '시발역', '시발택시']

// 실명으로 쓰이는 흔한 성씨(닉네임이 "성+이름 2글자"면 실명일 가능성이 높다)
const SURNAMES = '김이박최정강조윤장임한오서신권황안송류유홍전고문양손배백허남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용'

const SCHOOL = /[가-힣]{1,10}(초등학교|중학교|고등학교|여자중학교|여자고등학교)/
const PHONE = /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/
const NAME_INTRO = /(내|제|나의|저의)\s*(진짜\s*)?이름은\s*[가-힣]{2,4}/

/** 욕설이 있으면 안내 문구를, 없으면 null. */
export function findProfanity(text: string): string | null {
  let flat = squash(text)
  for (const w of SAFE_WORDS) flat = flat.split(w).join('')
  const hit = PROFANITY.find((w) => flat.includes(w))
  return hit ? '고운 말로 다시 써 주세요. (욕설·비속어는 남길 수 없어요)' : null
}

/** 실명·학교·연락처 같은 개인정보가 보이면 안내 문구를, 없으면 null. */
export function findPersonalInfo(text: string): string | null {
  if (PHONE.test(text)) return '전화번호는 남길 수 없어요.'
  if (EMAIL.test(text)) return '이메일 주소는 남길 수 없어요.'
  if (SCHOOL.test(text)) return '학교 이름은 남기지 않기로 해요.'
  if (NAME_INTRO.test(text)) return '실명은 남기지 않기로 해요. 닉네임으로 충분해요!'
  return null
}

/**
 * 학생이 쓰는 글(기록·의견 등) 검사. 문제가 있으면 Error를 던진다.
 * 책 속 문장을 그대로 옮기는 경우(quote)엔 소설 대사의 거친 말이 들어갈 수 있어 욕설 검사를 건너뛴다.
 */
export function assertCleanText(text: string, opts: { allowProfanity?: boolean } = {}) {
  const msg = (opts.allowProfanity ? null : findProfanity(text)) ?? findPersonalInfo(text)
  if (msg) throw new Error(msg)
}

/** 닉네임 검사(욕설·개인정보). 문제가 있으면 Error를 던진다. */
export function assertCleanNickname(nickname: string) {
  assertCleanText(nickname)
}

/**
 * "성씨+이름 두 글자" 꼴이면 실명일 수 있다는 안내 문구(아니면 null).
 * "하늘별"처럼 평범한 별명도 걸릴 수 있어 막지 않고 한 번 더 묻는 데만 쓴다.
 */
export function realNameWarning(nickname: string): string | null {
  const n = nickname.trim()
  if (/^[가-힣]{3}$/.test(n) && SURNAMES.includes(n[0])) {
    return `'${n}'은(는) 실명처럼 보여요. 실명 대신 별명을 쓰기로 했어요. 실명이 아니라면 그대로 써도 돼요.`
  }
  return null
}
