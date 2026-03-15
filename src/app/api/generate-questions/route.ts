import { NextResponse } from 'next/server';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Models ordered by speed/reliability — fastest stable model first
const MODELS = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
];

async function callGeminiAPI(model: string, apiKey: string, prompt: string, signal: AbortSignal) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                    responseMimeType: "application/json",
                },
            }),
            signal,
            cache: 'no-store',
        }
    );
    return response;
}

export async function POST(req: Request) {
    try {
        const { goal } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('❌ [generate-questions] Gemini API Key missing');
            return NextResponse.json(
                { error: 'Gemini API key not configured. Add GEMINI_API_KEY to .env.local' },
                { status: 500 }
            );
        }

        const prompt = `You are an expert goal planner.
User Goal: "${goal}"

Create a strict daily plan for this user. To do this effectively, you need to ask clarifying questions.
Generate exactly 5 specific, high-value clarifying questions that will help tailor the plan.

Output strictly valid JSON in this format:
{
  "questions": [
    {
      "id": 1,
      "text": "Question text here?",
      "type": "text" 
    },
    {
      "id": 2,
      "text": "Another question?",
      "type": "choice",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}

For "type", use "choice" if you can suggest concrete options (like experience levels, time input, etc.), otherwise use "text".
Do not include markdown formatting. Just the raw JSON object.`;

        console.log('🚀 [generate-questions] Starting Gemini API call...');
        console.log('🎯 [generate-questions] Goal:', goal);

        // Add timeout to prevent infinite hang
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 20000);

        let lastError: Error | null = null;
        let response: Response | null = null;

        // Try each model once — fail fast, move to next
        for (const model of MODELS) {
            try {
                response = await callGeminiAPI(model, apiKey, prompt, controller.signal);

                if (response.ok) break;

                // If overloaded, try next model immediately
                if (response.status === 503 || response.status === 429) {
                    lastError = new Error(`${model} returned ${response.status}`);
                    continue;
                }

                // Other errors - throw immediately
                const errorText = await response.text();
                throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
            } catch (e: unknown) {
                if (e instanceof Error && e.name === 'AbortError') throw e;
                lastError = e instanceof Error ? e : new Error(String(e));
            }
        }

        clearTimeout(timeoutId);

        if (!response?.ok) {
            throw lastError || new Error('All models failed');
        }

        const result = await response.json();
        const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            console.error('❌ [generate-questions] No content in Gemini response:', result);
            throw new Error('No content in Gemini response');
        }

        // Clean up potentially dirty JSON
        const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

        let data;
        try {
            data = JSON.parse(cleanedContent);
            console.log('✅ [generate-questions] Parsed', data.questions?.length, 'questions');
        } catch (e) {
            console.error('❌ [generate-questions] JSON Parse Error:', e);
            console.error('Raw Content:', content);
            throw new Error('Failed to parse Gemini response as JSON');
        }

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('❌ [generate-questions] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate questions', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
