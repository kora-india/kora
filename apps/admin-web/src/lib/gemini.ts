import { logger } from "@schoolos/logger";

export interface AiTimetableRequest {
  className: string;
  sectionName: string;
  daysOfWeek: number[]; // 1 = Monday, 6 = Saturday
  periods: {
    periodNumber: number;
    name: string;
    startTime: string;
    endTime: string;
    isBreak: boolean;
  }[];
  subjects: {
    subjectName: string;
    periodsPerWeek: number;
    teacherId?: string | null;
    teacherName?: string | null;
    room?: string | null;
  }[];
  teacherCommitments?: {
    teacherId: string;
    teacherName?: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    busyWith: string;
  }[];
  customPrompt?: string;
}

export interface AiDraftSlot {
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
}

export interface AiTimetableResponse {
  slots: AiDraftSlot[];
  rationale: string;
}

const DAY_MAP: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/**
 * Calls Google Gemini API (gemini-3.6-flash) with structured JSON output
 * to generate a pedagogical, smart schedule draft according to admin constraints.
 */
export async function generateAiScheduleDraft(
  request: AiTimetableRequest,
): Promise<AiTimetableResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment.",
    );
  }

  const configuredModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const candidateModels = Array.from(
    new Set(
      [
        configuredModel,
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-3.7-flash",
      ].filter(Boolean),
    ),
  );

  const teachablePeriods = request.periods.filter((p) => !p.isBreak);
  const activeDays = request.daysOfWeek.map((d) => ({
    dayNumber: d,
    dayName: DAY_MAP[d] || `Day ${d}`,
  }));

  const systemInstruction = `You are an elite academic timetable scheduler for K-12 schools.
Your goal is to produce an optimal, pedagogical weekly class schedule in structured JSON format.

CRITICAL HARD CONSTRAINTS:
1. Schedule periods ONLY on the allowed days: ${JSON.stringify(activeDays)}.
2. Schedule periods ONLY in the provided non-break slots: ${JSON.stringify(
    teachablePeriods.map((p) => ({
      periodNumber: p.periodNumber,
      name: p.name,
      time: `${p.startTime} - ${p.endTime}`,
    })),
  )}.
3. NEVER schedule any class during break periods.
4. Each subject MUST fulfill its requested periods per week as closely as possible.
5. TEACHER CONFLICTS: A teacher CANNOT be in two places at once. If a teacher has existing commitments, DO NOT schedule them during those slots:
${JSON.stringify(request.teacherCommitments || [])}
6. No duplicate subject in the same section at the exact same day and time.

PEDAGOGICAL BEST PRACTICES:
- Distribute difficult subjects (e.g. Mathematics, Science) evenly throughout the week.
- Prefer placing high-focus cognitive subjects in early/morning periods.
- Distribute practicals, PE, and arts appropriately.
- If the administrator provided custom instructions, adhere to them with high priority.

RESPONSE JSON FORMAT:
You MUST respond with valid JSON adhering to this exact schema:
{
  "slots": [
    {
      "dayOfWeek": 1,
      "periodNumber": 1,
      "startTime": "08:00",
      "endTime": "08:45",
      "subjectName": "Mathematics",
      "room": "Room 101"
    }
  ],
  "rationale": "2-3 sentences explaining your pedagogical allocation strategy and how you met the constraints."
}`;

  const promptContent = `Target Class: ${request.className} - Section ${request.sectionName}
Available Days: ${activeDays.map((d) => `${d.dayName} (${d.dayNumber})`).join(", ")}

Teachable Periods:
${teachablePeriods.map((p) => `Period ${p.periodNumber} (${p.name}): ${p.startTime} to ${p.endTime}`).join("\n")}

Subjects to Schedule (Quotas):
${request.subjects
  .map(
    (s) =>
      `- ${s.subjectName}: ${s.periodsPerWeek} periods/week (Teacher: ${s.teacherName || "Unassigned"}, Room: ${s.room || "Regular Classroom"})`,
  )
  .join("\n")}

${
  request.customPrompt
    ? `ADMINISTRATOR CUSTOM INSTRUCTIONS:
"${request.customPrompt}"`
    : "No custom instructions provided; apply standard high-quality pedagogical distribution."
}

Generate the full weekly timetable in pure JSON.`;

  let lastError: Error | null = null;

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        logger.info({
          msg: "Dispatching AI Timetable request to Gemini",
          model,
          attempt: attempt + 1,
          class: `${request.className}-${request.sectionName}`,
          subjectCount: request.subjects.length,
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptContent }],
              },
            ],
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2, // Low temperature for deterministic constraint satisfaction
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          const status = response.status;
          lastError = new Error(
            `Gemini AI (${model}) failed (${status}): ${errText.slice(0, 150)}`,
          );

          // 503 (temporarily unavailable / high demand) or 429 (rate limit) -> retry with backoff
          if (status === 503 || status === 429) {
            logger.warn({
              msg: "Gemini capacity spike or rate limit hit, backing off",
              model,
              status,
              attempt: attempt + 1,
            });
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 1500));
              continue; // retry this model
            }
          }

          // If not 503/429 or retries exhausted for this model, break out to try next candidate model
          break;
        }

        const result = await response.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          lastError = new Error(
            `Gemini (${model}) returned an empty response candidate.`,
          );
          break;
        }

        try {
          const parsed = JSON.parse(rawText) as AiTimetableResponse;
          return {
            slots: parsed.slots || [],
            rationale:
              parsed.rationale ||
              `Timetable intelligently drafted by Gemini AI (${model}) with balanced pedagogical distribution.`,
          };
        } catch (parseErr: any) {
          logger.error({
            msg: "Failed to parse Gemini timetable JSON",
            model,
            rawText,
            parseErr,
          });
          lastError = new Error(
            `Failed to parse AI response from ${model} into timetable format.`,
          );
          break;
        }
      } catch (err: any) {
        lastError = err;
        logger.warn({
          msg: "Gemini network/request error",
          model,
          attempt: attempt + 1,
          error: err.message,
        });
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "All Gemini AI models were temporarily busy or unavailable. Please try again shortly.",
    )
  );
}
