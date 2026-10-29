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

  return generateGeminiJson({
    label: "timetable",
    logContext: {
      class: `${request.className}-${request.sectionName}`,
      subjectCount: request.subjects.length,
    },
    systemInstruction,
    prompt: promptContent,
    temperature: 0.2, // Low temperature for deterministic constraint satisfaction
    parse: (json, model) => {
      const parsed = json as AiTimetableResponse;
      return {
        slots: parsed.slots || [],
        rationale:
          parsed.rationale ||
          `Timetable intelligently drafted by Gemini AI (${model}) with balanced pedagogical distribution.`,
      };
    },
  });
}

/** The configured model first, then the fallbacks tried when it's busy. */
function candidateModels(): string[] {
  const configuredModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  return Array.from(
    new Set(
      [
        configuredModel,
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-3.7-flash",
      ].filter(Boolean),
    ),
  );
}

/**
 * Asks Gemini for JSON and hands it to `parse`. A busy model (503/429) is
 * retried, then the next model is tried; the last error is thrown when none
 * answers. `responseSchema` makes Gemini answer in exactly that shape.
 */
async function generateGeminiJson<T>(options: {
  /** What the answer is, for logs and errors ("timetable"). */
  label: string;
  logContext?: Record<string, unknown>;
  systemInstruction: string;
  prompt: string;
  temperature: number;
  responseSchema?: unknown;
  /** Give up on one request after this long. */
  timeoutMs?: number;
  /** Models to try (default all) and attempts per model (default 2). */
  maxModels?: number;
  attempts?: number;
  parse: (json: unknown, model: string) => T;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment.",
    );
  }

  const attempts = options.attempts ?? 2;
  let lastError: Error | null = null;

  for (const model of candidateModels().slice(0, options.maxModels)) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        logger.info({
          msg: `Dispatching ${options.label} request to Gemini`,
          ...options.logContext,
          model,
          attempt: attempt + 1,
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
                parts: [{ text: options.prompt }],
              },
            ],
            systemInstruction: {
              parts: [{ text: options.systemInstruction }],
            },
            generationConfig: {
              responseMimeType: "application/json",
              temperature: options.temperature,
              ...(options.responseSchema
                ? { responseSchema: options.responseSchema }
                : {}),
            },
          }),
          ...(options.timeoutMs
            ? { signal: AbortSignal.timeout(options.timeoutMs) }
            : {}),
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
            if (attempt < attempts - 1) {
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
          return options.parse(JSON.parse(rawText), model);
        } catch (parseErr: any) {
          logger.error({
            msg: `Failed to parse Gemini ${options.label} JSON`,
            model,
            rawText,
            parseErr,
          });
          lastError = new Error(
            `Failed to parse AI response from ${model} into ${options.label} format.`,
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
        if (attempt < attempts - 1) {
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

/** A spreadsheet column as Gemini sees it: its header and how its values look. */
export interface ImportColumnClue {
  header: string;
  /** From describeColumn: the shape of the values, never the values. */
  description: string;
}

/**
 * Asks Gemini which student field each column fills, for headers the import's
 * own rules couldn't place (other languages, shorthand). Gemini must answer
 * from `fields` or "ignore"; anything else, a header it wasn't asked about,
 * or a field already taken or given twice, is dropped. Returns field per
 * header, null for "ignore".
 */
export async function suggestImportColumns(
  columns: ImportColumnClue[],
  fields: { id: string; label: string }[],
  taken: string[],
): Promise<Record<string, string | null>> {
  const ids = fields.map((f) => f.id);
  const systemInstruction = `You match the columns of a student spreadsheet from an Indian school to the fields of a student record.
Headers may be in English, Hindi or another Indian language, abbreviated ("F/N" is father's name, "Adm" admission) or misspelled.
Each column comes with a description of what its values look like; the values themselves are not shared.

Fields you may answer with (id: meaning):
${fields.map((f) => `- ${f.id}: ${f.label}`).join("\n")}
- ignore: not one of these, or you are unsure

Rules:
- Answer for every column you are given, using exactly its header.
- Use each field at most once, and never one of these, already matched to other columns: ${taken.join(", ") || "none"}.
- Prefer "ignore" over guessing.`;

  const prompt = `Columns:\n${columns
    .map((c) => `- ${JSON.stringify(c.header)}: ${c.description}`)
    .join("\n")}`;

  return generateGeminiJson({
    label: "column matching",
    logContext: { columnCount: columns.length },
    systemInstruction,
    prompt,
    temperature: 0,
    responseSchema: {
      type: "OBJECT",
      properties: {
        columns: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              header: { type: "STRING" },
              field: { type: "STRING", enum: [...ids, "ignore"] },
            },
            required: ["header", "field"],
          },
        },
      },
      required: ["columns"],
    },
    // Someone is waiting on the import dialog: answer fast or not at all.
    timeoutMs: 8000,
    maxModels: 2,
    attempts: 1,
    parse: (json) => {
      const answers = (json as { columns?: unknown }).columns;
      if (!Array.isArray(answers)) throw new Error("No columns in the answer");
      const asked = new Set(columns.map((c) => c.header));
      const used = new Set(taken);
      const result: Record<string, string | null> = {};
      for (const answer of answers as { header?: unknown; field?: unknown }[]) {
        const header = typeof answer?.header === "string" ? answer.header : "";
        if (!asked.has(header) || header in result) continue;
        const field =
          typeof answer.field === "string" &&
          ids.includes(answer.field) &&
          !used.has(answer.field)
            ? answer.field
            : null;
        if (field) used.add(field);
        result[header] = field;
      }
      return result;
    },
  });
}
