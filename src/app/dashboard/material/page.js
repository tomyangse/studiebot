"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";
import styles from "./material.module.css";

export default function MaterialPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    }
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      // For MVP, we pass the hardcoded subject code HIS (Historia 1b)
      formData.append("subjectCode", "HIS");

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setAnalysisResult(data.result);
      } else {
        alert(data.error || "Ett fel uppstod vid analysen.");
      }
    } catch (err) {
      console.error(err);
      alert("Kunde inte analysera dokumentet. Kontrollera din Gemini API Key och försök igen.");
    } finally {
      setAnalyzing(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className={styles.materialPage}>
      <h1>📄 Material</h1>
      <p>Ladda upp studiematerial för AI-analys och ämnesplan-matchning.</p>

      {/* Upload Zone */}
      {!file && (
        <div
          className={`${styles.uploadZone} ${dragging ? styles.dragging : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.uploadZoneIcon}>📤</div>
          <h3>Dra och släpp din PDF här</h3>
          <p>eller klicka för att välja fil</p>
          <div className={styles.uploadFormats}>
            <span className={styles.uploadFormatTag}>PDF</span>
            <span className={styles.uploadFormatTag}>Max 20 MB</span>
          </div>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Uploaded file */}
      {file && !analyzing && !analysisResult && (
        <div className="animate-fade-in">
          <div className={`card ${styles.uploadedFile}`}>
            <div className={styles.uploadedFileIcon}>📕</div>
            <div className={styles.uploadedFileInfo}>
              <div className={styles.uploadedFileName}>{file.name}</div>
              <div className={styles.uploadedFileMeta}>
                {formatFileSize(file.size)} • PDF
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            <button className="btn btn-primary btn-lg" onClick={handleAnalyze}>
              🧠 Analysera med AI
            </button>
            <button className="btn btn-secondary" onClick={() => setFile(null)}>
              Byt fil
            </button>
          </div>
        </div>
      )}

      {/* Analyzing */}
      {analyzing && (
        <div className={styles.analysisLoading}>
          <div className={styles.analysisLoadingIcon}>🧠</div>
          <h3>Analyserar ditt material...</h3>
          <p>AI läser dokumentet och matchar mot ämnesplanen. Detta kan ta en stund.</p>
          <div className="progress-bar" style={{ maxWidth: 300, margin: "var(--space-4) auto" }}>
            <div
              className="progress-bar-fill"
              style={{ width: "60%", animation: "pulse-soft 1.5s infinite" }}
            />
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className={styles.analysisSection}>
          <h2>Analysresultat</h2>
          <p
            style={{
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-6)",
            }}
          >
            Matchat mot: <strong>{analysisResult.subjectMatch}</strong> —{" "}
            Centralt innehåll
          </p>

          {/* Coverage Summary */}
          <div className={styles.coverageSummary}>
            <div className={`card ${styles.coverageStat}`}>
              <div
                className={styles.coverageStatValue}
                style={{ color: "var(--color-success)" }}
              >
                {analysisResult.coveredCount}
              </div>
              <div className={styles.coverageStatLabel}>Täckta punkter</div>
            </div>
            <div className={`card ${styles.coverageStat}`}>
              <div
                className={styles.coverageStatValue}
                style={{ color: "var(--color-warning)" }}
              >
                {analysisResult.partialCount}
              </div>
              <div className={styles.coverageStatLabel}>Delvis täckta</div>
            </div>
            <div className={`card ${styles.coverageStat}`}>
              <div
                className={styles.coverageStatValue}
                style={{ color: "var(--color-danger)" }}
              >
                {analysisResult.missingCount}
              </div>
              <div className={styles.coverageStatLabel}>Luckor</div>
            </div>
          </div>

          {/* Total coverage bar */}
          <div className="card" style={{ padding: "var(--space-5)", marginBottom: "var(--space-6)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "var(--space-2)",
              }}
            >
              <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" }}>
                Ämnesplan-täckning
              </span>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-bold)" }}>
                {analysisResult.overallCoverage}%
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-bar-fill ${
                  analysisResult.overallCoverage > 70
                    ? "success"
                    : analysisResult.overallCoverage > 40
                    ? "warning"
                    : "danger"
                }`}
                style={{ width: `${analysisResult.overallCoverage}%` }}
              />
            </div>
          </div>

          {/* Knowledge Tree */}
          <h2 style={{ marginBottom: "var(--space-4)" }}>
            Kunskapspunkter — Centralt innehåll
          </h2>
          <div className={styles.knowledgeTree}>
            {analysisResult.curriculumMapping.map((item) => (
              <div key={item.id} className={`card ${styles.knowledgeItem}`}>
                <div
                  className={`${styles.knowledgeItemIndicator} ${
                    styles[item.coverage]
                  }`}
                />
                <div className={styles.knowledgeItemContent}>
                  <div className={styles.knowledgeItemTitle}>{item.title}</div>
                  <div className={styles.knowledgeItemDesc}>
                    {item.description}
                  </div>
                  <div className={styles.knowledgeItemGrades}>
                    <span className={`${styles.gradeTag} ${styles.gradeE}`}>
                      E
                    </span>
                    <span className={`${styles.gradeTag} ${styles.gradeC}`}>
                      C
                    </span>
                    <span className={`${styles.gradeTag} ${styles.gradeA}`}>
                      A
                    </span>
                    <span
                      className={`badge ${
                        item.coverage === "covered"
                          ? "badge-success"
                          : item.coverage === "partial"
                          ? "badge-warning"
                          : "badge-danger"
                      }`}
                      style={{ marginLeft: "auto" }}
                    >
                      {item.coverage === "covered"
                        ? "✓ Täckt"
                        : item.coverage === "partial"
                        ? "⚠ Delvis"
                        : "✗ Lucka"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              marginTop: "var(--space-6)",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn btn-primary"
              onClick={() => router.push("/dashboard/quiz")}
            >
              ❓ Skapa quiz från detta material
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => router.push("/dashboard/flashcards")}
            >
              🃏 Generera flashcards
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setFile(null);
                setAnalysisResult(null);
              }}
            >
              📄 Ladda upp nytt material
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
