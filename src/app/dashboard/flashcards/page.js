"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./flashcards.module.css";

const TYPE_LABELS = {
  definition: "Definition",
  event: "Händelse",
  cause: "Orsak",
  connection: "Samband",
  concept: "Begrepp",
};

// ─── SM-2 Simplified ───
function computeNextReview(prevEase, prevInterval, rating) {
  let ease = prevEase;
  let interval = prevInterval;

  if (rating === "hard") {
    ease = Math.max(1.3, ease - 0.2);
    interval = 1;
  } else if (rating === "ok") {
    interval = Math.max(1, Math.round(interval * 1.0));
  } else {
    // easy
    ease = ease + 0.1;
    interval = Math.max(1, Math.round(interval * ease));
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return { ease, interval, nextReviewAt };
}

export default function FlashcardsPage() {
  // ─── State ───
  const [phase, setPhase] = useState("loading"); // loading | deckSelect | study | results
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);

  // Study session
  const [studyCards, setStudyCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionRatings, setSessionRatings] = useState([]); // { cardId, rating }

  // Deck stats (fetched per-deck)
  const [deckStats, setDeckStats] = useState({}); // deckId -> { total, mastered, due, new }

  // ─── Load decks on mount ───
  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("flashcard_decks")
      .select("id, title, total_cards, status, document_id, created_at")
      .eq("user_id", session.user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading decks:", error);
    }

    const fetchedDecks = data || [];
    setDecks(fetchedDecks);

    // Load stats for each deck
    const stats = {};
    for (const deck of fetchedDecks) {
      stats[deck.id] = await loadDeckStats(deck.id, session.user.id);
    }
    setDeckStats(stats);
    setPhase("deckSelect");
  };

  const loadDeckStats = async (deckId, userId) => {
    // Get all cards in this deck
    const { data: cards } = await supabase
      .from("flashcards")
      .select("id")
      .eq("deck_id", deckId);

    const totalCards = cards?.length || 0;
    if (totalCards === 0) return { total: 0, mastered: 0, due: 0, newCards: 0 };

    const cardIds = cards.map((c) => c.id);

    // Get latest review for each card
    const { data: reviews } = await supabase
      .from("flashcard_reviews")
      .select("card_id, rating, interval_days, next_review_at, reviewed_at")
      .eq("user_id", userId)
      .in("card_id", cardIds)
      .order("reviewed_at", { ascending: false });

    // Get latest review per card
    const latestByCard = {};
    if (reviews) {
      for (const r of reviews) {
        if (!latestByCard[r.card_id]) {
          latestByCard[r.card_id] = r;
        }
      }
    }

    const now = new Date();
    let mastered = 0;
    let due = 0;
    let reviewedCardIds = new Set();

    for (const [cardId, review] of Object.entries(latestByCard)) {
      reviewedCardIds.add(cardId);
      if (review.interval_days >= 7 && review.rating === "easy") {
        mastered++;
      } else if (new Date(review.next_review_at) <= now) {
        due++;
      }
    }

    const newCards = totalCards - reviewedCardIds.size;

    return { total: totalCards, mastered, due, newCards };
  };

  // ─── Start study session ───
  const startStudy = async (deckId) => {
    setSelectedDeckId(deckId);
    setPhase("loading");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    // Get all cards in deck
    const { data: allCards } = await supabase
      .from("flashcards")
      .select("*")
      .eq("deck_id", deckId)
      .order("sort_order", { ascending: true });

    if (!allCards || allCards.length === 0) {
      alert("Denna kartlek har inga kort.");
      setPhase("deckSelect");
      return;
    }

    const cardIds = allCards.map((c) => c.id);

    // Get latest reviews
    const { data: reviews } = await supabase
      .from("flashcard_reviews")
      .select("card_id, rating, ease_factor, interval_days, next_review_at, reviewed_at")
      .eq("user_id", session.user.id)
      .in("card_id", cardIds)
      .order("reviewed_at", { ascending: false });

    const latestByCard = {};
    if (reviews) {
      for (const r of reviews) {
        if (!latestByCard[r.card_id]) {
          latestByCard[r.card_id] = r;
        }
      }
    }

    const now = new Date();

    // Categorize
    const newCards = [];
    const dueCards = [];

    for (const card of allCards) {
      const review = latestByCard[card.id];
      if (!review) {
        // Never seen
        newCards.push(card);
      } else if (review.interval_days >= 7 && review.rating === "easy") {
        // Mastered — skip for now
        continue;
      } else if (new Date(review.next_review_at) <= now) {
        // Due for review
        dueCards.push({ ...card, _lastReview: review });
      }
      // else: not yet due, skip
    }

    // Build session: up to 5 due cards + up to 10 new cards
    const sessionCards = [
      ...dueCards.slice(0, 5),
      ...newCards.slice(0, 10),
    ];

    if (sessionCards.length === 0) {
      alert("🎉 Inga kort att studera just nu! Alla kort är antingen behärskade eller inte redo för repetition ännu.");
      setPhase("deckSelect");
      return;
    }

    setStudyCards(sessionCards);
    setCurrentIndex(0);
    setFlipped(false);
    setSessionRatings([]);
    setPhase("study");
  };

  // ─── Handle card rating ───
  const handleRate = async (rating) => {
    const card = studyCards[currentIndex];
    const lastReview = card._lastReview;

    const prevEase = lastReview?.ease_factor || 2.5;
    const prevInterval = lastReview?.interval_days || 0;

    const { ease, interval, nextReviewAt } = computeNextReview(
      prevEase,
      prevInterval,
      rating
    );

    // Save to Supabase
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      await supabase.from("flashcard_reviews").insert({
        user_id: session.user.id,
        card_id: card.id,
        rating,
        ease_factor: ease,
        interval_days: interval,
        next_review_at: nextReviewAt.toISOString(),
      });
    }

    setSessionRatings((prev) => [...prev, { cardId: card.id, rating }]);

    // Move to next card or results
    if (currentIndex < studyCards.length - 1) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    } else {
      // Refresh deck stats before showing results
      if (session) {
        const updatedStats = await loadDeckStats(selectedDeckId, session.user.id);
        setDeckStats((prev) => ({ ...prev, [selectedDeckId]: updatedStats }));
      }
      setPhase("results");
    }
  };

  // ─── Computed values ───
  const currentCard = studyCards[currentIndex];
  const easyCount = sessionRatings.filter((r) => r.rating === "easy").length;
  const okCount = sessionRatings.filter((r) => r.rating === "ok").length;
  const hardCount = sessionRatings.filter((r) => r.rating === "hard").length;
  const selectedDeckStats = deckStats[selectedDeckId];

  return (
    <div className={styles.flashcardsPage}>
      <h1>🃏 Flashcards</h1>

      {/* === Loading === */}
      {phase === "loading" && (
        <div className={styles.fcLoading}>
          <div className={styles.fcLoadingIcon}>🃏</div>
          <h3>Laddar kortlekar...</h3>
        </div>
      )}

      {/* === Deck Selection === */}
      {phase === "deckSelect" && (
        <div className={styles.fcSetup}>
          <p
            style={{
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-6)",
            }}
          >
            Välj en kartlek att studera. Korten repeteras automatiskt baserat på
            din prestation.
          </p>

          {decks.length === 0 ? (
            <div
              className="card"
              style={{ padding: "var(--space-8)", textAlign: "center" }}
            >
              <span style={{ fontSize: "3rem", display: "block", marginBottom: "var(--space-4)" }}>📄</span>
              <h3>Inga kortlekar ännu</h3>
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  marginTop: "var(--space-2)",
                  marginBottom: "var(--space-4)",
                }}
              >
                Ladda upp ett dokument under Material och klicka &quot;Extrahera
                alla kunskapspunkter&quot; för att skapa din första kartlek.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {decks.map((deck) => {
                const stats = deckStats[deck.id] || {
                  total: deck.total_cards,
                  mastered: 0,
                  due: 0,
                  newCards: deck.total_cards,
                };
                const masteryPercent =
                  stats.total > 0
                    ? Math.round((stats.mastered / stats.total) * 100)
                    : 0;
                const actionCount = stats.due + stats.newCards;

                return (
                  <div
                    key={deck.id}
                    className="card"
                    style={{ padding: "var(--space-5)", cursor: "pointer", transition: "border-color 0.2s" }}
                    onClick={() => startStudy(deck.id)}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "var(--space-3)",
                      }}
                    >
                      <div>
                        <h3 style={{ marginBottom: "var(--space-1)" }}>
                          📚 {deck.title}
                        </h3>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {stats.total} kort totalt
                        </span>
                      </div>
                      <button
                        className={`btn ${actionCount > 0 ? "btn-primary" : "btn-secondary"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          startStudy(deck.id);
                        }}
                      >
                        {actionCount > 0
                          ? `📖 Studera (${actionCount})`
                          : "✅ Allt klart!"}
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="progress-bar" style={{ marginBottom: "var(--space-3)" }}>
                      <div
                        className={`progress-bar-fill ${
                          masteryPercent >= 80
                            ? "success"
                            : masteryPercent >= 40
                            ? "warning"
                            : "danger"
                        }`}
                        style={{ width: `${masteryPercent}%` }}
                      />
                    </div>

                    {/* Mini stats */}
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--space-4)",
                        fontSize: "var(--text-xs)",
                      }}
                    >
                      <span style={{ color: "var(--color-success)" }}>
                        ✅ {stats.mastered} behärskade
                      </span>
                      <span style={{ color: "var(--color-warning)" }}>
                        🔄 {stats.due} att repetera
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        🆕 {stats.newCards} nya
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === Study === */}
      {phase === "study" && currentCard && (
        <div className={styles.fcStudy}>
          {/* Progress */}
          <div className={styles.fcProgress}>
            <span className={styles.fcProgressText}>
              {currentIndex + 1} / {studyCards.length}
            </span>
            <div className={`progress-bar ${styles.fcProgressBar}`}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(currentIndex / studyCards.length) * 100}%`,
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
          <div
            className={styles.fcCardWrapper}
            onClick={() => setFlipped(!flipped)}
          >
            <div
              className={`${styles.fcCard} ${flipped ? styles.flipped : ""}`}
            >
              {/* Front */}
              <div className={`${styles.fcCardFace} ${styles.fcFront}`}>
                <span className={`badge badge-info ${styles.fcCardType}`}>
                  {TYPE_LABELS[currentCard.card_type] ||
                    currentCard.card_type}
                </span>
                <span
                  className={`badge ${
                    currentCard.grade_level === "A"
                      ? "badge-success"
                      : currentCard.grade_level === "C"
                      ? "badge-warning"
                      : "badge-danger"
                  } ${styles.fcCardGrade}`}
                >
                  {currentCard.grade_level}
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
                  {TYPE_LABELS[currentCard.card_type] ||
                    currentCard.card_type}
                </span>
                <span
                  className={`badge ${
                    currentCard.grade_level === "A"
                      ? "badge-success"
                      : currentCard.grade_level === "C"
                      ? "badge-warning"
                      : "badge-danger"
                  } ${styles.fcCardGrade}`}
                >
                  {currentCard.grade_level}
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
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Imorgon</span>
              </button>
              <button
                className={`${styles.fcRatingBtn} ${styles.ok}`}
                onClick={() => handleRate("ok")}
              >
                <span className={styles.fcRatingEmoji}>🤔</span>
                <span className={styles.fcRatingLabel}>Osäker</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Om 2-3 dagar</span>
              </button>
              <button
                className={`${styles.fcRatingBtn} ${styles.easy}`}
                onClick={() => handleRate("easy")}
              >
                <span className={styles.fcRatingEmoji}>✅</span>
                <span className={styles.fcRatingLabel}>Kan det!</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Om 1 vecka+</span>
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
          <h2>Session klar!</h2>
          <p
            style={{
              color: "var(--color-text-secondary)",
              marginTop: "var(--space-2)",
            }}
          >
            {hardCount === 0
              ? "Fantastiskt! Du behärskade alla kort i denna session!"
              : `Du har ${hardCount} kort som behöver mer repetition.`}
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

          {/* Deck mastery overview */}
          {selectedDeckStats && (
            <div
              className="card"
              style={{
                padding: "var(--space-5)",
                marginBottom: "var(--space-6)",
                textAlign: "left",
              }}
            >
              <h3 style={{ marginBottom: "var(--space-3)" }}>
                📊 Dokumentets totala framsteg
              </h3>
              <div className="progress-bar" style={{ marginBottom: "var(--space-2)" }}>
                <div
                  className={`progress-bar-fill ${
                    selectedDeckStats.total > 0 &&
                    selectedDeckStats.mastered / selectedDeckStats.total >= 0.8
                      ? "success"
                      : selectedDeckStats.mastered / selectedDeckStats.total >=
                        0.4
                      ? "warning"
                      : "danger"
                  }`}
                  style={{
                    width: `${
                      selectedDeckStats.total > 0
                        ? Math.round(
                            (selectedDeckStats.mastered /
                              selectedDeckStats.total) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span>
                  ✅ {selectedDeckStats.mastered} / {selectedDeckStats.total}{" "}
                  behärskade
                </span>
                <span>
                  {selectedDeckStats.total > 0
                    ? Math.round(
                        (selectedDeckStats.mastered /
                          selectedDeckStats.total) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          )}

          <div className={styles.fcResultsActions}>
            <button
              className="btn btn-primary"
              onClick={() => startStudy(selectedDeckId)}
            >
              📖 Studera igen
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setPhase("deckSelect");
                loadDecks();
              }}
            >
              ← Tillbaka till kortlekar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
