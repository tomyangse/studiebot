import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120; // allow up to 2 minutes for large documents

// Server-side Supabase client using service role would be ideal,
// but for MVP we use the anon key + user's auth token forwarded.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req) {
  try {
    const body = await req.json();
    const { documentId, accessToken } = body;

    if (!documentId) {
      return NextResponse.json({ error: "documentId krävs" }, { status: 400 });
    }

    // Create an authenticated Supabase client for this request
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    // 1. Fetch the document metadata
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, user_id, file_name, storage_path")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Dokumentet hittades inte" },
        { status: 404 }
      );
    }

    // 2. Download the file from Storage
    const { data: fileBlob, error: dlError } = await supabase.storage
      .from("study_materials")
      .download(doc.storage_path);

    if (dlError || !fileBlob) {
      return NextResponse.json(
        { error: "Kunde inte hämta filen från lagring" },
        { status: 500 }
      );
    }

    // Convert blob to base64
    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    // Determine MIME type from extension
    const ext = doc.file_name.split(".").pop().toLowerCase();
    const mimeMap = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      txt: "text/plain",
      md: "text/markdown",
    };
    const mimeType = mimeMap[ext] || "application/pdf";

    // 3. Create a deck record with status 'generating'
    const { data: deck, error: deckError } = await supabase
      .from("flashcard_decks")
      .insert({
        user_id: doc.user_id,
        document_id: doc.id,
        title: doc.file_name.replace(/\.[^.]+$/, ""),
        status: "generating",
      })
      .select()
      .single();

    if (deckError) {
      return NextResponse.json(
        { error: `Kunde inte skapa kartlek: ${deckError.message}` },
        { status: 500 }
      );
    }

    // 4. Ask Gemini 3 to exhaustively extract ALL knowledge points
    const prompt = `
Du är en extremt grundlig och systematisk pedagog. Din uppgift är att analysera det bifogade dokumentet och extrahera VARJE ENDA kunskapspunkt, fakta, begrepp, definition, händelse, orsakssamband och slutsats som finns i texten.

KRITISKA REGLER:
- Du MÅSTE täcka 100% av dokumentets innehåll. Inga luckor, inga utelämnade avsnitt.
- Skapa EN flashcard för varje distinkt kunskapspunkt.
- Om ett avsnitt innehåller flera fakta, dela upp dem i separata kort.
- Använd ENBART information som finns i dokumentet. Ingen extern kunskap.
- Alla kort ska vara på svenska.
- Varje kort har en framsida (fråga/begrepp) och en baksida (svar/förklaring).
- Framsidan: kort och tydlig fråga (1-2 meningar).
- Baksidan: koncist men komplett svar (1-4 meningar).
- Tilldela varje kort en typ: definition, event, cause, connection, concept.
- Tilldela en svårighetsnivå: E (grundläggande fakta), C (fördjupad förståelse), A (analys/samband).
- Numrera korten i den ordning de dyker upp i texten (sort_order).

Svara EXAKT i denna JSON-struktur utan Markdown-kodblock:
{
  "totalExtracted": <antal>,
  "cards": [
    {
      "front": "Fråga",
      "back": "Svar",
      "card_type": "definition|event|cause|connection|concept",
      "grade_level": "E|C|A",
      "sort_order": 1
    }
  ]
}
`;

    const model = getGeminiModel("gemini-3-flash-preview");
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
    ]);

    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const extracted = JSON.parse(text);
    const cards = extracted.cards || [];

    if (cards.length === 0) {
      await supabase
        .from("flashcard_decks")
        .update({ status: "error" })
        .eq("id", deck.id);
      return NextResponse.json(
        { error: "AI kunde inte extrahera några kunskapspunkter" },
        { status: 500 }
      );
    }

    // 5. Batch insert all cards
    const cardRows = cards.map((c, i) => ({
      deck_id: deck.id,
      front: c.front,
      back: c.back,
      card_type: c.card_type || "concept",
      grade_level: c.grade_level || "E",
      sort_order: c.sort_order || i + 1,
    }));

    const { error: insertError } = await supabase
      .from("flashcards")
      .insert(cardRows);

    if (insertError) {
      await supabase
        .from("flashcard_decks")
        .update({ status: "error" })
        .eq("id", deck.id);
      return NextResponse.json(
        { error: `Kunde inte spara kort: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 6. Mark deck as ready
    await supabase
      .from("flashcard_decks")
      .update({ status: "ready", total_cards: cards.length })
      .eq("id", deck.id);

    return NextResponse.json({
      success: true,
      deckId: deck.id,
      totalCards: cards.length,
      deckTitle: deck.title,
    });
  } catch (error) {
    console.error("Extract Cards Error:", error);
    return NextResponse.json(
      { error: "Serverfel vid extraktion", details: error.message },
      { status: 500 }
    );
  }
}
