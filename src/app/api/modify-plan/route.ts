import { NextResponse } from 'next/server';

// List of models to try, in order of preference
const MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
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

    console.log('🚀 [modify-plan] Starting Gemini API call...');

    // Add timeout to prevent infinite hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    let lastError: Error | null = null;
    let response: Response | null = null;

    // Try each model with retry logic
    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🔄 [modify-plan] Trying ${model} (attempt ${attempt})...`);
          response = await callGeminiAPI(model, apiKey, prompt, controller.signal);

          if (response.ok) {
            console.log(`✅ [modify-plan] Success with ${model}`);
            break;
          }

          if (response.status === 503 || response.status === 429) {
            const errorText = await response.text();
            console.log(`⚠️ [modify-plan] ${model} returned ${response.status}, trying next option...`);
            lastError = new Error(`${model} returned ${response.status}: ${errorText}`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          const errorText = await response.text();
          console.error('❌ [modify-plan] Gemini API Error:', errorText);
          throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'AbortError') throw e;
          lastError = e instanceof Error ? e : new Error(String(e));
          console.log(`⚠️ [modify-plan] Error with ${model}:`, lastError.message);
        }
      }

      if (response?.ok) break;
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

    // Clean up
    const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleanedContent);
      console.log('✅ [modify-plan] Successfully modified plan');
    } catch (e) {
      console.error('JSON Parse Error:', e);
      console.error('Raw Content:', content);
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
