import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/firebase/admin'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

type Ctx = { params: Promise<{ campaignId: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = await params
    const { wordLimit, tone, emotion } = await request.json()

    console.log('🤖 Generating AI description for campaign:', campaignId)

    const ref = db
      .collection('users')
      .doc(userId)
      .collection('campaigns')
      .doc(campaignId)

    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const data = snap.data() || {}
    const originalDescription = data.description || ''
    const title = data.title || ''
    const onboarding = data.onboarding || {}

    const prompt = `You are an expert marketing copywriter specializing in outreach campaigns.

Your task: Rewrite the following campaign description to be more compelling and effective for marketing outreach.

**Original Description:**
"${originalDescription}"

**Campaign Title:**
"${title}"

**Onboarding Context:**
${JSON.stringify(onboarding, null, 2)}

**Constraints:**
- Tone: ${tone || 'professional and friendly'}
- Emotion to evoke: ${emotion || 'trust and excitement'}
- Word limit: ${wordLimit || 200} words maximum
- Make it persuasive and action-oriented
- Keep the core message but enhance it

**Output:**
Return ONLY the refined description text, no markdown, no headings, no extra formatting.`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const aiDescription = result.response.text()

    console.log('✅ AI description generated, saving to Firestore...')

    await ref.set(
      {
        aiDescription,
        previewText: aiDescription,
        updatedAt: new Date(),
      },
      { merge: true }
    )

    console.log('💾 Saved to Firestore')

    return NextResponse.json({ success: true, aiDescription })
  } catch (error) {
    console.error('❌ Description AI error:', error)
    return NextResponse.json(
      { error: 'Failed to generate description' },
      { status: 500 }
    )
  }
}
