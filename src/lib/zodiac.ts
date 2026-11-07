import type { ZodiacSign } from '../types'

// 각 별자리의 마지막 날짜(월, 일). 이 날짜를 넘기면 다음 별자리로 넘어가고,
// 12/22~12/31은 목록에 없으므로 기본값(capricorn)으로 처리한다.
const SIGN_END_DATES: [ZodiacSign, number, number][] = [
  ['capricorn', 1, 19], ['aquarius', 2, 18], ['pisces', 3, 20], ['aries', 4, 19],
  ['taurus', 5, 20], ['gemini', 6, 20], ['cancer', 7, 22], ['leo', 8, 22],
  ['virgo', 9, 22], ['libra', 10, 22], ['scorpio', 11, 21], ['sagittarius', 12, 21],
]

const NAMES_KO: Record<ZodiacSign, string> = {
  aries: '양자리', taurus: '황소자리', gemini: '쌍둥이자리', cancer: '게자리',
  leo: '사자자리', virgo: '처녀자리', libra: '천칭자리', scorpio: '전갈자리',
  sagittarius: '궁수자리', capricorn: '염소자리', aquarius: '물병자리', pisces: '물고기자리',
}

export const ZODIAC_LIST: ZodiacSign[] = Object.keys(NAMES_KO) as ZodiacSign[]

export function zodiacNameKo(sign: ZodiacSign): string {
  return NAMES_KO[sign]
}

/** 월/일로 12궁을 계산한다. 값 자체는 저장하지 않고 호출부에서 결과 별자리만 저장해야 한다. */
export function zodiacFromBirthday(month: number, day: number): ZodiacSign {
  for (const [sign, endMonth, endDay] of SIGN_END_DATES) {
    if (month < endMonth || (month === endMonth && day <= endDay)) return sign
  }
  return 'capricorn' // 12/22 ~ 12/31
}
