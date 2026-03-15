import { NextResponse } from 'next/server';

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
          maxOutputTokens: 8192,
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
    const { plan, feedback } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const prompt = `You are an expert personalized learning coach.

Current Plan JSON:
${JSON.stringify(plan)}

User Feedback: "${feedback}"

Task: Modify the Current Plan based on the User Feedback. Keep the same structure.
If the user wants to remove something, remove it. If they want to add something, add it at the appropriate place.
If they want to change the schedule (e.g., "no weekends"), adjust the days accordingly.

Output strict JSON with this structure (same as input):
{
  "title": "Title",
  "totalDays": 30,
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Theme",
      "days": [
        {
          "dayNumber": 1,
          "focus": "Focus",
          "tasks": [
            { "id": "t1", "text": "Task", "completed": false }
          ]
        }
      ]
    }
  ]
}

Do not include markdown or other formatting. Just raw JSON.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    let lastError: Error | null = null;
    let response: Response | null = null;

    // Try each model once — fail fast, move to next
    for (const model of MODELS) {
      try {
        response = await callGeminiAPI(model, apiKey, prompt, controller.signal);

        if (response.ok) break;

        if (response.status === 503 || response.status === 429) {
          lastError = new Error(`${model} returned ${response.status}`);
          continue;
        }

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
      throw new Error('No content in Gemini response');
    }

    const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleanedContent);
    } catch {
      throw new Error('Failed to parse Gemini response');
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error modifying plan:', error);
    return NextResponse.json(
      { error: 'Failed to modify plan', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
