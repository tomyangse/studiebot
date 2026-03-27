"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HISTORIA_1B_CURRICULUM } from "@/lib/curriculum-data";
import { useSubject } from "@/lib/subject-context";
import { useMaterial } from "@/lib/material-context";
import { supabase } from "@/lib/supabase";
import styles from "./material.module.css";

export default function MaterialPage() {
  const router = useRouter();
  const { activeSubject } = useSubject();
  const { addMaterial } = useMaterial();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [lastDocId, setLastDocId] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);
  const [existingDocs, setExistingDocs] = useState([]);
  const [deletingDocId, setDeletingDocId] = useState(null);

  useEffect(() => {
    loadExistingDocs();
  }, []);

  const loadExistingDocs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, file_size, status, created_at, storage_path')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!docs) return;

    const docIds = docs.map(d => d.id);
    const { data: decks } = await supabase
      .from('flashcard_decks')
      .select('document_id, total_cards, status')
      .in('document_id', docIds);

    const enriched = docs.map(doc => ({
      ...doc,
      deck: decks?.find(d => d.document_id === doc.id),
    }));

    setExistingDocs(enriched);
  };

  const handleDeleteDoc = async (doc) => {
    if (!confirm(`Ta bort "${doc.file_name}"? Alla flashcards och quiz-data raderas.`)) return;
    setDeletingDocId(doc.id);
    try {
      // 1. Delete associated flashcard decks (cascades to flashcards -> flashcard_reviews)
      const { error: deckError } = await supabase
        .from('flashcard_decks')
        .delete()
        .eq('document_id', doc.id);
      if (deckError) console.warn('Deck delete warning:', deckError.message);

      // 2. Delete analysis records
      const { error: analysisError } = await supabase
        .from('document_analysis')
        .delete()
        .eq('document_id', doc.id);
      if (analysisError) console.warn('Analysis delete warning:', analysisError.message);

      // 3. Delete from storage
      if (doc.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('study_materials')
          .remove([doc.storage_path]);
        if (storageError) console.warn('Storage delete warning:', storageError.message);
      }

      // 4. Delete the document record itself
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (docError) {
        console.error('Document delete error:', docError);
        alert(`Kunde inte ta bort: ${docError.message}`);
        return;
      }

      setExistingDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Kunde inte ta bort dokumentet.');
    } finally {
      setDeletingDocId(null);
    }
  };

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
    if (dropped) {
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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Du måste vara inloggad för att ladda upp material.");
      router.push("/login");
      return;
    }
    const user = session.user;

    setAnalyzing(true);

    try {
      // 1. Ladda upp till Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('study_materials')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // 2. Skapa dokument-post i databasen
      const { data: dbDoc, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          storage_path: filePath,
          file_size: file.size,
          subject_code: activeSubject.code || "HIS",
          status: 'analyzing'
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`DB insert failed: ${dbError.message}`);
      }

      // 3. Analysera via Gemini
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subjectCode", activeSubject.code || "HIS");

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const parsedData = await response.json();

      if (parsedData.success) {
        setAnalysisResult(parsedData.result);
        
        // 4. Spara analysen i DB
        await supabase.from('document_analysis').insert({
          document_id: dbDoc.id,
          extracted_topics: parsedData.result.coveredTopics || [],
          curriculum_mapping: parsedData.result.curriculumMapping || [],
          overall_coverage: parsedData.result.overallCoverage || 0
        });

        // Ändra status till done
        await supabase.from('documents').update({ status: 'done' }).eq('id', dbDoc.id);
        setLastDocId(dbDoc.id);
        
        // Konvertera fil till base64 för kontext (snabblösning för MVP cache i minne)
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64Data = reader.result.split(",")[1];
          addMaterial({
            id: dbDoc.id,
            filename: file.name,
            mimeType: file.type || "application/pdf",
            base64Data,
            storagePath: filePath,
            analysisResult: parsedData.result,
          });
        };
      } else {
        await supabase.from('documents').update({ status: 'error' }).eq('id', dbDoc.id);
        alert(parsedData.error || "Ett fel uppstod vid analysen.");
      }
    } catch (err) {
      console.error(err);
      alert(`Kunde inte ladda upp/analysera: ${err.message}`);
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
          <h3>Dra och släpp ditt dokument här</h3>
          <p>eller klicka för att välja fil</p>
          <div className={styles.uploadFormats}>
            <span className={styles.uploadFormatTag}>PDF / BILD / TXT</span>
            <span className={styles.uploadFormatTag}>Max 20 MB</span>
          </div>
          <input
            type="file"
            accept=".pdf,image/*,.txt,.md,.csv"
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

          {/* Extract Knowledge Points */}
          {!extractResult && (
            <div className="card" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', borderColor: 'var(--color-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <span style={{ fontSize: '2.5rem' }}>🧠</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: 'var(--space-1)' }}>Extrahera alla kunskapspunkter</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    AI analyserar hela dokumentet och skapar flashcards för varje enskild faktapunkt. Inga luckor – 100% täckning.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-lg"
                  disabled={extracting || !lastDocId}
                  onClick={async () => {
                    setExtracting(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch('/api/extract-cards', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ documentId: lastDocId, accessToken: session.access_token }),
                      });
                      const result = await res.json();
                      if (result.success) {
                        setExtractResult(result);
                      } else {
                        alert(result.error || 'Extraktion misslyckades');
                      }
                    } catch (e) {
                      console.error(e);
                      alert('Kunde inte extrahera kunskapspunkter.');
                    } finally {
                      setExtracting(false);
                    }
                  }}
                >
                  {extracting ? '⚙️ Extraherar...' : '🧠 Extrahera nu'}
                </button>
              </div>
            </div>
          )}

          {/* Extraction Result */}
          {extractResult && (
            <div className="card" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)', background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.1))', borderColor: 'var(--color-success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <span style={{ fontSize: '2.5rem' }}>✅</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: 'var(--space-1)', color: 'var(--color-success)' }}>
                    {extractResult.totalCards} kunskapspunkter extraherade!
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    Alla kort från "{extractResult.deckTitle}" har sparats i din kartlek. Gå till Flashcards för att börja studera.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push('/dashboard/flashcards')}
                >
                  🃏 Börja studera
                </button>
              </div>
            </div>
          )}

          {/* Other Actions */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              marginTop: "var(--space-6)",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => router.push("/dashboard/quiz")}
            >
              ❓ Skapa quiz från detta material
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setFile(null);
                setAnalysisResult(null);
                setExtractResult(null);
                setLastDocId(null);
              }}
            >
              📄 Ladda upp nytt material
            </button>
          </div>
        </div>
      )}

      {/* === Existing Documents === */}
      {!file && !analysisResult && existingDocs.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h2 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            📁 Uppladdade dokument
            <span className="badge badge-info" style={{ fontSize: 'var(--text-xs)' }}>{existingDocs.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {existingDocs.map((doc) => {
              const sizeStr = doc.file_size
                ? doc.file_size < 1024 * 1024
                  ? `${(doc.file_size / 1024).toFixed(1)} KB`
                  : `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`
                : '';
              const dateStr = new Date(doc.created_at).toLocaleDateString('sv-SE');
              const hasDeck = doc.deck && doc.deck.status === 'ready';
              const cardCount = doc.deck?.total_cards || 0;

              return (
                <div key={doc.id} className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: '1.2rem' }}>
                          {doc.file_name.endsWith('.pdf') ? '📕' : doc.file_name.match(/\.(png|jpg|jpeg)$/i) ? '🖼️' : '📄'}
                        </span>
                        <strong style={{ fontSize: 'var(--text-sm)' }}>{doc.file_name}</strong>
                        <span className={`badge ${doc.status === 'done' ? 'badge-success' : doc.status === 'error' ? 'badge-danger' : 'badge-warning'}`}
                              style={{ fontSize: 'var(--text-xs)' }}>
                          {doc.status === 'done' ? '✓ Klar' : doc.status === 'error' ? 'Fel' : 'Bearbetar...'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {sizeStr && <span>📦 {sizeStr}</span>}
                        <span>📅 {dateStr}</span>
                        {hasDeck && <span style={{ color: 'var(--color-success)' }}>🃏 {cardCount} flashcards</span>}
                        {!hasDeck && doc.status === 'done' && <span style={{ color: 'var(--color-warning)' }}>⚠️ Ej extraherad</span>}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-danger)', flexShrink: 0 }}
                      disabled={deletingDocId === doc.id}
                      onClick={() => handleDeleteDoc(doc)}
                    >
                      {deletingDocId === doc.id ? '⏳' : '🗑️ Ta bort'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
