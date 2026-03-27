import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    const { topics, sourceMaterial, questionCount = 5, difficulty = "mixed" } = body;

    if ((!topics || topics.length === 0) && !sourceMaterial) {
      return NextResponse.json(
        { error: "Ingen källa angiven för quiz-generering" },
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

    let prompt = "";
    if (sourceMaterial) {
      prompt = `
Du är en stenhård expertpedagog. Din uppgift är att skapa ett quiz EXAKT och ENBART baserat på det bifogade materialet.

INSTRUKTIONER:
- Du MÅSTE skapa exakt ${questionCount} flervalsfrågor (4 svarsalternativ vardera) hämtade direkt från den bifogade filen.
- Använd inte extern kunskap som inte nämns i filen. Om dokumentet är kort, gör frågor om detaljer i texten.
- ${difficultyInstruction}
- Alla frågor och svar ska vara på svenska.
- Inkludera en kort förklaring till varje rätt svar som förklarar varför det är rätt enligt dokumentet.
- Ange vilken betygsnivå (E, C eller A) varje fråga testar.
- Svara EXAKT i nedanstående JSON-struktur.
`;
    } else {
      prompt = `
Du är en svensk gymnasielärare. Generera ett quiz baserat på följande information.

ÄMNESPLAN (Centralt Innehåll):
${curriculumContext}

ELEVEN HAR VALT FÖLJANDE STUDIEÄMNEN TILL DETTA QUIZ:
${topics.join(", ")}

INSTRUKTIONER:
- Generera exakt ${questionCount} flervalsfrågor (4 svarsalternativ vardera).
- ${difficultyInstruction}
- Varje fråga måste vara tydligt kopplad till ämnesplanens centrala innehåll.
- Alla frågor och svar ska vara på svenska.
- Inkludera en kort förklaring till varje rätt svar som hjälper eleven att förstå principen.
- Ange vilken betygsnivå (E, C eller A) varje fråga testar.
`;
    }

    prompt += `
Svara EXAKT i denna JSON-struktur utan Markdown-kodblock eller varningar:
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

    const model = getGeminiModel("gemini-3-flash-preview");
    
    let result;
    if (sourceMaterial) {
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: sourceMaterial.base64Data,
            mimeType: sourceMaterial.mimeType || "application/pdf"
          }
        }
      ]);
    } else {
      result = await model.generateContent(prompt);
    }
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
