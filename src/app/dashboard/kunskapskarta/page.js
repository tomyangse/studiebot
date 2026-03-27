"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSubject } from "@/lib/subject-context";
import { supabase } from "@/lib/supabase";
import styles from "./kunskapskarta.module.css";



function getStatus(mastery) {
  if (mastery >= 80) return "mastered";
  if (mastery >= 50) return "learning";
  if (mastery > 0) return "weak";
  return "untouched";
}

function getStatusLabel(status) {
  switch (status) {
    case "mastered": return "Behärskad";
    case "learning": return "Pågående";
    case "weak": return "Svag";
    default: return "Ej påbörjad";
  }
}

function getStatusBadge(status) {
  switch (status) {
    case "mastered": return "badge-success";
    case "learning": return "badge-warning";
    case "weak": return "badge-danger";
    default: return "badge-secondary";
  }
}

function getGradeStatus(mastery) {
  // Determine which grade level the student can currently reach
  return {
    e: mastery >= 30,
    c: mastery >= 60,
    a: mastery >= 85,
  };
}

export default function KunskapskartaPage() {
  const router = useRouter();
  const { curriculum } = useSubject();
  const [expandedNode, setExpandedNode] = useState(null);
  const [progress, setProgress] = useState({});
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [deletingDocId, setDeletingDocId] = useState(null);

  useEffect(() => {
    loadRealProgress();
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Get documents with their associated decks
    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, file_size, subject_code, status, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!docs) return;

    // Get decks linked to these documents
    const docIds = docs.map(d => d.id);
    const { data: decks } = await supabase
      .from('flashcard_decks')
      .select('id, document_id, total_cards, status')
      .in('document_id', docIds);

    // Get analysis data
    const { data: analyses } = await supabase
      .from('document_analysis')
      .select('document_id, extracted_topics, overall_coverage')
      .in('document_id', docIds);

    // Merge data
    const enriched = docs.map(doc => {
      const deck = decks?.find(d => d.document_id === doc.id);
      const analysis = analyses?.find(a => a.document_id === doc.id);
      return {
        ...doc,
        deck,
        analysis,
      };
    });

    setDocuments(enriched);
  };

  const handleDeleteDocument = async (doc) => {
    if (!confirm(`Är du säker att du vill ta bort "${doc.file_name}"? Alla tillhörande flashcards och quiz-data kommer att raderas.`)) {
      return;
    }

    setDeletingDocId(doc.id);

    try {
      // 1. Delete flashcard decks (cascades to flashcards -> reviews)
      await supabase.from('flashcard_decks').delete().eq('document_id', doc.id);

      // 2. Delete analysis
      await supabase.from('document_analysis').delete().eq('document_id', doc.id);

      // 3. Delete from storage
      const { data: docData } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', doc.id)
        .single();

      if (docData?.storage_path) {
        await supabase.storage.from('study_materials').remove([docData.storage_path]);
      }

      // 4. Delete document record
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) {
        alert(`Kunde inte ta bort: ${error.message}`);
        return;
      }

      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      loadRealProgress();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Kunde inte ta bort dokumentet.');
    } finally {
      setDeletingDocId(null);
    }
  };

  const loadRealProgress = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoadingProgress(false);
      return;
    }

    // Get all user's decks with their cards
    const { data: decks } = await supabase
      .from('flashcard_decks')
      .select('id, total_cards')
      .eq('user_id', session.user.id)
      .eq('status', 'ready');

    if (!decks || decks.length === 0) {
      setLoadingProgress(false);
      return;
    }

    // Get all cards across all decks
    const deckIds = decks.map(d => d.id);
    const { data: allCards } = await supabase
      .from('flashcards')
      .select('id, deck_id')
      .in('deck_id', deckIds);

    const totalCards = allCards?.length || 0;
    if (totalCards === 0) {
      setLoadingProgress(false);
      return;
    }

    const cardIds = allCards.map(c => c.id);

    // Get all reviews
    const { data: reviews } = await supabase
      .from('flashcard_reviews')
      .select('card_id, rating, interval_days, next_review_at')
      .eq('user_id', session.user.id)
      .in('card_id', cardIds)
      .order('reviewed_at', { ascending: false });

    // Build latest review per card
    const latestByCard = {};
    if (reviews) {
      for (const r of reviews) {
        if (!latestByCard[r.card_id]) latestByCard[r.card_id] = r;
      }
    }

    let mastered = 0;
    let reviewed = 0;
    for (const review of Object.values(latestByCard)) {
      reviewed++;
      if (review.interval_days >= 7 && review.rating === 'easy') mastered++;
    }

    // Compute a single overall mastery percentage
    const overallMastery = totalCards > 0 ? Math.round((mastered / totalCards) * 100) : 0;
    const flashcardsDone = reviewed;
    const documentsCount = decks.length;

    // Distribute evenly across all curriculum nodes (since cards aren't mapped to specific CC yet)
    const newProgress = {};
    for (const cc of curriculum.centralContent) {
      newProgress[cc.id] = {
        mastery: overallMastery,
        quizScore: 0,
        flashcardsDone: Math.round(flashcardsDone / curriculum.centralContent.length),
        documentsCount,
      };
    }
    setProgress(newProgress);
    setLoadingProgress(false);
  };

  const nodes = curriculum.centralContent.map((cc) => ({
    ...cc,
    progress: progress[cc.id] || { mastery: 0, quizScore: 0, flashcardsDone: 0, documentsCount: 0 },
  }));

  // Overall stats
  const avgMastery = Math.round(
    nodes.reduce((sum, n) => sum + n.progress.mastery, 0) / nodes.length
  );
  const masteredCount = nodes.filter((n) => getStatus(n.progress.mastery) === "mastered").length;
  const learningCount = nodes.filter((n) => getStatus(n.progress.mastery) === "learning").length;
  const weakCount = nodes.filter((n) => ["weak", "untouched"].includes(getStatus(n.progress.mastery))).length;

  // Find the weakest area for recommendation
  const weakestNode = [...nodes].sort((a, b) => a.progress.mastery - b.progress.mastery)[0];

  return (
    <div className={styles.kmPage}>
      <h1>🗺️ Kunskapskarta</h1>
      <p className={styles.kmSubtitle}>
        Visualisering av din kunskap mot ämnesplanen för {curriculum.levelName}
      </p>

      {/* Summary stats */}
      <div className={styles.kmSummary}>
        <div className={`card ${styles.kmSummaryStat}`}>
          <div className={styles.kmSummaryValue}>
            <span className="text-gradient">{avgMastery}%</span>
          </div>
          <div className={styles.kmSummaryLabel}>Total behärskning</div>
        </div>
        <div className={`card ${styles.kmSummaryStat}`}>
          <div className={styles.kmSummaryValue} style={{ color: "var(--color-success)" }}>
            {masteredCount}
          </div>
          <div className={styles.kmSummaryLabel}>Behärskade</div>
        </div>
        <div className={`card ${styles.kmSummaryStat}`}>
          <div className={styles.kmSummaryValue} style={{ color: "var(--color-warning)" }}>
            {learningCount}
          </div>
          <div className={styles.kmSummaryLabel}>Pågående</div>
        </div>
        <div className={`card ${styles.kmSummaryStat}`}>
          <div className={styles.kmSummaryValue} style={{ color: "var(--color-danger)" }}>
            {weakCount}
          </div>
          <div className={styles.kmSummaryLabel}>Behöver arbete</div>
        </div>
      </div>

      {/* Subject header */}
      <div className={`card ${styles.kmSubjectHeader}`}>
        <span className={styles.kmSubjectIcon}>{curriculum.icon}</span>
        <div className={styles.kmSubjectInfo}>
          <div className={styles.kmSubjectName}>{curriculum.levelName}</div>
          <div className={styles.kmSubjectMeta}>
            {nodes.length} kunskapspunkter • 100 poäng
          </div>
        </div>
        <div className={styles.kmSubjectProgress}>
          <div className={`progress-bar ${styles.kmSubjectProgressBar}`}>
            <div
              className={`progress-bar-fill ${avgMastery > 70 ? "success" : avgMastery > 40 ? "warning" : "danger"}`}
              style={{ width: `${avgMastery}%` }}
            />
          </div>
          <span className={styles.kmSubjectPercent}>{avgMastery}%</span>
        </div>
      </div>

      {/* Legend */}
      <div className={`card ${styles.kmLegend}`}>
        <div className={styles.kmLegendItem}>
          <div className={`${styles.kmLegendDot} ${styles.mastered}`} />
          <span>Behärskad (≥80%)</span>
        </div>
        <div className={styles.kmLegendItem}>
          <div className={`${styles.kmLegendDot} ${styles.learning}`} />
          <span>Pågående (50-79%)</span>
        </div>
        <div className={styles.kmLegendItem}>
          <div className={`${styles.kmLegendDot} ${styles.weak}`} />
          <span>Svag (1-49%)</span>
        </div>
        <div className={styles.kmLegendItem}>
          <div className={`${styles.kmLegendDot} ${styles.untouched}`} />
          <span>Ej påbörjad</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className={styles.kmHeatmapGrid}>
        {nodes.map((node) => {
          const status = getStatus(node.progress.mastery);
          const grades = getGradeStatus(node.progress.mastery);
          const isExpanded = expandedNode === node.id;

          return (
            <div
              key={node.id}
              className={`card ${styles.kmNode} ${styles[status]}`}
              onClick={() => setExpandedNode(isExpanded ? null : node.id)}
            >
              <div className={styles.kmNodeHeader}>
                <span className={styles.kmNodeTitle}>{node.title}</span>
                <span className={`badge ${getStatusBadge(status)} ${styles.kmNodeStatus}`}>
                  {getStatusLabel(status)}
                </span>
              </div>

              <p className={styles.kmNodeDesc}>{node.description}</p>

              <div className={styles.kmNodeFooter}>
                <div className={`progress-bar ${styles.kmNodeBar}`}>
                  <div
                    className={`progress-bar-fill ${
                      status === "mastered" ? "success" : status === "learning" ? "warning" : "danger"
                    }`}
                    style={{ width: `${node.progress.mastery}%` }}
                  />
                </div>
                <span className={styles.kmNodePercent}>{node.progress.mastery}%</span>
              </div>

              {/* Grade pills */}
              <div className={styles.kmGrades}>
                <span className={`${styles.kmGradePill} ${styles.e}`}>
                  <span className={styles.kmGradeIcon}>{grades.e ? "●" : "○"}</span> E
                </span>
                <span className={`${styles.kmGradePill} ${styles.c}`}>
                  <span className={styles.kmGradeIcon}>{grades.c ? "●" : "○"}</span> C
                </span>
                <span className={`${styles.kmGradePill} ${styles.a}`}>
                  <span className={styles.kmGradeIcon}>{grades.a ? "●" : "○"}</span> A
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className={styles.kmDetail}>
                  <div className={styles.kmDetailRow}>
                    <span className={styles.kmDetailLabel}>Quiz-poäng</span>
                    <span className={styles.kmDetailValue}>
                      {node.progress.quizScore > 0 ? `${node.progress.quizScore}%` : "—"}
                    </span>
                  </div>
                  <div className={styles.kmDetailRow}>
                    <span className={styles.kmDetailLabel}>Flashcards gjorda</span>
                    <span className={styles.kmDetailValue}>{node.progress.flashcardsDone}</span>
                  </div>
                  <div className={styles.kmDetailRow}>
                    <span className={styles.kmDetailLabel}>Dokument analyserade</span>
                    <span className={styles.kmDetailValue}>{node.progress.documentsCount}</span>
                  </div>

                  {/* Grade criteria */}
                  <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)" }}>
                    <div className={styles.kmDetailRow}>
                      <span className={styles.kmDetailLabel}>E-krav</span>
                      <span className={styles.kmDetailValue} style={{ textAlign: "right", maxWidth: "70%" }}>
                        {node.gradeE}
                      </span>
                    </div>
                    <div className={styles.kmDetailRow}>
                      <span className={styles.kmDetailLabel}>C-krav</span>
                      <span className={styles.kmDetailValue} style={{ textAlign: "right", maxWidth: "70%" }}>
                        {node.gradeC}
                      </span>
                    </div>
                    <div className={styles.kmDetailRow}>
                      <span className={styles.kmDetailLabel}>A-krav</span>
                      <span className={styles.kmDetailValue} style={{ textAlign: "right", maxWidth: "70%" }}>
                        {node.gradeA}
                      </span>
                    </div>
                  </div>

                  <div className={styles.kmDetailActions}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); router.push("/dashboard/quiz"); }}
                    >
                      ❓ Quiz
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); router.push("/dashboard/flashcards"); }}
                    >
                      🃏 Flashcards
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); router.push("/dashboard/material"); }}
                    >
                      📄 Material
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Recommendation */}
      {weakestNode && (
        <div className={`card ${styles.kmRecommendation}`}>
          <span className={styles.kmRecommendationIcon}>🤖</span>
          <div className={styles.kmRecommendationContent}>
            <h3>AI-rekommendation</h3>
            <p>
              Ditt svagaste område är <strong>{weakestNode.title}</strong> ({weakestNode.progress.mastery}%).
              {weakestNode.progress.documentsCount === 0
                ? " Ladda upp studiematerial som täcker detta område för att komma igång."
                : weakestNode.progress.quizScore === 0
                ? " Prova att göra ett quiz för att testa din förståelse."
                : " Fortsätt repetera med flashcards och quiz för att stärka din kunskap."}
            </p>
            <div className={styles.kmRecommendationActions}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() =>
                  router.push(
                    weakestNode.progress.documentsCount === 0
                      ? "/dashboard/material"
                      : "/dashboard/quiz"
                  )
                }
              >
                {weakestNode.progress.documentsCount === 0
                  ? "📄 Ladda upp material"
                  : "❓ Starta quiz"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* === Uploaded Documents Section === */}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <h2 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          📄 Uppladdat material
          <span className="badge badge-info" style={{ fontSize: 'var(--text-xs)' }}>{documents.length}</span>
        </h2>

        {documents.length === 0 ? (
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Inga dokument uppladdade ännu. Gå till Material för att ladda upp studiematerial.
            </p>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 'var(--space-3)' }}
              onClick={() => router.push('/dashboard/material')}
            >
              📄 Ladda upp material
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {documents.map((doc) => {
              const sizeStr = doc.file_size
                ? doc.file_size < 1024 * 1024
                  ? `${(doc.file_size / 1024).toFixed(1)} KB`
                  : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`
                : '';
              const dateStr = new Date(doc.created_at).toLocaleDateString('sv-SE');
              const hasDeck = doc.deck && doc.deck.status === 'ready';
              const cardCount = doc.deck?.total_cards || 0;
              const coverage = doc.analysis?.overall_coverage || 0;
              const topics = doc.analysis?.extracted_topics || [];

              return (
                <div key={doc.id} className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontSize: '1.2rem' }}>
                          {doc.file_name.endsWith('.pdf') ? '📕' : doc.file_name.match(/\.(png|jpg|jpeg)$/i) ? '🖼️' : '📄'}
                        </span>
                        <strong style={{ fontSize: 'var(--text-sm)' }}>{doc.file_name}</strong>
                        <span className={`badge ${doc.status === 'done' ? 'badge-success' : doc.status === 'error' ? 'badge-danger' : 'badge-warning'}`}
                              style={{ fontSize: 'var(--text-xs)' }}>
                          {doc.status === 'done' ? '✓ Klar' : doc.status === 'error' ? 'Fel' : 'Bearbetar...'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                        {sizeStr && <span>📦 {sizeStr}</span>}
                        <span>📅 {dateStr}</span>
                        {coverage > 0 && <span>📊 {coverage}% täckning</span>}
                        {hasDeck && <span style={{ color: 'var(--color-success)' }}>🃏 {cardCount} flashcards</span>}
                      </div>

                      {topics.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                          {topics.slice(0, 5).map((t, i) => (
                            <span key={i} style={{
                              fontSize: 'var(--text-xs)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-muted)',
                            }}>
                              {typeof t === 'string' ? t : t.title || t.name || ''}
                            </span>
                          ))}
                          {topics.length > 5 && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>+{topics.length - 5} till</span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)', flexShrink: 0 }}
                      disabled={deletingDocId === doc.id}
                      onClick={() => handleDeleteDocument(doc)}
                    >
                      {deletingDocId === doc.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
