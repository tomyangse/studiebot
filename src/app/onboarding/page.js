"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROGRAMS, YEAR_OPTIONS, SUBJECTS } from "@/lib/curriculum-data";
import styles from "./onboarding.module.css";

const STEPS = ["Program", "Årskurs", "Ämnen"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  const hogskolePrograms = PROGRAMS.filter(
    (p) => p.type === "högskoleförberedande"
  );
  const yrkesPrograms = PROGRAMS.filter((p) => p.type === "yrkesprogram");

  const toggleSubject = (code) => {
    setSelectedSubjects((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleComplete = () => {
    // In production, save to Supabase user profile
    const profile = {
      program: selectedProgram,
      year: selectedYear,
      subjects: selectedSubjects,
    };
    localStorage.setItem("studiemate_profile", JSON.stringify(profile));
    router.push("/dashboard");
  };

  const canProceed = () => {
    if (step === 0) return selectedProgram !== null;
    if (step === 1) return selectedYear !== null;
    if (step === 2) return selectedSubjects.length > 0;
    return false;
  };

  return (
    <div className={styles.onboarding}>
      <div className={styles.onboardingContainer}>
        <div className={styles.onboardingHeader}>
          <h1>Välkommen till StudieMate! 👋</h1>
          <p>Berätta om dig så anpassar vi din studieupplevelse</p>
        </div>

        {/* Step indicator */}
        <div className={styles.stepsIndicator}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <div
                className={`${styles.stepDot} ${
                  i === step ? styles.active : ""
                } ${i < step ? styles.done : ""}`}
              />
              {i < STEPS.length - 1 && (
                <div
                  className={`${styles.stepLine} ${
                    i < step ? styles.done : ""
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Program */}
        {step === 0 && (
          <div className="animate-fade-in">
            <p className={styles.programTypeLabel}>
              Högskoleförberedande program
            </p>
            <div className={styles.programGrid}>
              {hogskolePrograms.map((p) => (
                <div
                  key={p.code}
                  className={`card ${styles.programCard} ${
                    selectedProgram === p.code ? styles.selected : ""
                  }`}
                  onClick={() => setSelectedProgram(p.code)}
                >
                  <div className={styles.programCardIcon}>{p.icon}</div>
                  <div className={styles.programCardName}>{p.name}</div>
                </div>
              ))}
            </div>

            <p className={styles.programTypeLabel}>Yrkesprogram</p>
            <div className={styles.programGrid}>
              {yrkesPrograms.map((p) => (
                <div
                  key={p.code}
                  className={`card ${styles.programCard} ${
                    selectedProgram === p.code ? styles.selected : ""
                  }`}
                  onClick={() => setSelectedProgram(p.code)}
                >
                  <div className={styles.programCardIcon}>{p.icon}</div>
                  <div className={styles.programCardName}>{p.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Year */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className={styles.yearGrid}>
              {YEAR_OPTIONS.map((y) => (
                <div
                  key={y.value}
                  className={`card ${styles.yearCard} ${
                    selectedYear === y.value ? styles.selected : ""
                  }`}
                  onClick={() => setSelectedYear(y.value)}
                >
                  {y.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Subjects */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className={styles.subjectList}>
              {SUBJECTS.map((s) => (
                <div
                  key={s.code}
                  className={`card ${styles.subjectItem} ${
                    selectedSubjects.includes(s.code) ? styles.selected : ""
                  }`}
                  onClick={() => toggleSubject(s.code)}
                >
                  <span className={styles.subjectIcon}>{s.icon}</span>
                  <div className={styles.subjectInfo}>
                    <div className={styles.subjectName}>{s.name}</div>
                    <div className={styles.subjectLevels}>
                      {s.levels.length} nivåer
                    </div>
                  </div>
                  <div className={styles.subjectCheck}>
                    {selectedSubjects.includes(s.code) && "✓"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.onboardingActions}>
          {step > 0 ? (
            <button
              className="btn btn-secondary"
              onClick={() => setStep((s) => s - 1)}
            >
              ← Tillbaka
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <button
              className="btn btn-primary"
              disabled={!canProceed()}
              onClick={() => setStep((s) => s + 1)}
            >
              Nästa →
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              disabled={!canProceed()}
              onClick={handleComplete}
            >
              🚀 Börja studera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
