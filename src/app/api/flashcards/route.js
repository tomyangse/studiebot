import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    const { topics, sourceMaterial, cardCount = 10 } = body;

    if ((!topics || topics.length === 0) && !sourceMaterial) {
      return NextResponse.json(
        { error: "Ingen källa angiven" },
        { status: 400 }
      );
    }

    const curriculumContext = HISTORIA_1B_CURRICULUM.centralContent
      .map(
        (cc) =>
          `- ${cc.title}: ${cc.description}\n  E: ${cc.gradeE}\n  C: ${cc.gradeC}\n  A: ${cc.gradeA}`
      )
      .join("\n\n");

    let prompt = "";
    if (sourceMaterial) {
      prompt = `
Du är en stenhård expertpedagog. Din uppgift är att skapa flashcards (minneslappar) EXAKT och ENBART baserat på det bifogade materialet.

INSTRUKTIONER:
- Generera exakt ${cardCount} flashcards hämtade direkt från den bifogade filen.
- Använd inte extern kunskap som inte nämns i filen. Om dokumentet är kort, gör kort om detaljer i texten.
- Varje kort har en framsida (fråga/begrepp) och en baksida (svar/förklaring).
- Blanda olika typer av kort: definition, event, cause, connection, concept.
- Framsidan ska vara kort och tydlig (max 1-2 meningar).
- Baksidan ska vara koncis men informativ (max 3-4 meningar).
- Alla kort på svenska.
- Variera svårighetsnivå (E/C/A).
`;
    } else {
      prompt = `
Du är en svensk gymnasielärare. Skapa flashcards (minneslappar) för studenter.

ÄMNESPLAN (Centralt Innehåll):
${curriculumContext}

VALDA ÄMNEN:
${topics.join(", ")}

INSTRUKTIONER:
- Generera exakt ${cardCount} flashcards.
- Varje kort har en framsida (fråga/begrepp) och en baksida (svar/förklaring).
- Blanda olika typer av kort: definition, event, cause, connection, concept.
- Framsidan ska vara kort och tydlig (max 1-2 meningar).
- Baksidan ska vara koncis men informativ (max 3-4 meningar).
- Alla kort på svenska.
- Variera svårighetsnivå (E/C/A).
`;
    }

    prompt += `
Svara EXAKT i denna JSON-struktur utan Markdown-kodblock eller varningar:
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
