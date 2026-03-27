import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";

export const maxDuration = 60; // Allow longer execution for AI analysis

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const subjectCode = formData.get("subjectCode") || "HIS"; // Default to History for MVP

    if (!file) {
      return NextResponse.json(
        { error: "Inget material uppladdat" },
        { status: 400 }
      );
    }

    // Convert File to base64 buffer for Gemini InlineData
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
Du är en svensk gymnasielärare och studiecoach. Uppgiften är att analysera bifogat studiematerial
och matcha det mot Skolverkets ämnesplan för ${HISTORIA_1B_CURRICULUM.levelName} (${subjectCode}).

Här är ämnesplanens "Centralt Innehåll":
${HISTORIA_1B_CURRICULUM.centralContent
  .map((cc) => `- ID [${cc.id}]: ${cc.title} (${cc.description})`)
  .join("\n")}

Gör följande analys:
1. Extrahera de viktigaste kunskapspunkterna som tas upp i materialet (max 5 st, på svenska).
2. Titta på de 5 punkterna från Centralt Innehåll och bedöm om materialet täcker dem: 
   - 'covered' = Täcks väl
   - 'partial' = Vidrörs kortfattat
   - 'missing' = Saknas helt i detta dokument

Svara EXAKT i denna JSON-struktur utan Markdown-kodblock eller extratext runt omkring:
{
  "documentTitle": "En bra titel på materialet",
  "subjectMatch": "${HISTORIA_1B_CURRICULUM.levelName}",
  "extractedTopics": ["Ämne 1", "Ämne 2"],
  "curriculumMapping": [
    {
      "id": "cc1",
      "coverage": "covered|partial|missing",
      "coveragePercent": 0-100 -- En uppskattning i procent
    }
    -- upprepa för cc2, cc3, cc4, cc5
  ]
}
`;

    const model = getGeminiModel("gemini-2.5-flash");

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: file.type || "application/pdf",
          },
        },
      ]);

    let textResponse = result.response.text();
    textResponse = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const analysisResult = JSON.parse(textResponse);

    // Merge with curriculum data for frontend
    const mergedMapping = HISTORIA_1B_CURRICULUM.centralContent.map((cc) => {
      const mapping = analysisResult.curriculumMapping.find((m) => m.id === cc.id) || {
        coverage: "missing",
        coveragePercent: 0,
      };
      return {
        ...cc,
        coverage: mapping.coverage,
        coveragePercent: mapping.coveragePercent,
      };
    });

    // Calculate overall coverage score
    const scores = mergedMapping.map((m) => m.coveragePercent);
    const overallCoverage = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );

    const finalResponse = {
      documentTitle: analysisResult.documentTitle,
      subjectMatch: analysisResult.subjectMatch,
      extractedTopics: analysisResult.extractedTopics,
      curriculumMapping: mergedMapping,
      overallCoverage,
      coveredCount: mergedMapping.filter((m) => m.coverage === "covered").length,
      partialCount: mergedMapping.filter((m) => m.coverage === "partial").length,
      missingCount: mergedMapping.filter((m) => m.coverage === "missing").length,
    };

    return NextResponse.json({ success: true, result: finalResponse });
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json(
      { error: "Ett fel uppstod vid AI-analysen", details: error.message },
      { status: 500 }
    );
  }
}
