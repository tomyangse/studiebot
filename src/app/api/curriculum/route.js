import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  try {
    const { subjectName, levelName } = await request.json();

    if (!subjectName || !levelName) {
      return Response.json(
        { success: false, error: "Subject and level are required." },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Du är en svensk gymnasieexpert. Generera kursinnehåll (centralt innehåll) för kursen "${levelName}" i ämnet "${subjectName}" enligt Skolverkets ämnesplan.

Returnera exakt denna JSON-struktur (inget annat):
{
  "purpose": "En kort beskrivning av kursens syfte (1-2 meningar)",
  "centralContent": [
    {
      "id": "cc1",
      "title": "Kort titel för kunskapspunkten",
      "description": "Beskrivning av vad eleven ska lära sig",
      "gradeE": "Kunskapskrav för betyget E",
      "gradeC": "Kunskapskrav för betyget C",
      "gradeA": "Kunskapskrav för betyget A"
    }
  ]
}

Regler:
- Generera 4-6 kunskapspunkter (centralContent items)
- Alla texter ska vara på svenska
- Betygskraven ska följa Skolverkets formuleringar (översiktligt -> utförligt -> utförligt och nyanserat)
- id ska vara cc1, cc2, cc3 etc.
- Svara ENDAST med JSON, ingen annan text`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { success: false, error: "Could not parse AI response." },
        { status: 500 }
      );
    }

    const curriculumData = JSON.parse(jsonMatch[0]);

    return Response.json({
      success: true,
      curriculum: {
        subjectCode: subjectName.substring(0, 3).toUpperCase(),
        levelName,
        points: 100,
        icon: getSubjectIcon(subjectName),
        purpose: curriculumData.purpose,
        centralContent: curriculumData.centralContent,
      },
    });
  } catch (error) {
    console.error("Curriculum generation error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function getSubjectIcon(name) {
  const icons = {
    historia: "📜", matematik: "📐", engelska: "🇬🇧", svenska: "🇸🇪",
    fysik: "⚛️", kemi: "🧪", biologi: "🧬", geografi: "🌍",
    samhällskunskap: "🏛️", religion: "🕊️", filosofi: "💭",
    psykologi: "🧠", ekonomi: "📊", juridik: "⚖️",
    idrott: "🏃", musik: "🎵", bild: "🎨", teknik: "⚙️",
    naturkunskap: "🌿", programmering: "💻",
  };
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(icons)) {
    if (lower.includes(key)) return icon;
  }
  return "📚";
}
