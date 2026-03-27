"use client";

import { useState } from "react";
import { useSubject } from "@/lib/subject-context";
import { useMaterial } from "@/lib/material-context";
import styles from "./flashcards.module.css";

const TYPE_LABELS = {
  definition: "Definition",
  event: "Händelse",
  cause: "Orsak",
  connection: "Samband",
  concept: "Begrepp",
};

export default function FlashcardsPage() {
  const { curriculum } = useSubject();
  const { materials } = useMaterial();
  const AVAILABLE_TOPICS = curriculum.centralContent.map((cc) => ({
    id: cc.id,
    label: cc.title,
  }));
  const [phase, setPhase] = useState("setup"); // setup | loading | study | results
  const [sourceType, setSourceType] = useState("curriculum"); // 'curriculum' | 'material'
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [cardCount, setCardCount] = useState(10);
  const [deck, setDeck] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState([]); // { cardId, rating: hard|ok|easy }

  const toggleTopic = (id) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedTopics.length === AVAILABLE_TOPICS.length) {
      setSelectedTopics([]);
    } else {
      setSelectedTopics(AVAILABLE_TOPICS.map((t) => t.id));
    }
  };

  const handleGenerate = async () => {
    setPhase("loading");
    try {
      let payload = {
        cardCount
      };

      if (sourceType === "curriculum") {
        const topicLabels = AVAILABLE_TOPICS.filter((t) =>
          selectedTopics.includes(t.id)
        ).map((t) => t.label);
        
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
        payload.sourceMaterial = {
          filename: mat.filename,
          mimeType: mat.mimeType,
          base64Data: mat.base64Data,
        };
      }

      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setDeck(data.deck);
        setCurrentIndex(0);
        setFlipped(false);
        setRatings([]);
        setPhase("study");
      } else {
        alert(data.error || "Kunde inte generera flashcards.");
        setPhase("setup");
      }
    } catch (err) {
      console.error(err);
      alert("Ett fel uppstod. Försök igen.");
      setPhase("setup");
    }
  };

  const handleFlip = () => {
    setFlipped(!flipped);
  };

  const handleRate = (rating) => {
    const card = deck.cards[currentIndex];
    setRatings((prev) => [...prev, { cardId: card.id, rating }]);

    // Move to next card
    if (currentIndex < deck.cards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    } else {
      setPhase("results");
    }
  };

  const handleRestart = () => {
    setPhase("setup");
    setDeck(null);
    setCurrentIndex(0);
    setFlipped(false);
    setRatings([]);
  };

  const handleStudyAgain = () => {
    // Only re-study cards rated "hard"
    if (!deck) return;
    const hardIds = ratings
      .filter((r) => r.rating === "hard")
      .map((r) => r.cardId);

    if (hardIds.length === 0) {
      // All cards mastered, regenerate
      handleGenerate();
      return;
    }

    const hardCards = deck.cards.filter((c) => hardIds.includes(c.id));
    setDeck({ ...deck, cards: hardCards });
    setCurrentIndex(0);
    setFlipped(false);
    setRatings([]);
    setPhase("study");
  };

  const easyCount = ratings.filter((r) => r.rating === "easy").length;
  const okCount = ratings.filter((r) => r.rating === "ok").length;
  const hardCount = ratings.filter((r) => r.rating === "hard").length;

  const currentCard = deck?.cards?.[currentIndex];

  return (
    <div className={styles.flashcardsPage}>
      <h1>🃏 Flashcards</h1>

      {/* === Setup === */}
      {phase === "setup" && (
        <div className={styles.fcSetup}>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
            Välj källa för att generera flashcards med AI.
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
            <div className={styles.fcTopicChips}>
              <button
                className={`${styles.fcTopicChip} ${
                  selectedTopics.length === AVAILABLE_TOPICS.length
                    ? styles.selected
                    : ""
                }`}
                onClick={selectAll}
              >
                Alla
              </button>
              {AVAILABLE_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  className={`${styles.fcTopicChip} ${
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
            <div className={styles.fcTopicChips}>
              {materials && materials.length > 0 ? (
                materials.map((mat) => (
                  <button
                    key={mat.id}
                    className={`${styles.fcTopicChip} ${
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

          <div className={styles.fcCountRow} style={{ marginTop: "var(--space-6)" }}>
            <span className={styles.fcCountLabel}>Antal kort:</span>
            <select
              className={styles.fcCountSelect}
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
            >
              <option value={5}>5 kort</option>
              <option value={10}>10 kort</option>
              <option value={15}>15 kort</option>
              <option value={20}>20 kort</option>
            </select>
          </div>

          <button
            className="btn btn-primary btn-lg"
            disabled={sourceType === "curriculum" ? selectedTopics.length === 0 : !selectedMaterialId}
            onClick={handleGenerate}
          >
            🧠 Generera {cardCount} flashcards {sourceType === "curriculum" ? `(${selectedTopics.length} ämne${selectedTopics.length !== 1 ? "n" : ""})` : "(1 dokument)"}
          </button>
        </div>
      )}

      {/* === Loading === */}
      {phase === "loading" && (
        <div className={styles.fcLoading}>
          <div className={styles.fcLoadingIcon}>🃏</div>
          <h3>Skapar flashcards...</h3>
          <p style={{ color: "var(--color-text-secondary)" }}>
            AI genererar {cardCount} minneslappar. Några sekunder...
          </p>
        </div>
      )}

      {/* === Study === */}
      {phase === "study" && currentCard && (
        <div className={styles.fcStudy}>
          {/* Progress */}
          <div className={styles.fcProgress}>
            <span className={styles.fcProgressText}>
              {currentIndex + 1} / {deck.cards.length}
            </span>
            <div className={`progress-bar ${styles.fcProgressBar}`}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(currentIndex / deck.cards.length) * 100}%`,
                }}
              />
            </div>
            <div className={styles.fcStats}>
              <span className={styles.fcStatGreen}>✓{easyCount}</span>
              <span className={styles.fcStatYellow}>~{okCount}</span>
              <span className={styles.fcStatRed}>✗{hardCount}</span>
            </div>
          </div>

          {/* Card */}
          <div className={styles.fcCardWrapper} onClick={handleFlip}>
            <div
              className={`${styles.fcCard} ${flipped ? styles.flipped : ""}`}
            >
              {/* Front */}
              <div className={`${styles.fcCardFace} ${styles.fcFront}`}>
                <span className={`badge badge-info ${styles.fcCardType}`}>
                  {TYPE_LABELS[currentCard.type] || currentCard.type}
                </span>
                <span
                  className={`badge ${
                    currentCard.gradeLevel === "A"
                      ? "badge-success"
                      : currentCard.gradeLevel === "C"
                      ? "badge-warning"
                      : "badge-danger"
                  } ${styles.fcCardGrade}`}
                >
                  {currentCard.gradeLevel}
                </span>
                <span className={styles.fcFrontLabel}>Fråga</span>
                <p className={styles.fcFrontText}>{currentCard.front}</p>
                <span className={styles.fcFlipHint}>
                  Klicka för att vända →
                </span>
              </div>

              {/* Back */}
              <div className={`${styles.fcCardFace} ${styles.fcBack}`}>
                <span className={`badge badge-info ${styles.fcCardType}`}>
                  {TYPE_LABELS[currentCard.type] || currentCard.type}
                </span>
                <span
                  className={`badge ${
                    currentCard.gradeLevel === "A"
                      ? "badge-success"
                      : currentCard.gradeLevel === "C"
                      ? "badge-warning"
                      : "badge-danger"
                  } ${styles.fcCardGrade}`}
                >
                  {currentCard.gradeLevel}
                </span>
                <span className={styles.fcBackLabel}>Svar</span>
                <p className={styles.fcBackText}>{currentCard.back}</p>
                <span className={styles.fcFlipHint}>
                  Betygsätt dig själv ↓
                </span>
              </div>
            </div>
          </div>

          {/* Rating */}
          {flipped && (
            <div className={styles.fcRatingRow}>
              <button
                className={`${styles.fcRatingBtn} ${styles.hard}`}
                onClick={() => handleRate("hard")}
              >
                <span className={styles.fcRatingEmoji}>😫</span>
                <span className={styles.fcRatingLabel}>Svårt</span>
              </button>
              <button
                className={`${styles.fcRatingBtn} ${styles.ok}`}
                onClick={() => handleRate("ok")}
              >
                <span className={styles.fcRatingEmoji}>🤔</span>
                <span className={styles.fcRatingLabel}>Osäker</span>
              </button>
              <button
                className={`${styles.fcRatingBtn} ${styles.easy}`}
                onClick={() => handleRate("easy")}
              >
                <span className={styles.fcRatingEmoji}>✅</span>
                <span className={styles.fcRatingLabel}>Kan det!</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* === Results === */}
      {phase === "results" && (
        <div className={styles.fcResults}>
          <div className={styles.fcResultsEmoji}>
            {hardCount === 0 ? "🌟" : hardCount <= 2 ? "👍" : "💪"}
          </div>
          <h2>Kortleken klar!</h2>
          <p style={{ color: "var(--color-text-secondary)", marginTop: "var(--space-2)" }}>
            {hardCount === 0
              ? "Fantastiskt! Du behärskar alla kort!"
              : `Du har ${hardCount} kort att repetera.`}
          </p>

          <div className={styles.fcResultsStats}>
            <div className={`card ${styles.fcResultStat}`}>
              <div
                className={styles.fcResultStatValue}
                style={{ color: "var(--color-success)" }}
              >
                {easyCount}
              </div>
              <div className={styles.fcResultStatLabel}>Kan det</div>
            </div>
            <div className={`card ${styles.fcResultStat}`}>
              <div
                className={styles.fcResultStatValue}
                style={{ color: "var(--color-warning)" }}
              >
                {okCount}
              </div>
              <div className={styles.fcResultStatLabel}>Osäker</div>
            </div>
            <div className={`card ${styles.fcResultStat}`}>
              <div
                className={styles.fcResultStatValue}
                style={{ color: "var(--color-danger)" }}
              >
                {hardCount}
              </div>
              <div className={styles.fcResultStatLabel}>Svårt</div>
            </div>
          </div>

          <div className={styles.fcResultsActions}>
            {hardCount > 0 && (
              <button className="btn btn-primary" onClick={handleStudyAgain}>
                🔄 Repetera svåra kort ({hardCount})
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleGenerate}>
              🧠 Ny kortlek
            </button>
            <button className="btn btn-ghost" onClick={handleRestart}>
              ⚙️ Ändra inställningar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
