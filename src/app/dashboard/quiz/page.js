"use client";

import { useState } from "react";
import { useSubject } from "@/lib/subject-context";
import { useMaterial } from "@/lib/material-context";
import { supabase } from "@/lib/supabase";
import styles from "./quiz.module.css";

const DIFFICULTY_OPTIONS = [
  { value: "mixed", emoji: "🎯", label: "Blandad", desc: "E + C + A" },
  { value: "E", emoji: "📗", label: "E-nivå", desc: "Grundläggande" },
  { value: "C", emoji: "📙", label: "C-nivå", desc: "Fördjupad" },
  { value: "A", emoji: "📕", label: "A-nivå", desc: "Avancerad" },
];

export default function QuizPage() {
  const { curriculum } = useSubject();
  const { materials } = useMaterial();
  const availableTopics = curriculum.centralContent.map((cc) => ({
    id: cc.id,
    label: cc.title,
  }));
  const [phase, setPhase] = useState("setup");
  const [sourceType, setSourceType] = useState("curriculum"); // 'curriculum' | 'material'
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [difficulty, setDifficulty] = useState("mixed");
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState([]);

  const toggleTopic = (id) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedTopics.length === availableTopics.length) {
      setSelectedTopics([]);
    } else {
      setSelectedTopics(availableTopics.map((t) => t.id));
    }
  };

  const handleGenerate = async () => {
    setPhase("loading");
    try {
      let payload = {
        questionCount: 5,
        difficulty,
      };

      if (sourceType === "curriculum") {
        const topicLabels = availableTopics
          .filter((t) => selectedTopics.includes(t.id))
          .map((t) => t.label);
        
        if (topicLabels.length === 0) {
          alert("Välj minst ett ämne från kursplanen.");
          setPhase("setup");
          return;
        }
        payload.topics = topicLabels;
      } else {
        if (!selectedMaterialId) {
          alert("Välj ett material.");
          setPhase("setup");
          return;
        }
        const mat = materials.find(m => m.id === selectedMaterialId);
        
        let base64Data = mat.base64Data;
        if (!base64Data && mat.storagePath) {
          const { data, error } = await supabase.storage.from("study_materials").download(mat.storagePath);
          if (error) {
            alert("Kunde inte hämta filen från molnet.");
            setPhase("setup");
            return;
          }
          const reader = new FileReader();
          base64Data = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(data);
          });
        }

        payload.sourceMaterial = {
          filename: mat.filename,
          mimeType: mat.mimeType,
          base64Data,
        };
      }

      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setQuiz(data.quiz);
        setCurrentQ(0);
        setAnswers([]);
        setPhase("active");
      } else {
        alert(data.error || "Kunde inte generera quiz.");
        setPhase("setup");
      }
    } catch (err) {
      console.error(err);
      alert("Ett fel uppstod.");
      setPhase("setup");
    }
  };

  const handleAnswer = (optionIndex) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(optionIndex);
    setShowExplanation(true);
    const isCorrect = optionIndex === quiz.questions[currentQ].correctIndex;
    setAnswers((prev) => [...prev, { questionIndex: currentQ, optionIndex, isCorrect }]);
  };

  const handleNext = () => {
    if (currentQ < quiz.questions.length - 1) {
      setCurrentQ((q) => q + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setPhase("results");
    }
  };

  const handleRestart = () => {
    setPhase("setup");
    setQuiz(null);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setAnswers([]);
  };

  const getOptionClass = (index) => {
    if (selectedAnswer === null) return "";
    const correct = quiz.questions[currentQ].correctIndex;
    if (index === correct) return styles.correct;
    if (index === selectedAnswer && index !== correct) return styles.wrong;
    return "";
  };

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const scorePercent = quiz ? Math.round((correctCount / quiz.questions.length) * 100) : 0;

  const getResultEmoji = () => {
    if (scorePercent >= 80) return "🌟";
    if (scorePercent >= 60) return "👍";
    if (scorePercent >= 40) return "💪";
    return "📚";
  };

  const getResultMessage = () => {
    if (scorePercent >= 80) return "Utmärkt! Du behärskar materialet!";
    if (scorePercent >= 60) return "Bra jobbat! Fortsätt öva.";
    if (scorePercent >= 40) return "Du är på rätt väg. Repetera de svåra delarna.";
    return "Kämpa på! Repetera materialet och försök igen.";
  };

  return (
    <div className={styles.quizPage}>
      <h1>{"❓"} Quiz</h1>

      {phase === "setup" && (
        <div className={styles.quizSetup}>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
            Välj källa och svårighetsgrad för att generera ett quiz med AI.
          </p>

          <h3 style={{ marginBottom: "var(--space-3)" }}>Datakälla</h3>
          <div className={styles.sourceSelector} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            <button
              className={`btn ${sourceType === "curriculum" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setSourceType("curriculum")}
            >
              📖 Kursplanen
            </button>
            <button
              className={`btn ${sourceType === "material" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setSourceType("material")}
            >
              📄 Mitt material
            </button>
          </div>

          <h3 style={{ marginBottom: "var(--space-3)" }}>
            {sourceType === "curriculum" ? "Välj Ämnen" : "Välj Dokument"}
          </h3>
          
          {sourceType === "curriculum" && (
            <div className={styles.topicChips}>
              <button
                className={`${styles.topicChip} ${
                  selectedTopics.length === availableTopics.length ? styles.selected : ""
                }`}
                onClick={selectAll}
              >
                Alla
              </button>
              {availableTopics.map((topic) => (
                <button
                  key={topic.id}
                  className={`${styles.topicChip} ${
                    selectedTopics.includes(topic.id) ? styles.selected : ""
                  }`}
                  onClick={() => toggleTopic(topic.id)}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          )}

          {sourceType === "material" && (
            <div className={styles.topicChips}>
              {materials && materials.length > 0 ? (
                materials.map((mat) => (
                  <button
                    key={mat.id}
                    className={`${styles.topicChip} ${
                      selectedMaterialId === mat.id ? styles.selected : ""
                    }`}
                    onClick={() => setSelectedMaterialId(mat.id)}
                  >
                    📄 {mat.filename}
                  </button>
                ))
              ) : (
                <p style={{ color: "var(--color-text-muted)" }}>Inga uppladdade dokument. Gå till Material för att ladda upp.</p>
              )}
            </div>
          )}

          <h3 style={{ marginBottom: "var(--space-3)", marginTop: "var(--space-6)" }}>Svårighetsgrad</h3>
          <div className={styles.difficultyGrid}>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className={`card ${styles.difficultyCard} ${
                  difficulty === opt.value ? styles.selected : ""
                }`}
                onClick={() => setDifficulty(opt.value)}
              >
                <div className={styles.difficultyEmoji}>{opt.emoji}</div>
                <div className={styles.difficultyLabel}>{opt.label}</div>
                <div className={styles.difficultyDesc}>{opt.desc}</div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary btn-lg"
            disabled={sourceType === "curriculum" ? selectedTopics.length === 0 : !selectedMaterialId}
            onClick={handleGenerate}
          >
            {"🧠"} Generera quiz {sourceType === "curriculum" ? `(${selectedTopics.length} ämne${selectedTopics.length !== 1 ? "n" : ""})` : "(1 dokument)"}
          </button>
        </div>
      )}

      {phase === "loading" && (
        <div className={styles.quizLoading}>
          <div className={styles.quizLoadingIcon}>{"🧠"}</div>
          <h3>Genererar quiz...</h3>
          <p style={{ color: "var(--color-text-secondary)" }}>
            AI skapar frågor baserade på din ämnesplan. Några sekunder...
          </p>
        </div>
      )}

      {phase === "active" && quiz && (
        <div className={styles.quizActive}>
          <div className={styles.quizProgress}>
            <span className={styles.quizProgressText}>
              Fråga {currentQ + 1} / {quiz.questions.length}
            </span>
            <div className={`progress-bar ${styles.quizProgressBar}`}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${((currentQ + (selectedAnswer !== null ? 1 : 0)) / quiz.questions.length) * 100}%`,
                }}
              />
            </div>
            <span
              className={`badge ${
                quiz.questions[currentQ].gradeLevel === "A"
                  ? "badge-success"
                  : quiz.questions[currentQ].gradeLevel === "C"
                  ? "badge-warning"
                  : "badge-danger"
              } ${styles.quizGradeBadge}`}
            >
              {quiz.questions[currentQ].gradeLevel}
            </span>
          </div>

          <div className={`card ${styles.questionCard}`}>
            <p className={styles.questionText}>
              {quiz.questions[currentQ].question}
            </p>

            <div className={styles.optionsList}>
              {quiz.questions[currentQ].options.map((option, i) => (
                <button
                  key={i}
                  className={`${styles.optionBtn} ${getOptionClass(i)}`}
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null}
                >
                  <span className={styles.optionLetter}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{option.replace(/^[A-D]\.\s*/, "")}</span>
                </button>
              ))}
            </div>

            {showExplanation && (
              <div className={styles.explanation}>
                <span className={styles.explanationLabel}>
                  {selectedAnswer === quiz.questions[currentQ].correctIndex
                    ? "✅ Rätt!"
                    : "❌ Fel"}
                </span>
                {quiz.questions[currentQ].explanation}
              </div>
            )}
          </div>

          {selectedAnswer !== null && (
            <button className="btn btn-primary" onClick={handleNext}>
              {currentQ < quiz.questions.length - 1
                ? "Nästa fråga →"
                : "Se resultat →"}
            </button>
          )}
        </div>
      )}

      {phase === "results" && quiz && (
        <div className={styles.quizResults}>
          <div className={styles.resultsHeader}>
            <div className={styles.resultsEmoji}>{getResultEmoji()}</div>
            <div className={styles.resultsScore}>
              <span className="text-gradient">{scorePercent}%</span>
            </div>
            <p className={styles.resultsLabel}>{getResultMessage()}</p>
          </div>

          <div className={styles.resultsStats}>
            <div className={`card ${styles.resultsStat}`}>
              <div className={styles.resultsStatValue} style={{ color: "var(--color-success)" }}>
                {correctCount}
              </div>
              <div className={styles.resultsStatLabel}>Rätt</div>
            </div>
            <div className={`card ${styles.resultsStat}`}>
              <div className={styles.resultsStatValue} style={{ color: "var(--color-danger)" }}>
                {quiz.questions.length - correctCount}
              </div>
              <div className={styles.resultsStatLabel}>Fel</div>
            </div>
            <div className={`card ${styles.resultsStat}`}>
              <div className={styles.resultsStatValue}>
                {quiz.questions.length}
              </div>
              <div className={styles.resultsStatLabel}>Totalt</div>
            </div>
          </div>

          {answers.filter((a) => !a.isCorrect).length > 0 && (
            <>
              <h3 style={{ marginBottom: "var(--space-3)" }}>Att repetera</h3>
              <div className={styles.reviewList}>
                {answers
                  .filter((a) => !a.isCorrect)
                  .map((a, i) => {
                    const q = quiz.questions[a.questionIndex];
                    return (
                      <div key={i} className={`card ${styles.reviewItem}`}>
                        <span className={styles.reviewIcon}>{"📌"}</span>
                        <div className={styles.reviewQuestion}>
                          <strong>{q.question}</strong>
                          <span>
                            Rätt svar:{" "}
                            {q.options[q.correctIndex]?.replace(/^[A-D]\.\s*/, "")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          <div className={styles.resultsActions}>
            <button className="btn btn-primary" onClick={handleGenerate}>
              {"🔄"} Nytt quiz
            </button>
            <button className="btn btn-secondary" onClick={handleRestart}>
              {"⚙️"} Ändra inställningar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
