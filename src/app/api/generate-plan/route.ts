import { NextResponse } from 'next/server';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const { goal, answers } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('❌ [generate-plan] Gemini API Key missing');
      return NextResponse.json(
        { error: 'Gemini API key not configured. Add GEMINI_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    const prompt = `You are an expert personalized learning coach.
User Goal: "${goal}"
User Context (Answers to questions): ${JSON.stringify(answers)}

Create a detailed, day-by-day learning/action plan for this user to achieve their goal.
The plan should be broken down into weeks.

Output strict JSON with this structure:
{
  "title": "A short, inspiring title for the plan",
  "totalDays": 30,
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Week 1 Theme",
      "days": [
        {
          "dayNumber": 1,
          "focus": "Day 1 Focus",
          "tasks": [
            { "id": "w1d1t1", "text": "Specific task 1", "completed": false, "type": "task" }
          ]
        }
      ]
    }
  ]
}

Determine the optimal duration for the plan based on the User's Goal and Context. 
- If they specify a time (e.g. "in 2 months"), respect that duration (up to 90 days).
- If no time is specified, default to 30 days.
- "type" should be "task" for actionable items.

Ensure tasks are actionable and specific.`;

    console.log('🚀 [generate-plan] Starting Gemini API call...');
    console.log('🎯 [generate-plan] Goal:', goal);

    // Add timeout to prevent infinite hang
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ [generate-plan] Request timed out after 90s');
      controller.abort();
    }, 90000);

    let response: Response | null = null;
    const errors: string[] = [];

    // Try each model with retry logic
    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🔄 [generate-plan] Trying ${model} (attempt ${attempt})...`);
          response = await callGeminiAPI(model, apiKey, prompt, controller.signal);

          if (response.ok) {
            console.log(`✅ [generate-plan] Success with ${model}`);
            break;
          }

          // If 503 (overloaded), wait and retry or try next model
          const errorText = await response.text();
          if (response.status === 503 || response.status === 429) {
            console.log(`⚠️ [generate-plan] ${model} returned ${response.status}, trying next option...`);
            errors.push(`${model} (503/429): ${errorText}`);
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          // Other errors - throw immediately
          console.error('❌ [generate-plan] Gemini API Error:', errorText);
          throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'AbortError') throw e;
          // Capture the error but continue to the next model/attempt
          const message = e instanceof Error ? e.message : String(e);
          console.log(`⚠️ [generate-plan] Error with ${model}:`, message);
          errors.push(`${model}: ${message}`);
        }
      }

      if (response?.ok) break;
    }

    clearTimeout(timeoutId);

    if (!response?.ok) {
      throw new Error(`All models failed. Details: ${errors.join(' | ')}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error('❌ [generate-plan] No content in Gemini response:', result);
      throw new Error('No content in Gemini response');
    }

    // Clean up potentially dirty JSON
    const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleanedContent);
      console.log('✅ [generate-plan] Successfully parsed plan:', data.title);
    } catch (e) {
      console.error('❌ [generate-plan] JSON Parse Error:', e);
      console.error('Raw Content:', content);
      throw new Error('Failed to parse Gemini response as JSON');
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('❌ [generate-plan] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate plan', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
