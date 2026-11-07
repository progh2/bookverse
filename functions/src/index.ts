import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'

initializeApp()
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 })

const db = getFirestore()

// src/types.ts의 GENRE_COLORS 키와 동일하게 유지할 것
const GENRES = ['소설', '시', '에세이', '인문', '과학', '역사', '기타'] as const

const DAILY_CALL_CAP = 300

function kstDateString(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function assertClassCode(classCode: unknown): asserts classCode is string {
  if (typeof classCode !== 'string' || !/^[A-Z0-9]{6}$/i.test(classCode)) {
    throw new HttpsError('invalid-argument', 'INVALID_CLASS_CODE')
  }
}

/**
 * 학급에 저장된 OpenAI 키를 꺼내고 하루 호출 횟수를 1 늘린다(상한 넘으면 거부).
 * 키는 이 함수(Admin SDK) 안에서만 읽고 응답에는 절대 포함하지 않는다.
 * 학생은 Firebase Auth가 없어 호출 자체는 인증 없이 들어오므로, 학급당 상한으로 비용 폭주를 막는다.
 */
async function takeQuota(classCode: string): Promise<string> {
  const secretRef = db.doc(`classes/${classCode}/secrets/openai`)
  const secretSnap = await secretRef.get()
  const apiKey = secretSnap.exists ? (secretSnap.data()?.apiKey as string | undefined) : undefined
  if (!apiKey) throw new HttpsError('failed-precondition', 'NO_KEY')

  const today = kstDateString()
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(secretRef)
    const data = snap.data() ?? {}
    const count = data.lastCallDate === today ? ((data.dailyCallCount as number) ?? 0) : 0
    if (count >= DAILY_CALL_CAP) return false
    tx.update(secretRef, { dailyCallCount: count + 1, lastCallDate: today, lastUsedAt: FieldValue.serverTimestamp() })
    return true
  })
  if (!allowed) throw new HttpsError('resource-exhausted', 'DAILY_CAP_REACHED')
  return apiKey
}

async function askOpenAiJson(apiKey: string, prompt: string, maxTokens: number): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) throw new HttpsError('internal', `OPENAI_ERROR_${res.status}`)
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return JSON.parse(json.choices?.[0]?.message?.content ?? '{}')
}

function pickGenre(value: unknown): string {
  return GENRES.includes(value as (typeof GENRES)[number]) ? (value as string) : '기타'
}

function pickKeywords(value: unknown): string[] {
  return Array.isArray(value) ? value.slice(0, 3).map(String) : []
}

interface GenerateBookTagsInput {
  classCode: string
  title: string
  author?: string
  quote?: string
}

/** 책을 등록할 때 장르 1개·키워드 3개를 정한다. */
export const generateBookTags = onCall<GenerateBookTagsInput>(async (request) => {
  const { classCode, title, author, quote } = request.data ?? ({} as GenerateBookTagsInput)
  assertClassCode(classCode)
  if (!title || title.trim().length === 0) throw new HttpsError('invalid-argument', 'INVALID_TITLE')

  const apiKey = await takeQuota(classCode)
  try {
    const parsed = await askOpenAiJson(apiKey, [
      `다음 책 정보를 보고 장르 1개와 키워드 3개를 정해줘.`,
      `장르는 반드시 다음 중 하나여야 해: ${GENRES.join(', ')}.`,
      `책 제목: ${title}`,
      author ? `저자: ${author}` : '',
      quote ? `인상 깊은 문장: ${quote}` : '',
      `JSON으로만 답해: {"genre": "장르", "keywords": ["키워드1", "키워드2", "키워드3"]}`,
    ].filter(Boolean).join('\n'), 150)
    return { genre: pickGenre(parsed.genre), keywords: pickKeywords(parsed.keywords) }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    throw new HttpsError('internal', 'AI_CALL_FAILED')
  }
})

interface SuggestBookInfoInput {
  classCode: string
  title: string
}

/**
 * 학생이 책 제목을 입력하는 동안 호출된다. 제목과 일치하는 실제 책 후보(제목+저자)를 최대 3개,
 * 그리고 장르·키워드를 추천한다. AI는 없는 책을 지어낼 수 있으므로 확실하지 않으면 후보를 비우게 하고,
 * 화면에서도 "추천"으로만 보여주고 학생이 직접 고르거나 고칠 수 있게 한다.
 */
export const suggestBookInfo = onCall<SuggestBookInfoInput>(async (request) => {
  const { classCode, title } = request.data ?? ({} as SuggestBookInfoInput)
  assertClassCode(classCode)
  const trimmed = (title ?? '').trim()
  if (trimmed.length < 2 || trimmed.length > 80) throw new HttpsError('invalid-argument', 'INVALID_TITLE')

  const apiKey = await takeQuota(classCode)
  try {
    const parsed = await askOpenAiJson(apiKey, [
      `한국 중고등학생이 독서 기록에 책 제목을 입력하고 있어. 입력값: "${trimmed}"`,
      `실제로 출간된 책 중에서 이 제목과 같거나 아주 비슷한 책을 최대 3개 골라 정확한 제목과 저자를 알려줘.`,
      `번역서는 한국에서 쓰는 저자 표기로 써줘(예: 앙투안 드 생텍쥐페리). 확실히 알지 못하는 책은 넣지 말고, 하나도 확실하지 않으면 candidates를 빈 배열로 둬.`,
      `가장 그럴듯한 책 기준으로 장르 1개(반드시 다음 중 하나: ${GENRES.join(', ')})와 내용 키워드 3개도 정해줘.`,
      `JSON으로만 답해: {"candidates":[{"title":"제목","author":"저자"}],"genre":"장르","keywords":["키워드1","키워드2","키워드3"]}`,
    ].join('\n'), 300)

    const candidates = Array.isArray(parsed.candidates)
      ? (parsed.candidates as { title?: unknown; author?: unknown }[])
          .filter((c) => typeof c?.title === 'string' && typeof c?.author === 'string' && c.title && c.author)
          .slice(0, 3)
          .map((c) => ({ title: String(c.title).slice(0, 80), author: String(c.author).slice(0, 40) }))
      : []
    return { candidates, genre: pickGenre(parsed.genre), keywords: pickKeywords(parsed.keywords) }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    throw new HttpsError('internal', 'AI_CALL_FAILED')
  }
})
