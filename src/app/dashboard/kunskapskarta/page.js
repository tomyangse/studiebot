"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";
import styles from "./kunskapskarta.module.css";

// Mock progress data — in production this comes from DB after analysis
const MOCK_PROGRESS = {
  cc1: { mastery: 20, quizScore: 0, flashcardsDone: 0, documentsCount: 0 },
  cc2: { mastery: 65, quizScore: 72, flashcardsDone: 8, documentsCount: 1 },
  cc3: { mastery: 40, quizScore: 50, flashcardsDone: 3, documentsCount: 1 },
  cc4: { mastery: 10, quizScore: 0, flashcardsDone: 0, documentsCount: 0 },
  cc5: { mastery: 0, quizScore: 0, flashcardsDone: 0, documentsCount: 0 },
};

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
  const [expandedNode, setExpandedNode] = useState(null);

  const curriculum = HISTORIA_1B_CURRICULUM;
  const nodes = curriculum.centralContent.map((cc) => ({
    ...cc,
    progress: MOCK_PROGRESS[cc.id] || { mastery: 0, quizScore: 0, flashcardsDone: 0, documentsCount: 0 },
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
        <span className={styles.kmSubjectIcon}>📜</span>
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
    </div>
  );
}
