import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    const { topics, cardCount = 10 } = body;

    if (!topics || topics.length === 0) {
      return NextResponse.json(
        { error: "Inga ämnen angivna" },
        { status: 400 }
      );
    }

    const curriculumContext = HISTORIA_1B_CURRICULUM.centralContent
      .map(
        (cc) =>
          `- ${cc.title}: ${cc.description}\n  E: ${cc.gradeE}\n  C: ${cc.gradeC}\n  A: ${cc.gradeA}`
      )
      .join("\n\n");

    const prompt = `
Du är en svensk gymnasielärare i Historia 1b. Skapa flashcards (minneslappar) för studenter.

ÄMNESPLAN (Centralt Innehåll):
${curriculumContext}

VALDA ÄMNEN:
${topics.join(", ")}

INSTRUKTIONER:
- Generera exakt ${cardCount} flashcards.
- Varje kort har en framsida (fråga/begrepp) och en baksida (svar/förklaring).
- Blanda olika typer av kort:
  * Definitioner: "Vad är...?" → kort svar
  * Årtal/händelser: "När...?" → datum + kontext  
  * Orsaker: "Varför...?" → 2-3 punkter
  * Samband: "Hur hänger X ihop med Y?" → förklaring
  * Begrepp: "Förklara begreppet..." → definition + exempel
- Framsidan ska vara kort och tydlig (max 1-2 meningar).
- Baksidan ska vara koncis men informativ (max 3-4 meningar).
- Alla kort på svenska.
- Variera svårighetsnivå (E/C/A).
- Koppla varje kort till rätt centralt innehåll (cc1-cc5).

Svara EXAKT i denna JSON-struktur utan Markdown-kodblock:
{
  "deckTitle": "Titel på kortleken",
  "cards": [
    {
      "id": 1,
      "front": "Fråga eller begrepp",
      "back": "Svar eller förklaring",
      "type": "definition|event|cause|connection|concept",
      "gradeLevel": "E|C|A",
      "curriculumPointId": "cc1|cc2|cc3|cc4|cc5"
    }
  ]
}
`;

    const model = getGeminiModel("gemini-2.5-flash");
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const deckData = JSON.parse(text);

    return NextResponse.json({ success: true, deck: deckData });
  } catch (error) {
    console.error("Flashcard Generation Error:", error);
    return NextResponse.json(
      { error: "Kunde inte generera flashcards", details: error.message },
      { status: 500 }
    );
  }
}
