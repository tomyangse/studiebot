import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req) {
  try {
    const body = await req.json();
    const { message, conversationHistory = [], accessToken, subjectCode } = body;

    if (!message || !accessToken) {
      return NextResponse.json({ error: "Meddelande och accessToken krävs" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    // ──── RAG: Retrieve user's knowledge base ────

    // 1. Get user's flashcard decks
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    let knowledgeContext = "";

    if (userId) {
      // Get all user's decks
      const { data: decks } = await supabase
        .from("flashcard_decks")
        .select("id, title, total_cards")
        .eq("user_id", userId)
        .eq("status", "ready");

      if (decks && decks.length > 0) {
        const deckIds = decks.map(d => d.id);

        // Get all cards from user's decks (limit to most relevant subset)
        const { data: cards } = await supabase
          .from("flashcards")
          .select("front, back, card_type, grade_level")
          .in("deck_id", deckIds)
          .limit(200); // Cap to avoid token overflow

        if (cards && cards.length > 0) {
          knowledgeContext = cards.map((c, i) =>
            `[${i + 1}] (${c.card_type}/${c.grade_level}) Q: ${c.front} | A: ${c.back}`
          ).join("\n");
        }
      }

      // 2. Get document analysis topics
      const { data: docs } = await supabase
        .from("documents")
        .select("id, file_name")
        .eq("user_id", userId);

      if (docs && docs.length > 0) {
        const docIds = docs.map(d => d.id);
        const { data: analyses } = await supabase
          .from("document_analysis")
          .select("document_id, extracted_topics, curriculum_mapping")
          .in("document_id", docIds);

        if (analyses && analyses.length > 0) {
          const topicsSummary = analyses.map(a => {
            const doc = docs.find(d => d.id === a.document_id);
            const topics = Array.isArray(a.extracted_topics) 
              ? a.extracted_topics.map(t => typeof t === 'string' ? t : t.title || t.name || '').join(", ")
              : "";
            return `Dokument "${doc?.file_name}": ${topics}`;
          }).join("\n");
          
          if (topicsSummary) {
            knowledgeContext += "\n\n--- DOKUMENT-ÄMNEN ---\n" + topicsSummary;
          }
        }
      }
    }

    // ──── Build system prompt ────
    const systemPrompt = `
Du är en kunnig och vänlig svensk gymnasielärare och studieassistent. Du hjälper elever att förstå sina studier.

KRITISKA REGLER:
1. Svara ALLTID på svenska.
2. Du får BARA svara baserat på den kunskapsbas som ges nedan. Om frågan faller utanför kunskapsbasen, säg ärligt: "Det finns inte i ditt studiematerial. Jag kan bara hjälpa dig med ämnen som täcks av ditt uppladade material."
3. ALDRIG hitta på fakta, datum, eller detaljer. Om du inte är 100% säker, ange tydligt att du är osäker.
4. Citera gärna specifika kunskapspunkter från kunskapsbasen för att styrka dina svar.
5. Anpassa ditt språk till gymnasienivå — tydligt, strukturerat, pedagogiskt.
6. Om eleven verkar kämpa, erbjud förenklingar, exempel och minnesknep.
7. Var uppmuntrande men ärlig.

${knowledgeContext ? `
ELEVENS KUNSKAPSBAS (Flashcards från studiematerial):
${knowledgeContext}

INSTRUKTION: Använd ENBART ovanstående kunskapsbas för att svara. Om frågan inte täcks av kunskapsbasen, var ärlig om det.
` : `
OBS: Eleven har inte laddat upp något studiematerial ännu. Uppmuntra eleven att ladda upp material under "Material"-sidan för att du ska kunna ge specifika svar.
`}
`;

    // ──── Build conversation ────
    const model = getGeminiModel("gemini-3-flash-preview");
    const chat = model.startChat({
      systemInstruction: systemPrompt,
      history: conversationHistory.map(msg => ({
        role: msg.role === "ai" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({
      success: true,
      reply: responseText,
    });
  } catch (error) {
    console.error("Tutor API Error:", error);
    return NextResponse.json(
      { error: "Kunde inte generera svar", details: error.message },
      { status: 500 }
    );
  }
}
