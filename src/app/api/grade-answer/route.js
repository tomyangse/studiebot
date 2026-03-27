import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";

export const maxDuration = 30;

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      studentAnswer, 
      modelAnswer, 
      question, 
      questionType,
      gradeLevel,
      gradingCriteria,
      maxPoints 
    } = body;

    if (!studentAnswer || !modelAnswer || !question) {
      return NextResponse.json({ error: "Saknade fält" }, { status: 400 });
    }

    const prompt = `
Du är en erfaren svensk gymnasielärare som rättar prov enligt Skolverkets bedömningskriterier.

FRÅGA: ${question}
FRÅGETYP: ${questionType}
BETYGSNIVÅ: ${gradeLevel}
MAX POÄNG: ${maxPoints}

MODELLSVAR (det förväntade svaret):
${modelAnswer}

BEDÖMNINGSKRITERIER:
${gradingCriteria}

ELEVENS SVAR:
"${studentAnswer}"

BEDÖMNINGSINSTRUKTIONER:
- Bedöm elevens svar mot modellsvaret och kriterierna.
- Ge poäng från 0 till ${maxPoints}.
- Poängsättning:
  * 0 poäng: Helt fel, irrelevant eller tomt svar
  * ${Math.ceil(maxPoints * 0.4)} poäng: Grundläggande förståelse men med brister (E-nivå)
  * ${Math.ceil(maxPoints * 0.7)} poäng: God förståelse med viss analys (C-nivå)
  * ${maxPoints} poäng: Utmärkt svar med djup analys och nyanserat resonemang (A-nivå)
- Var rättvis men generös — det är en övning, inte ett riktigt prov.
- Ge konstruktiv feedback på svenska.

Svara EXAKT i denna JSON-struktur utan Markdown-kodblock:
{
  "points": <0-${maxPoints}>,
  "grade": "E|C|A|F",
  "feedback": "Konstruktiv feedback till eleven på svenska. Berätta vad som var bra och vad som kan förbättras.",
  "keyMissing": ["Lista av viktiga punkter eleven missade, om några"],
  "strengths": ["Lista av styrkor i elevens svar, om några"]
}
`;

    const model = getGeminiModel("gemini-3-flash-preview");
    const result = await model.generateContent(prompt);

    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const grading = JSON.parse(text);

    return NextResponse.json({ success: true, grading });
  } catch (error) {
    console.error("Grade Answer Error:", error);
    return NextResponse.json(
      { error: "Kunde inte bedöma svaret", details: error.message },
      { status: 500 }
    );
  }
}
