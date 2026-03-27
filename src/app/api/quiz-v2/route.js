import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req) {
  try {
    const body = await req.json();
    const { deckId, accessToken, difficulty = "mixed", questionCount = 5 } = body;

    if (!deckId || !accessToken) {
      return NextResponse.json({ error: "deckId och accessToken krävs" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    // 1. Fetch all cards from the deck
    const { data: cards, error: cardsError } = await supabase
      .from("flashcards")
      .select("id, front, back, card_type, grade_level, sort_order")
      .eq("deck_id", deckId)
      .order("sort_order", { ascending: true });

    if (cardsError || !cards || cards.length === 0) {
      return NextResponse.json({ error: "Inga kort hittades i denna kartlek" }, { status: 404 });
    }

    // 2. Get deck title
    const { data: deck } = await supabase
      .from("flashcard_decks")
      .select("title")
      .eq("id", deckId)
      .single();

    // 3. Build knowledge base from cards
    const knowledgeBase = cards.map((c, i) => 
      `[Kort ${i + 1} | ID: ${c.id} | Typ: ${c.card_type} | Nivå: ${c.grade_level}]\nFråga: ${c.front}\nSvar: ${c.back}`
    ).join("\n\n");

    // 4. Build difficulty instruction
    const difficultyMap = {
      E: "Skapa frågor på E-nivå: grundläggande förståelse, enkla fakta, definitioner.",
      C: "Skapa frågor på C-nivå: analys, jämförelse, förklara samband mellan fenomen.",
      A: "Skapa frågor på A-nivå: kritiskt tänkande, nyanserade resonemang, värdering ur flera perspektiv.",
      mixed: "Skapa en blandning av frågor: enklare (E), medelsvåra (C) och avancerade (A)."
    };
    const diffInstruction = difficultyMap[difficulty] || difficultyMap.mixed;

    // 5. Build the prompt for Swedish exam format
    const prompt = `
Du är en erfaren svensk gymnasielärare som skapar prov i stil med Nationella Prov.

KUNSKAPSBAS (alla dessa kunskapspunkter kommer från elevens studiematerial):
${knowledgeBase}

INSTRUKTIONER:
- Skapa exakt ${questionCount} provfrågor baserade ENBART på kunskapsbasen ovan.
- ${diffInstruction}
- Alla frågor och svar på SVENSKA.
- Fördela frågorna enligt dessa typer i svensk provstil:

FRÅGETYPER:
1. "kortsvar" — Kort svarsfråga (1-2 meningar). Testar fakta och grundläggande förståelse. (E-nivå)
2. "begrepp" — Begreppsförklaring. Eleven ska med egna ord förklara ett begrepp/fenomen. (E-C nivå)
3. "kallanalys" — Källanalys. Du MÅSTE skapa en kort fiktiv historisk källa (ett citat, ett utdrag ur ett brev, en tidningsartikel etc.) och be eleven analysera den: Vem skrev det? Varför? Är källan tillförlitlig? (C-nivå)
4. "essa" — Essäfråga/Resonemang. Eleven ska skriva ett längre resonerande svar (ca 150-300 ord) där de jämför, analyserar orsaker/konsekvenser, eller värderar ur flera perspektiv. (C-A nivå)

FÖRDELNING för ${questionCount} frågor:
- 2 kortsvar
- 1 begrepp
- 1 källanalys
- 1 essä
(Om fler än 5 frågor: fyll på med fler kortsvar och begrepp)

VIKTIG REGEL FÖR card_ids:
- Varje fråga MÅSTE referera till ett eller flera kort-ID:n från kunskapsbasen (fältet "related_card_ids").
- Använd de exakta UUID-strängar som finns i kunskapsbasen ovan.

Svara EXAKT i denna JSON-struktur utan Markdown-kodblock:
{
  "examTitle": "Provtitel baserad på ämnet",
  "totalPoints": <summa av alla maxPoints>,
  "questions": [
    {
      "id": 1,
      "type": "kortsvar|begrepp|kallanalys|essa",
      "gradeLevel": "E|C|A",
      "maxPoints": 2,
      "question": "Frågetexten",
      "sourceText": null,
      "modelAnswer": "Det förväntade svaret baserat på kunskapsbasen. Detaljerat nog för AI-bedömning.",
      "gradingCriteria": "Kriterier för bedömning, t.ex. 'Eleven ska nämna minst 2 orsaker'",
      "related_card_ids": ["uuid-1", "uuid-2"]
    },
    {
      "id": 2,
      "type": "kallanalys",
      "gradeLevel": "C",
      "maxPoints": 4,
      "question": "Analysera följande källa. Vem kan ha skrivit den? I vilket syfte? Är den tillförlitlig?",
      "sourceText": "\"Vi måste försvara vår nation mot de krafter som hotar vår enhet...\" — Utdrag ur ett tal, 1933",
      "modelAnswer": "Detaljerat modellsvar...",
      "gradingCriteria": "Eleven ska identifiera avsändare, syfte, och resonera kring tillförlitlighet.",
      "related_card_ids": ["uuid-3"]
    }
  ]
}
`;

    const model = getGeminiModel("gemini-3-flash-preview");
    const result = await model.generateContent(prompt);

    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const examData = JSON.parse(text);

    return NextResponse.json({
      success: true,
      exam: examData,
      deckTitle: deck?.title || "Okänd",
    });
  } catch (error) {
    console.error("Quiz V2 Generation Error:", error);
    return NextResponse.json(
      { error: "Kunde inte generera prov", details: error.message },
      { status: 500 }
    );
  }
}
