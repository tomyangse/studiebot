"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSubject } from "@/lib/subject-context";
import styles from "./overview.module.css";

export default function DashboardOverview() {
  const { activeSubject, curriculum } = useSubject();
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (curriculum && curriculum.centralContent && curriculum.centralContent.length >= 3) {
      const cc = curriculum.centralContent;
      setTasks([
        { id: 1, text: `Repetition: ${cc[0]?.title} (8 kort)`, type: "flashcard", done: false },
        { id: 2, text: `Quiz: ${cc[1]?.title}`, type: "quiz", done: false },
        { id: 3, text: `Läs igenom: ${cc[2]?.title}`, type: "read", done: false },
      ]);
    } else {
      setTasks([
        { id: 1, text: "Repetition (8 kort)", type: "flashcard", done: false },
        { id: 2, text: "Gör ett quiz", type: "quiz", done: false },
        { id: 3, text: "Läs igenom materialet", type: "read", done: false },
      ]);
    }
  }, [curriculum]);

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const completedTasks = tasks.filter((t) => t.done).length;

  const displaySubject = {
    name: activeSubject.levelName,
    icon: activeSubject.icon,
    progress: 35, // Mock progress
    points: `${activeSubject.points}p`,
    status: "active"
  };

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
              <div
                className={`card ${styles.subjectProgressItem}`}
              >
                <span className={styles.subjectProgressIcon}>
                  {displaySubject.icon}
                </span>
                <div className={styles.subjectProgressInfo}>
                  <div className={styles.subjectProgressName}>
                    {displaySubject.name}
                  </div>
                  <div className={styles.subjectProgressMeta}>
                    <span>{displaySubject.points}</span>
                    <span>•</span>
                    <span>
                      {displaySubject.progress}% av ämnesplanen täckt
                    </span>
                  </div>
                </div>
                <div className={`progress-bar ${styles.subjectProgressBar}`}>
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${displaySubject.progress}%` }}
                  />
                </div>
                <span className={styles.subjectProgressPercent}>
                  {displaySubject.progress}%
                </span>
              </div>
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
