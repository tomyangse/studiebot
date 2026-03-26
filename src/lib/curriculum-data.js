/* Gymnasieprogram and ämnen data for onboarding.
   In production, this will be fetched from Skolverket API and stored in Supabase.
   For MVP, we use static data with Historia 1 as the test subject. */

export const PROGRAMS = [
  {
    code: "EK",
    name: "Ekonomiprogrammet",
    type: "högskoleförberedande",
    icon: "📊",
  },
  {
    code: "ES",
    name: "Estetiska programmet",
    type: "högskoleförberedande",
    icon: "🎨",
  },
  {
    code: "HU",
    name: "Humanistiska programmet",
    type: "högskoleförberedande",
    icon: "📖",
  },
  {
    code: "NA",
    name: "Naturvetenskapsprogrammet",
    type: "högskoleförberedande",
    icon: "🔬",
  },
  {
    code: "SA",
    name: "Samhällsvetenskapsprogrammet",
    type: "högskoleförberedande",
    icon: "🏛️",
  },
  {
    code: "TE",
    name: "Teknikprogrammet",
    type: "högskoleförberedande",
    icon: "⚙️",
  },
  {
    code: "BF",
    name: "Barn- och fritidsprogrammet",
    type: "yrkesprogram",
    icon: "👶",
  },
  {
    code: "BA",
    name: "Bygg- och anläggningsprogrammet",
    type: "yrkesprogram",
    icon: "🏗️",
  },
  {
    code: "EE",
    name: "El- och energiprogrammet",
    type: "yrkesprogram",
    icon: "⚡",
  },
  {
    code: "FT",
    name: "Fordons- och transportprogrammet",
    type: "yrkesprogram",
    icon: "🚗",
  },
  {
    code: "HA",
    name: "Handels- och administrationsprogrammet",
    type: "yrkesprogram",
    icon: "🛒",
  },
  {
    code: "HV",
    name: "Hantverksprogrammet",
    type: "yrkesprogram",
    icon: "✂️",
  },
  {
    code: "HT",
    name: "Hotell- och turismprogrammet",
    type: "yrkesprogram",
    icon: "🏨",
  },
  {
    code: "IN",
    name: "Industritekniska programmet",
    type: "yrkesprogram",
    icon: "🏭",
  },
  {
    code: "NB",
    name: "Naturbruksprogrammet",
    type: "yrkesprogram",
    icon: "🌿",
  },
  {
    code: "RL",
    name: "Restaurang- och livsmedelsprogrammet",
    type: "yrkesprogram",
    icon: "🍳",
  },
  {
    code: "VF",
    name: "VVS- och fastighetsprogrammet",
    type: "yrkesprogram",
    icon: "🔧",
  },
  {
    code: "VO",
    name: "Vård- och omsorgsprogrammet",
    type: "yrkesprogram",
    icon: "🏥",
  },
];

export const YEAR_OPTIONS = [
  { value: 1, label: "Årskurs 1" },
  { value: 2, label: "Årskurs 2" },
  { value: 3, label: "Årskurs 3" },
];

/* Sample subjects — In production these come from Skolverket API per program.
   For now we include common subjects + Historia as the test subject. */
export const SUBJECTS = [
  {
    code: "HIS",
    name: "Historia",
    levels: [
      { level: 1, name: "Historia 1a1", points: 50 },
      { level: 2, name: "Historia 1a2", points: 50 },
      { level: 3, name: "Historia 1b", points: 100 },
      { level: 4, name: "Historia 2a", points: 50 },
      { level: 5, name: "Historia 2b — kultur", points: 100 },
      { level: 6, name: "Historia 3", points: 100 },
    ],
    icon: "📜",
  },
  {
    code: "MAT",
    name: "Matematik",
    levels: [
      { level: 1, name: "Matematik 1a", points: 100 },
      { level: 2, name: "Matematik 1b", points: 100 },
      { level: 3, name: "Matematik 1c", points: 100 },
      { level: 4, name: "Matematik 2a", points: 100 },
      { level: 5, name: "Matematik 2b", points: 100 },
    ],
    icon: "📐",
  },
  {
    code: "ENG",
    name: "Engelska",
    levels: [
      { level: 5, name: "Engelska 5", points: 100 },
      { level: 6, name: "Engelska 6", points: 100 },
      { level: 7, name: "Engelska 7", points: 100 },
    ],
    icon: "🇬🇧",
  },
  {
    code: "SVE",
    name: "Svenska",
    levels: [
      { level: 1, name: "Svenska 1", points: 100 },
      { level: 2, name: "Svenska 2", points: 100 },
      { level: 3, name: "Svenska 3", points: 100 },
    ],
    icon: "🇸🇪",
  },
  {
    code: "SAM",
    name: "Samhällskunskap",
    levels: [
      { level: 1, name: "Samhällskunskap 1a1", points: 50 },
      { level: 2, name: "Samhällskunskap 1a2", points: 50 },
      { level: 3, name: "Samhällskunskap 1b", points: 100 },
    ],
    icon: "🏛️",
  },
  {
    code: "NAK",
    name: "Naturkunskap",
    levels: [
      { level: 1, name: "Naturkunskap 1a1", points: 50 },
      { level: 2, name: "Naturkunskap 1a2", points: 50 },
      { level: 3, name: "Naturkunskap 1b", points: 100 },
    ],
    icon: "🌍",
  },
];

/* Historia 1b — sample centralt innehåll for the MVP test */
export const HISTORIA_1B_CURRICULUM = {
  subjectCode: "HIS",
  levelName: "Historia 1b",
  purpose:
    "Undervisningen i ämnet historia ska syfta till att eleverna breddar, fördjupar och utvecklar sitt historiemedvetande genom kunskaper om det förflutna.",
  centralContent: [
    {
      id: "cc1",
      title: "Den europeiska epokindelningen",
      description:
        "Europeisk epokindelning utifrån ett kronologiskt perspektiv. Förhistorisk tid, forntiden, antiken, medeltiden, renässansen och upplysningstiden samt perioden från och med den industriella revolutionen till idag.",
      gradeE:
        "Eleven kan översiktligt redogöra för förändringsprocesser, händelser och personer under olika tidsperioder.",
      gradeC:
        "Eleven kan utförligt redogöra för förändringsprocesser, händelser och personer under olika tidsperioder samt förklara samband och dra slutsatser.",
      gradeA:
        "Eleven kan utförligt och nyanserat redogöra för förändringsprocesser, händelser och personer under olika tidsperioder samt förklara komplexa samband och dra välgrundade slutsatser.",
    },
    {
      id: "cc2",
      title: "Industrialisering och demokratisering",
      description:
        "Industrialisering och demokratisering under 1800- och 1900-talen i Sverige och globalt. Olika perspektiv på historiska förändringsprocesser.",
      gradeE:
        "Eleven kan ge exempel på och beskriva orsaker och konsekvenser av samhällsförändringar.",
      gradeC:
        "Eleven kan analysera orsaker och konsekvenser av samhällsförändringar och förklara samband.",
      gradeA:
        "Eleven kan analysera komplexa orsaker och konsekvenser av samhällsförändringar och förklara samband ur olika perspektiv.",
    },
    {
      id: "cc3",
      title: "Krig, konflikter och fredsprocesser",
      description:
        "De båda världskrigen, inklusive förintelsen, och efterkrigstidens konflikter. FN, mänskliga rättigheter och demokratisering.",
      gradeE:
        "Eleven kan översiktligt redogöra för orsaker till och konsekvenser av konflikter och krig.",
      gradeC:
        "Eleven kan utförligt redogöra för orsaker till och konsekvenser av konflikter och krig samt analysera deras påverkan.",
      gradeA:
        "Eleven kan utförligt och nyanserat redogöra för orsaker till och konsekvenser av konflikter och krig samt analysera deras komplexa påverkan ur flera perspektiv.",
    },
    {
      id: "cc4",
      title: "Historiska källor och historiebruk",
      description:
        "Historiska källor och hur de kan användas. Hur historia används och har använts i samhällslivet och i olika medier.",
      gradeE:
        "Eleven kan använda historiska källor på ett i huvudsak fungerande sätt.",
      gradeC:
        "Eleven kan använda historiska källor på ett fungerande sätt och föra underbyggda resonemang om deras relevans och trovärdighet.",
      gradeA:
        "Eleven kan använda historiska källor på ett väl fungerande sätt och föra väl underbyggda och nyanserade resonemang om deras relevans och trovärdighet.",
    },
    {
      id: "cc5",
      title: "Historievetenskapliga begrepp och metoder",
      description:
        "Historievetenskapliga begrepp och metoder. Kontinuitet och förändring, orsak och konsekvens, käll- och perspektivkritik.",
      gradeE:
        "Eleven kan använda historiska begrepp på ett i huvudsak fungerande sätt.",
      gradeC:
        "Eleven kan använda historiska begrepp på ett fungerande och korrekt sätt i olika sammanhang.",
      gradeA:
        "Eleven kan använda historiska begrepp på ett väl fungerande, korrekt och nyanserat sätt i komplexa sammanhang.",
    },
  ],
};
