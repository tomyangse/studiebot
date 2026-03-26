import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    const { topics, questionCount = 5, difficulty = "mixed" } = body;

    if (!topics || topics.length === 0) {
      return NextResponse.json(
        { error: "Inga ämnen angivna för quiz-generering" },
        { status: 400 }
      );
    }

    // Build curriculum context
    const curriculumContext = HISTORIA_1B_CURRICULUM.centralContent
      .map(
        (cc) =>
          `- ${cc.title}: ${cc.description}\n  Betyg E: ${cc.gradeE}\n  Betyg C: ${cc.gradeC}\n  Betyg A: ${cc.gradeA}`
      )
      .join("\n\n");

    const difficultyInstruction =
      difficulty === "E"
        ? "Skapa frågor på E-nivå: grundläggande förståelse, enkla fakta, definitioner."
        : difficulty === "C"
        ? "Skapa frågor på C-nivå: analys, jämförelse, förklara samband."
        : difficulty === "A"
        ? "Skapa frågor på A-nivå: kritiskt tänkande, nyanserade resonemang, värdering ur flera perspektiv."
        : "Skapa en blandning av frågor: 2 på E-nivå, 2 på C-nivå, 1 på A-nivå.";

    const prompt = `
Du är en svensk gymnasielärare i Historia 1b. Generera ett quiz baserat på följande information.

ÄMNESPLAN (Centralt Innehåll):
${curriculumContext}

ELEVENS STUDIEÄMNEN:
${topics.join(", ")}

INSTRUKTIONER:
- Generera exakt ${questionCount} flervalsfrågor (4 svarsalternativ vardera).
- ${difficultyInstruction}
- Varje fråga måste vara tydligt kopplad till ämnesplanens centrala innehåll.
- Alla frågor och svar ska vara på svenska.
- Inkludera en kort förklaring till varje rätt svar som hjälper eleven att förstå principen.
- Ange vilken betygsnivå (E, C eller A) varje fråga testar.

Svara EXAKT i denna JSON-struktur utan Markdown-kodblock:
{
  "quizTitle": "Quiz-titel",
  "questions": [
    {
      "id": 1,
      "question": "Frågetext?",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "Förklaring varför A är rätt...",
      "gradeLevel": "E|C|A",
      "curriculumPointId": "cc1|cc2|cc3|cc4|cc5"
    }
  ]
}
`;

    const model = getGeminiModel("gemini-2.5-flash");
    const result = await model.generateContent(prompt);
    let textResponse = result.response.text();
    textResponse = textResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const quizData = JSON.parse(textResponse);

    return NextResponse.json({ success: true, quiz: quizData });
  } catch (error) {
    console.error("Quiz Generation Error:", error);
    return NextResponse.json(
      { error: "Kunde inte generera quiz", details: error.message },
      { status: 500 }
    );
  }
}
