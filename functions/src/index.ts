import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'

initializeApp()
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 })

const db = getFirestore()

// src/types.ts의 GENRE_COLORS 키와 동일하게 유지할 것
const GENRES = ['소설', '시', '에세이', '인문', '과학', '역사', '기타'] as const

const DAILY_CALL_CAP = 200

function kstDateString(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

interface GenerateBookTagsInput {
  classCode: string
  title: string
  author?: string
  quote?: string
}

/**
 * 학생이 책을 등록할 때 호출된다(인증 없음 — 학생은 Firebase Auth를 쓰지 않으므로).
 * 교사가 저장해둔 OpenAI 키는 이 함수(Admin SDK) 안에서만 읽고, 응답에는 절대 포함하지 않는다.
 * 악용/비용 폭주를 막기 위해 학급당 하루 호출 횟수에 상한을 둔다.
 */
export const generateBookTags = onCall<GenerateBookTagsInput>(async (request) => {
  const { classCode, title, author, quote } = request.data ?? ({} as GenerateBookTagsInput)

  if (!classCode || !/^[A-Z0-9]{6}$/i.test(classCode)) {
    throw new HttpsError('invalid-argument', 'INVALID_CLASS_CODE')
  }
  if (!title || title.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'INVALID_TITLE')
  }

  const secretRef = db.doc(`classes/${classCode}/secrets/openai`)
  const secretSnap = await secretRef.get()
  const apiKey = secretSnap.exists ? (secretSnap.data()?.apiKey as string | undefined) : undefined
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'NO_KEY')
  }

  const today = kstDateString()
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(secretRef)
    const data = snap.data() ?? {}
    const lastDate = data.lastCallDate as string | undefined
    const count = lastDate === today ? ((data.dailyCallCount as number) ?? 0) : 0
    if (count >= DAILY_CALL_CAP) return false
    tx.update(secretRef, { dailyCallCount: count + 1, lastCallDate: today, lastUsedAt: FieldValue.serverTimestamp() })
    return true
  })
  if (!allowed) {
    throw new HttpsError('resource-exhausted', 'DAILY_CAP_REACHED')
  }

  try {
    const prompt = [
      `다음 책 정보를 보고 장르 1개와 키워드 3개를 정해줘.`,
      `장르는 반드시 다음 중 하나여야 해: ${GENRES.join(', ')}.`,
      `책 제목: ${title}`,
      author ? `저자: ${author}` : '',
      quote ? `인상 깊은 문장: ${quote}` : '',
      `JSON으로만 답해: {"genre": "장르", "keywords": ["키워드1", "키워드2", "키워드3"]}`,
    ].filter(Boolean).join('\n')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 150,
      }),
    })

    if (!res.ok) {
      throw new HttpsError('internal', `OPENAI_ERROR_${res.status}`)
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = json.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content) as { genre?: string; keywords?: string[] }

    const genre = GENRES.includes(parsed.genre as (typeof GENRES)[number]) ? parsed.genre! : '기타'
    const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 3).map(String) : []

    return { genre, keywords }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    throw new HttpsError('internal', 'AI_CALL_FAILED')
  }
})
