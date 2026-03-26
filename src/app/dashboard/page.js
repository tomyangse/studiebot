"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./overview.module.css";

const MOCK_SUBJECTS = [
  { icon: "📜", name: "Historia 1b", progress: 35, points: "100p", status: "active" },
];

const MOCK_TASKS = [
  { id: 1, text: "Repetition: Industriella revolutionen (8 kort)", type: "flashcard", done: false },
  { id: 2, text: "Quiz: Världskrigen — orsaker & konsekvenser", type: "quiz", done: false },
  { id: 3, text: "Läs igenom: Demokratisering i Sverige", type: "read", done: false },
];

export default function DashboardOverview() {
  const [tasks, setTasks] = useState(MOCK_TASKS);

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const completedTasks = tasks.filter((t) => t.done).length;

  return (
    <div className={styles.overview}>
      {/* Welcome */}
      <div className={styles.welcome}>
        <div>
          <h1>Hej! 👋</h1>
          <p>Redo att studera? Här är din översikt.</p>
        </div>
        <Link href="/dashboard/material" className="btn btn-primary">
          📄 Ladda upp material
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={`card ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <div className={`${styles.statIcon} ${styles.blue}`}>📄</div>
            <span className={`badge badge-primary ${styles.statBadge}`}>Nytt</span>
          </div>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Uppladdade dokument</div>
        </div>

        <div className={`card ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <div className={`${styles.statIcon} ${styles.green}`}>✅</div>
          </div>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Kunskapspunkter behärskade</div>
        </div>

        <div className={`card ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <div className={`${styles.statIcon} ${styles.purple}`}>🎯</div>
          </div>
          <div className={styles.statValue}>—</div>
          <div className={styles.statLabel}>Betygsprognos</div>
        </div>

        <div className={`card ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <div className={`${styles.statIcon} ${styles.gold}`}>🔥</div>
          </div>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Studiedagar i rad</div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        {/* Subject Progress */}
        <div className={styles.subjectProgressSection}>
          <h2>Dina ämnen</h2>
          <div className={styles.subjectProgressList}>
            {MOCK_SUBJECTS.map((subject) => (
              <div
                key={subject.name}
                className={`card ${styles.subjectProgressItem}`}
              >
                <span className={styles.subjectProgressIcon}>
                  {subject.icon}
                </span>
                <div className={styles.subjectProgressInfo}>
                  <div className={styles.subjectProgressName}>
                    {subject.name}
                  </div>
                  <div className={styles.subjectProgressMeta}>
                    <span>{subject.points}</span>
                    <span>•</span>
                    <span>
                      {subject.progress}% av ämnesplanen täckt
                    </span>
                  </div>
                </div>
                <div className={`progress-bar ${styles.subjectProgressBar}`}>
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${subject.progress}%` }}
                  />
                </div>
                <span className={styles.subjectProgressPercent}>
                  {subject.progress}%
                </span>
              </div>
            ))}

            <Link
              href="/onboarding"
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: "flex-start", marginTop: "var(--space-2)" }}
            >
              + Lägg till ämne
            </Link>
          </div>
        </div>

        {/* Today's Tasks */}
        <div className={styles.todaySection}>
          <h2>
            Dagens uppgifter{" "}
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                fontWeight: "var(--weight-normal)",
              }}
            >
              ({completedTasks}/{tasks.length})
            </span>
          </h2>
          <div className={styles.todayList}>
            {tasks.map((task) => (
              <div
                key={task.id}
                className={styles.todayItem}
                onClick={() => toggleTask(task.id)}
              >
                <div
                  className={`${styles.todayCheckbox} ${
                    task.done ? styles.done : ""
                  }`}
                >
                  {task.done && "✓"}
                </div>
                <span
                  className={`${styles.todayItemText} ${
                    task.done ? styles.done : ""
                  }`}
                >
                  {task.text}
                </span>
                <span
                  className={`badge ${
                    task.type === "quiz"
                      ? "badge-info"
                      : task.type === "flashcard"
                      ? "badge-warning"
                      : "badge-primary"
                  } ${styles.todayItemBadge}`}
                >
                  {task.type === "quiz"
                    ? "Quiz"
                    : task.type === "flashcard"
                    ? "Kort"
                    : "Läs"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
