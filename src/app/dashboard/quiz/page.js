"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./quiz.module.css";

const TYPE_LABELS = {
  kortsvar: "Kortsvar",
  begrepp: "Begreppsförklaring",
  kallanalys: "Källanalys",
  essa: "Essäfråga",
};

const TYPE_ICONS = {
  kortsvar: "✏️",
  begrepp: "📖",
  kallanalys: "🔍",
  essa: "📝",
};

const TYPE_HINTS = {
  kortsvar: "Svara kort och koncist i 1-2 meningar.",
  begrepp: "Förklara begreppet med egna ord. Ge gärna ett exempel.",
  kallanalys: "Läs källan noggrant. Analysera: Vem skrev den? Varför? Är den tillförlitlig?",
  essa: "Skriv ett utvecklat resonemang (ca 150-300 ord). Beskriv, jämför och analysera.",
};

const DIFFICULTY_OPTIONS = [
  { value: "mixed", emoji: "🎯", label: "Blandad", desc: "E + C + A" },
  { value: "E", emoji: "📗", label: "E-nivå", desc: "Grundläggande" },
  { value: "C", emoji: "📙", label: "C-nivå", desc: "Fördjupad" },
  { value: "A", emoji: "📕", label: "A-nivå", desc: "Avancerad" },
];

export default function QuizPage() {
  // ─── State ───
  const [phase, setPhase] = useState("loading"); // loading | setup | generating | active | grading | results
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(5);

  // Exam state
  const [exam, setExam] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: text }
  const [gradings, setGradings] = useState({}); // { questionId: gradingResult }
  const [gradingQ, setGradingQ] = useState(null); // which question is being graded

  // ─── Load decks ───
  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("flashcard_decks")
      .select("id, title, total_cards, created_at")
      .eq("user_id", session.user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    setDecks(data || []);
    setPhase("setup");
  };

  // ─── Generate exam ───
  const handleGenerate = async () => {
    if (!selectedDeckId) {
      alert("Välj en kartlek först.");
      return;
    }
    setPhase("generating");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/quiz-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: selectedDeckId,
          accessToken: session.access_token,
          difficulty,
          questionCount,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExam(data.exam);
        setCurrentQ(0);
        setAnswers({});
        setGradings({});
        setPhase("active");
      } else {
        alert(data.error || "Kunde inte generera prov.");
        setPhase("setup");
      }
    } catch (err) {
      console.error(err);
      alert("Ett fel uppstod vid generering.");
      setPhase("setup");
    }
  };

  // ─── Submit answer for grading ───
  const handleSubmitAnswer = async (question) => {
    const studentAnswer = answers[question.id];
    if (!studentAnswer || studentAnswer.trim().length === 0) {
      alert("Skriv ett svar först.");
      return;
    }

    setGradingQ(question.id);

    try {
      const res = await fetch("/api/grade-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentAnswer,
          modelAnswer: question.modelAnswer,
          question: question.question,
          questionType: question.type,
          gradeLevel: question.gradeLevel,
          gradingCriteria: question.gradingCriteria,
          maxPoints: question.maxPoints,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGradings((prev) => ({ ...prev, [question.id]: data.grading }));
      } else {
        alert("Kunde inte bedöma svaret.");
      }
    } catch (err) {
      console.error(err);
      alert("Bedömningsfel.");
    } finally {
      setGradingQ(null);
    }
  };

  // ─── Navigate ───
  const handleNext = () => {
    if (currentQ < exam.questions.length - 1) {
      setCurrentQ((q) => q + 1);
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) {
      setCurrentQ((q) => q - 1);
    }
  };

  // ─── Finish exam & SRS integration ───
  const handleFinish = async () => {
    // Write SRS reviews for answered questions
    const { data: { session } } = await supabase.auth.getSession();
    if (session && exam) {
      for (const q of exam.questions) {
        const grading = gradings[q.id];
        if (!grading || !q.related_card_ids) continue;

        const rating = grading.points >= q.maxPoints * 0.7 ? "easy" : 
                       grading.points >= q.maxPoints * 0.4 ? "ok" : "hard";

        for (const cardId of q.related_card_ids) {
          await supabase.from("flashcard_reviews").insert({
            user_id: session.user.id,
            card_id: cardId,
            rating,
            ease_factor: rating === "easy" ? 2.6 : rating === "ok" ? 2.5 : 2.3,
            interval_days: rating === "easy" ? 3 : rating === "ok" ? 1 : 0,
            next_review_at: new Date(
              Date.now() + (rating === "easy" ? 3 : rating === "ok" ? 1 : 0) * 86400000
            ).toISOString(),
          });
        }
      }
    }
    setPhase("results");
  };

  // ─── Computed ───
  const allGraded = exam ? exam.questions.every((q) => gradings[q.id]) : false;
  const totalPoints = exam ? exam.questions.reduce((sum, q) => sum + q.maxPoints, 0) : 0;
  const earnedPoints = Object.values(gradings).reduce((sum, g) => sum + (g.points || 0), 0);
  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const currentQuestion = exam?.questions?.[currentQ];

  return (
    <div className={styles.quizPage}>
      <h1>{"📋"} Prov</h1>

      {/* === Loading === */}
      {phase === "loading" && (
        <div className={styles.quizLoading}>
          <div className={styles.quizLoadingIcon}>📋</div>
          <h3>Laddar...</h3>
        </div>
      )}

      {/* === Setup === */}
      {phase === "setup" && (
        <div className={styles.quizSetup}>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
            Skapa ett prov i stil med Nationella Prov — med öppna frågor, källanalys och essäer. AI rättar dina svar.
          </p>

          {/* Deck selection */}
          <h3 style={{ marginBottom: "var(--space-3)" }}>Välj kartlek</h3>
          {decks.length === 0 ? (
            <div className="card" style={{ padding: "var(--space-6)", textAlign: "center", marginBottom: "var(--space-6)" }}>
              <p style={{ color: "var(--color-text-muted)" }}>
                Inga kartlekar. Gå till Material → Extrahera kunskapspunkter först.
              </p>
            </div>
          ) : (
            <div className={styles.topicChips} style={{ marginBottom: "var(--space-6)" }}>
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  className={`${styles.topicChip} ${selectedDeckId === deck.id ? styles.selected : ""}`}
                  onClick={() => setSelectedDeckId(deck.id)}
                >
                  📚 {deck.title} ({deck.total_cards} kort)
                </button>
              ))}
            </div>
          )}

          {/* Difficulty */}
          <h3 style={{ marginBottom: "var(--space-3)" }}>Svårighetsgrad</h3>
          <div className={styles.difficultyGrid}>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className={`card ${styles.difficultyCard} ${difficulty === opt.value ? styles.selected : ""}`}
                onClick={() => setDifficulty(opt.value)}
              >
                <div className={styles.difficultyEmoji}>{opt.emoji}</div>
                <div className={styles.difficultyLabel}>{opt.label}</div>
                <div className={styles.difficultyDesc}>{opt.desc}</div>
              </div>
            ))}
          </div>

          {/* Question count */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Antal frågor:</span>
            {[5, 7, 10].map((n) => (
              <button
                key={n}
                className={`btn ${questionCount === n ? "btn-primary" : "btn-secondary"}`}
                style={{ padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-sm)" }}
                onClick={() => setQuestionCount(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary btn-lg"
            disabled={!selectedDeckId}
            onClick={handleGenerate}
          >
            📋 Skapa prov ({questionCount} frågor)
          </button>
        </div>
      )}

      {/* === Generating === */}
      {phase === "generating" && (
        <div className={styles.quizLoading}>
          <div className={styles.quizLoadingIcon}>🧠</div>
          <h3>Skapar prov i Nationella Prov-stil...</h3>
          <p style={{ color: "var(--color-text-secondary)" }}>
            AI genererar kortsvar, begreppsförklaringar, källanalys och essäfrågor. Ca 10-20 sekunder...
          </p>
        </div>
      )}

      {/* === Active exam === */}
      {phase === "active" && exam && currentQuestion && (
        <div className={styles.quizActive}>
          {/* Navigation bar */}
          <div className={styles.quizProgress}>
            <span className={styles.quizProgressText}>
              Fråga {currentQ + 1} / {exam.questions.length}
            </span>
            <div className={`progress-bar ${styles.quizProgressBar}`}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(Object.keys(gradings).length / exam.questions.length) * 100}%`,
                }}
              />
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              {Object.keys(gradings).length}/{exam.questions.length} bedömda
            </span>
          </div>

          {/* Question dot navigator */}
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
            {exam.questions.map((q, i) => {
              const graded = gradings[q.id];
              const isActive = i === currentQ;
              let dotColor = "var(--color-border)";
              if (graded) {
                dotColor = graded.points >= q.maxPoints * 0.7 ? "var(--color-success)" :
                           graded.points >= q.maxPoints * 0.4 ? "var(--color-warning)" : "var(--color-danger)";
              }
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQ(i)}
                  style={{
                    width: 32, height: 32, borderRadius: "var(--radius-full)",
                    border: isActive ? "2px solid var(--color-primary)" : "2px solid transparent",
                    background: dotColor, color: "#fff",
                    fontSize: "var(--text-xs)", fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Question card */}
          <div className={`card ${styles.questionCard}`}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                <span style={{ fontSize: "1.5rem" }}>{TYPE_ICONS[currentQuestion.type]}</span>
                <span className="badge badge-info">{TYPE_LABELS[currentQuestion.type]}</span>
                <span className={`badge ${
                  currentQuestion.gradeLevel === "A" ? "badge-success" :
                  currentQuestion.gradeLevel === "C" ? "badge-warning" : "badge-danger"
                }`}>
                  {currentQuestion.gradeLevel}
                </span>
              </div>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                Max {currentQuestion.maxPoints}p
              </span>
            </div>

            {/* Source text for källanalys */}
            {currentQuestion.type === "kallanalys" && currentQuestion.sourceText && (
              <div className={styles.sourceBlock}>
                <div className={styles.sourceLabel}>📜 Källa</div>
                <blockquote className={styles.sourceQuote}>
                  {currentQuestion.sourceText}
                </blockquote>
              </div>
            )}

            {/* Question text */}
            <p className={styles.questionText}>{currentQuestion.question}</p>

            {/* Hint */}
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-4)", fontStyle: "italic" }}>
              💡 {TYPE_HINTS[currentQuestion.type]}
            </p>

            {/* Answer area */}
            <textarea
              className={styles.answerTextarea}
              placeholder="Skriv ditt svar här..."
              rows={currentQuestion.type === "essa" ? 10 : currentQuestion.type === "kallanalys" ? 6 : 3}
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
              disabled={!!gradings[currentQuestion.id]}
            />

            {/* Submit / grading */}
            {!gradings[currentQuestion.id] ? (
              <button
                className="btn btn-primary"
                style={{ marginTop: "var(--space-3)" }}
                disabled={gradingQ === currentQuestion.id || !answers[currentQuestion.id]?.trim()}
                onClick={() => handleSubmitAnswer(currentQuestion)}
              >
                {gradingQ === currentQuestion.id ? "⏳ Bedömer..." : "📤 Lämna in svar"}
              </button>
            ) : (
              /* Grading feedback */
              <div className={styles.gradingFeedback}>
                <div className={styles.gradingHeader}>
                  <div className={styles.gradingScore}>
                    <span className={styles.gradingPoints}>
                      {gradings[currentQuestion.id].points}/{currentQuestion.maxPoints}
                    </span>
                    <span className={`badge ${
                      gradings[currentQuestion.id].grade === "A" ? "badge-success" :
                      gradings[currentQuestion.id].grade === "C" ? "badge-warning" :
                      gradings[currentQuestion.id].grade === "E" ? "badge-info" : "badge-danger"
                    }`}>
                      {gradings[currentQuestion.id].grade === "F" ? "Ej godkänt" : `Betyg ${gradings[currentQuestion.id].grade}`}
                    </span>
                  </div>
                </div>
                <p className={styles.gradingText}>{gradings[currentQuestion.id].feedback}</p>
                
                {gradings[currentQuestion.id].strengths?.length > 0 && (
                  <div className={styles.gradingList}>
                    <span className={styles.gradingListLabel}>✅ Styrkor:</span>
                    <ul>
                      {gradings[currentQuestion.id].strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                
                {gradings[currentQuestion.id].keyMissing?.length > 0 && (
                  <div className={styles.gradingList}>
                    <span className={styles.gradingListLabel}>📌 Att förbättra:</span>
                    <ul>
                      {gradings[currentQuestion.id].keyMissing.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-4)" }}>
            <button className="btn btn-ghost" onClick={handlePrev} disabled={currentQ === 0}>
              ← Föregående
            </button>
            
            {currentQ < exam.questions.length - 1 ? (
              <button className="btn btn-secondary" onClick={handleNext}>
                Nästa →
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleFinish}
                disabled={!allGraded}
              >
                {allGraded ? "📊 Se resultat" : `Bedöm alla frågor först (${Object.keys(gradings).length}/${exam.questions.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* === Results === */}
      {phase === "results" && exam && (
        <div className={styles.quizResults}>
          <div className={styles.resultsHeader}>
            <div className={styles.resultsEmoji}>
              {scorePercent >= 80 ? "🌟" : scorePercent >= 60 ? "👍" : scorePercent >= 40 ? "💪" : "📚"}
            </div>
            <div className={styles.resultsScore}>
              <span className="text-gradient">{earnedPoints}/{totalPoints}</span>
            </div>
            <p className={styles.resultsLabel}>
              {scorePercent >= 80 ? "Utmärkt! Du visar djup förståelse!" :
               scorePercent >= 60 ? "Bra jobbat! Fortsätt utveckla dina resonemang." :
               scorePercent >= 40 ? "Du är på rätt väg. Repetera materialet." :
               "Kämpa på! Studera med flashcards och försök igen."}
            </p>
          </div>

          {/* Stats by type */}
          <div className={styles.resultsStats}>
            {Object.entries(
              exam.questions.reduce((acc, q) => {
                if (!acc[q.type]) acc[q.type] = { earned: 0, max: 0, count: 0 };
                acc[q.type].max += q.maxPoints;
                acc[q.type].earned += gradings[q.id]?.points || 0;
                acc[q.type].count++;
                return acc;
              }, {})
            ).map(([type, stats]) => (
              <div key={type} className={`card ${styles.resultsStat}`}>
                <div className={styles.resultsStatValue} style={{ 
                  color: stats.earned / stats.max >= 0.7 ? "var(--color-success)" :
                         stats.earned / stats.max >= 0.4 ? "var(--color-warning)" : "var(--color-danger)"
                }}>
                  {stats.earned}/{stats.max}
                </div>
                <div className={styles.resultsStatLabel}>
                  {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                </div>
              </div>
            ))}
          </div>

          {/* Questions review */}
          <h3 style={{ marginBottom: "var(--space-3)" }}>Genomgång</h3>
          <div className={styles.reviewList}>
            {exam.questions.map((q, i) => {
              const g = gradings[q.id];
              return (
                <div key={q.id} className={`card ${styles.reviewItem}`} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                      <span>{TYPE_ICONS[q.type]}</span>
                      <strong style={{ fontSize: "var(--text-sm)" }}>Fråga {i + 1}</strong>
                      <span className={`badge ${
                        g?.grade === "A" ? "badge-success" : g?.grade === "C" ? "badge-warning" :
                        g?.grade === "E" ? "badge-info" : "badge-danger"
                      }`} style={{ fontSize: "var(--text-xs)" }}>
                        {g?.points || 0}/{q.maxPoints}p
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginTop: "var(--space-2)" }}>
                    {q.question.slice(0, 120)}{q.question.length > 120 ? "..." : ""}
                  </p>
                  {g?.feedback && (
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)", fontStyle: "italic" }}>
                      {g.feedback.slice(0, 150)}{g.feedback.length > 150 ? "..." : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* SRS note */}
          <div className="card" style={{ padding: "var(--space-4)", marginTop: "var(--space-4)", background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))" }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              🧠 Kunskapspunkter kopplade till frågor du fick låga poäng på har automatiskt markerats för repetition i dina flashcards.
            </p>
          </div>

          <div className={styles.resultsActions}>
            <button className="btn btn-primary" onClick={handleGenerate}>
              📋 Nytt prov
            </button>
            <button className="btn btn-secondary" onClick={() => { setPhase("setup"); setExam(null); }}>
              ⚙️ Ändra inställningar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
