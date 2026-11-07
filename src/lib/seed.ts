import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { createClass } from './classes'
import { sha256Hex } from './crypto'
import type { ZodiacSign } from '../types'

interface SeedBook {
  title: string
  author: string
  rating: number
  genre: string
  keywords: string[]
  quote?: string
  quotePage?: string
  reason?: string
  rereadCount?: number
  summary?: string
  feeling?: string
  inquiryQuestion?: string
  isBigStar?: boolean
  bigStarReason?: string
}

interface SeedStudent {
  nickname: string
  zodiac: ZodiacSign
  starDust: number
  books: SeedBook[]
}

// 중학교 2학년 독서 수준을 기준으로 한 가상 데모 데이터. 실제 학생 정보가 아니다.
const DEMO_STUDENTS: SeedStudent[] = [
  {
    nickname: '책벌레고양이', zodiac: 'aries', starDust: 27,
    books: [
      {
        title: '완득이', author: '김려령', rating: 5, genre: '소설', keywords: ['성장', '가족', '유머'],
        quote: '사람은 누구나 자기 몫의 싸움이 있다.', quotePage: '112',
        reason: '국어 선생님이 추천해주셔서 읽기 시작했다.',
        summary: '다문화 가정에서 자란 완득이가 킥복싱을 배우며 세상과 화해해가는 이야기.',
        feeling: '완득이가 아버지를 이해하게 되는 장면에서 울컥했다.',
        isBigStar: true, bigStarReason: '나와 비슷한 고민을 하는 주인공이라 오래 기억에 남았다',
      },
      {
        title: '아몬드', author: '손원평', rating: 4, genre: '소설', keywords: ['감정', '우정', '성장'],
        quote: '나는 감정이라는 단어를 이해하지 못했다.',
        reason: '친구가 재미있다고 추천해줬다.',
      },
    ],
  },
  {
    nickname: '달빛소년', zodiac: 'taurus', starDust: 19,
    books: [
      {
        title: '어린왕자', author: '앙투안 드 생텍쥐페리', rating: 5, genre: '인문', keywords: ['우정', '순수', '철학'],
        quote: '정말 중요한 것은 눈에 보이지 않아.',
        summary: '사막에 불시착한 비행사가 어린왕자를 만나 삶의 의미를 되돌아보는 이야기.',
        feeling: '장미와 여우 이야기가 가장 기억에 남는다.',
      },
    ],
  },
  {
    nickname: '문장수집가', zodiac: 'gemini', starDust: 41,
    books: [
      {
        title: '소나기', author: '황순원', rating: 5, genre: '소설', keywords: ['첫사랑', '순수', '단편'],
        quote: '소녀는 개울가에서 하얀 조약돌을 집어 들었다.', quotePage: '3',
        reason: '국어 교과서에 실려 있어서 읽었다.',
        summary: '소년과 소녀의 짧고 순수한 첫사랑을 그린 단편 소설.',
        feeling: '마지막 장면이 너무 슬퍼서 한참 멍했다.',
        inquiryQuestion: '왜 작가는 결말을 직접 말하지 않고 아버지의 대사로 암시했을까?',
      },
      {
        title: '우아한 거짓말', author: '김려령', rating: 4, genre: '소설', keywords: ['우정', '학교폭력', '가족'],
        quote: '거짓말에도 우아한 거짓말이 있다.',
        reason: '영화로 먼저 보고 원작이 궁금해졌다.',
        rereadCount: 1,
      },
      {
        title: '체리새우: 비밀글입니다', author: '황영미', rating: 4, genre: '소설', keywords: ['우정', '학교', '사춘기'],
        quote: '친구 사이에도 거리가 필요할 때가 있다.',
      },
    ],
  },
  {
    nickname: '초코우유', zodiac: 'cancer', starDust: 9,
    books: [
      { title: '해리포터와 마법사의 돌', author: '조앤 K. 롤링', rating: 5, genre: '소설', keywords: ['판타지', '모험', '우정'] },
    ],
  },
  {
    nickname: '반짝이는별', zodiac: 'leo', starDust: 55,
    books: [
      {
        title: '긴긴밤', author: '루리', rating: 5, genre: '소설', keywords: ['가족', '생명', '모험'],
        quote: '살아남는다는 것, 그것이 우리가 할 수 있는 전부였다.',
        reason: '표지가 예뻐서 도서관에서 골랐다.',
        summary: '마지막 흰코뿔소와 펭귄이 함께 바다를 찾아가는 여정을 그린 이야기.',
        feeling: '종이 멸종에 대해 처음으로 깊이 생각해봤다.',
        inquiryQuestion: '인간이 아닌 동물의 시선으로 쓴 이야기는 왜 더 마음을 움직일까?',
        isBigStar: true, bigStarReason: '올해 읽은 책 중 가장 많이 울었던 책',
      },
      {
        title: '모모', author: '미하엘 엔데', rating: 5, genre: '인문', keywords: ['시간', '철학', '우정'],
        quote: '시간을 아낀다면서 사람들은 오히려 시간을 잃어버렸다.',
        reason: '선생님이 추천 도서 목록에 넣어주셨다.',
        summary: '시간 도둑들에게서 사람들의 시간을 되찾아주는 소녀 모모의 이야기.',
        feeling: '나도 휴대폰을 너무 많이 보는 것 같아 반성했다.',
        rereadCount: 1,
      },
    ],
  },
  {
    nickname: '밤하늘여행자', zodiac: 'virgo', starDust: 23,
    books: [
      {
        title: '코스모스', author: '칼 세이건', rating: 4, genre: '과학', keywords: ['우주', '과학', '탐구'],
        quote: '우리는 모두 별의 물질로 이루어져 있다.',
        reason: '천문 동아리 추천 도서였다.',
        summary: '우주의 기원부터 생명의 탄생까지를 과학적으로 풀어낸 교양서.',
      },
    ],
  },
  {
    nickname: '조용한폭풍', zodiac: 'libra', starDust: 33,
    books: [
      {
        title: '페인트', author: '이희영', rating: 5, genre: '소설', keywords: ['가족', '선택', '사회'],
        quote: '부모를 직접 고를 수 있다면 어떨까.', quotePage: '45',
        reason: 'SF적인 설정이 궁금해서 골랐다.',
        summary: '국가가 양육하는 미래, 아이들이 부모를 면접으로 고르는 센터의 이야기.',
        feeling: '가족의 의미에 대해 다시 생각하게 됐다.',
      },
      {
        title: '나미야 잡화점의 기적', author: '히가시노 게이고', rating: 4, genre: '소설', keywords: ['치유', '시간', '편지'],
        quote: '고민 상담 편지함에 답장이 도착했다.',
        reason: '친구가 울면서 추천해준 책이다.',
      },
    ],
  },
  {
    nickname: '민트초코', zodiac: 'scorpio', starDust: 6,
    books: [
      { title: '방관자', author: '제임스 프렐러', rating: 3, genre: '소설', keywords: ['학교폭력', '용기', '방관'] },
    ],
  },
  {
    nickname: '책읽는늑대', zodiac: 'sagittarius', starDust: 48,
    books: [
      {
        title: '하늘과 바람과 별과 시', author: '윤동주', rating: 5, genre: '시', keywords: ['자아성찰', '서정시', '일제강점기'],
        quote: '죽는 날까지 하늘을 우러러 한 점 부끄럼이 없기를.',
        reason: '국어 시간에 서시를 배우고 시집 전체가 궁금해졌다.',
        summary: '식민지 시대 청년의 내면을 서정적으로 담아낸 시집.',
        feeling: '같은 또래였을 윤동주를 생각하니 마음이 무거웠다.',
        inquiryQuestion: '윤동주는 왜 부끄러움이라는 감정을 그렇게 자주 노래했을까?',
      },
      {
        title: '안네의 일기', author: '안네 프랑크', rating: 5, genre: '역사', keywords: ['전쟁', '기록', '성장'],
        quote: '그럼에도 불구하고 나는 사람들이 진심으로 선하다고 믿어요.',
        reason: '역사 수업에서 2차 세계대전을 배우고 찾아 읽었다.',
        summary: '나치 점령기 은신처에서 2년간 쓴 유대인 소녀의 실제 일기.',
        feeling: '같은 나이의 소녀가 겪은 일이라 더 생생하게 느껴졌다.',
      },
    ],
  },
  {
    nickname: '구름위산책', zodiac: 'pisces', starDust: 15,
    books: [
      {
        title: '꽃들에게 희망을', author: '트리나 폴러스', rating: 4, genre: '인문', keywords: ['성장', '우화', '희망'],
        quote: '애벌레는 나비가 되기 위해 기둥을 올라야 했다.',
        reason: '표지가 예뻐서 학교 도서관에서 빌렸다.',
      },
      {
        title: '유진과 유진', author: '이금이', rating: 4, genre: '소설', keywords: ['치유', '가족', '트라우마'],
        quote: '같은 이름을 가진 두 아이의 다른 삶.',
      },
    ],
  },
]

/** 교사 관리자 페이지의 '데모 데이터 만들기' 버튼에서 호출. 중2 수준 가상 학급을 통째로 생성한다. */
export async function seedDemoClass(teacherUid: string): Promise<string> {
  const classRoom = await createClass(teacherUid, '2학년 3반 (데모)')
  const code = classRoom.code
  const demoPinHash = await sha256Hex('0000')

  for (const s of DEMO_STUDENTS) {
    // 전역 계정(로그인용) + 학급 멤버십을 함께 만든다. 데모 닉네임은 매번 새 계정으로 만들어지므로
    // "데모 학급 만들기"를 여러 번 누르면 같은 닉네임의 계정이 여러 개 생길 수 있다(해커톤 범위).
    const accountRef = await addDoc(collection(db, 'students'), {
      nickname: s.nickname,
      pinHash: demoPinHash,
      classCodes: [code],
      createdAt: serverTimestamp(),
    })

    const studentRef = doc(db, 'classes', code, 'students', accountRef.id)
    await setDoc(studentRef, {
      classCode: code,
      nickname: s.nickname,
      constellationTemplate: s.zodiac,
      starDust: 0,
      dailyEarned: 0,
      lastEarnDate: '',
      createdAt: serverTimestamp(),
    })

    for (const b of s.books) {
      await addDoc(collection(db, 'classes', code, 'students', studentRef.id, 'books'), {
        classCode: code,
        studentId: studentRef.id,
        title: b.title,
        author: b.author,
        rating: b.rating,
        genre: b.genre,
        genreIsAiGuess: true,
        keywords: b.keywords,
        quote: b.quote ?? null,
        quotePage: b.quotePage ?? null,
        reason: b.reason ?? null,
        rereadCount: b.rereadCount ?? null,
        summary: b.summary ?? null,
        feeling: b.feeling ?? null,
        inquiryQuestion: b.inquiryQuestion ?? null,
        isBigStar: b.isBigStar ?? false,
        bigStarReason: b.bigStarReason ?? null,
        createdAt: serverTimestamp(),
      })
    }

    // 시연용으로 보이도록 누적 별가루를 한 번에 세팅(일일 상한 로직은 우회)
    await updateDoc(studentRef, { starDust: s.starDust })
  }

  return code
}
