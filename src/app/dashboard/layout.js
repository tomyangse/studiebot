"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SubjectProvider, useSubject } from "@/lib/subject-context";
import { supabase } from "@/lib/supabase";
import { SUBJECTS } from "@/lib/curriculum-data";
import styles from "./dashboard.module.css";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Översikt" },
  { href: "/dashboard/material", icon: "📄", label: "Material" },
  { href: "/dashboard/flashcards", icon: "🃏", label: "Flashcards" },
  { href: "/dashboard/quiz", icon: "📋", label: "Prov" },
  { href: "/dashboard/kunskapskarta", icon: "🗺️", label: "Kunskapskarta" },
];

import { MaterialProvider } from "@/lib/material-context";

export default function DashboardLayout({ children }) {
  return (
    <SubjectProvider>
      <MaterialProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </MaterialProvider>
    </SubjectProvider>
  );
}

function DashboardLayoutInner({ children }) {
  const { activeSubject, subjects, switchSubject, addSubject, removeSubject } = useSubject();
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState("subject"); // subject | level | loading
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [addError, setAddError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      content:
        "Hej! 👋 Jag är din AI-lärare. Jag svarar utifrån din kursplan och ditt uppladdade material — inget påhittat! Ställ en fråga så hjälper jag dig.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) {
        setUser(session.user);
      } else {
        router.push("/login");
      }
      setAuthLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (session) {
          setUser(session.user);
        } else {
          router.push("/login");
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>Laddar StudieMate...</div>;
  }


  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    const updatedMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(updatedMessages);
    setChatLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: updatedMessages.slice(-10), // Last 10 messages for context
          accessToken: session?.access_token,
          subjectCode: activeSubject,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, {
          role: "ai",
          content: "⚠️ Något gick fel. Försök igen om en stund.",
        }]);
      }
    } catch (err) {
      console.error("Tutor chat error:", err);
      setMessages((prev) => [...prev, {
        role: "ai",
        content: "⚠️ Kunde inte nå AI-servern. Kontrollera din internetanslutning.",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  return (
    <div className={styles.dashboardLayout}>
      {/* Left Sidebar */}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.mobileOpen : ""}`}
      >
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLogoIcon}>📚</span>
          <span className={styles.sidebarLogoText}>StudieMate</span>
        </div>

        {/* Subject Switcher */}
        <div className={styles.subjectSwitcher}>
          <button
            className={styles.subjectSwitcherBtn}
            onClick={() => setSubjectDropdownOpen(!subjectDropdownOpen)}
          >
            <span className={styles.subjectSwitcherIcon}>{activeSubject.icon}</span>
            <span className={styles.subjectSwitcherName}>{activeSubject.levelName}</span>
            <span className={styles.subjectSwitcherArrow}>{subjectDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {subjectDropdownOpen && (
            <div className={styles.subjectDropdown}>
              {subjects.map((s) => (
                <div
                  key={`${s.code}:${s.levelName}`}
                  className={`${styles.subjectDropdownItem} ${
                    activeSubject.code === s.code && activeSubject.levelName === s.levelName
                      ? styles.activeSubject
                      : ""
                  }`}
                >
                  <button
                    className={styles.subjectDropdownBtn}
                    onClick={() => {
                      switchSubject(s.code, s.levelName);
                      setSubjectDropdownOpen(false);
                    }}
                  >
                    <span>{s.icon}</span>
                    <span>{s.levelName}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{s.points}p</span>
                  </button>
                  {s.isCustom && (
                    <button
                      className={styles.subjectRemoveBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSubject(s.code, s.levelName);
                      }}
                      title="Ta bort"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                className={styles.subjectAddBtn}
                onClick={() => {
                  setSubjectDropdownOpen(false);
                  setAddStep("subject");
                  setSelectedSubject(null);
                  setSelectedLevel(null);
                  setAddError("");
                  setAddModalOpen(true);
                }}
              >
                <span>+</span>
                <span>Lägg till ämne</span>
              </button>
            </div>
          )}
        </div>

        <nav className={styles.sidebarNav}>
          <span className={styles.sidebarSectionLabel}>Studier</span>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.sidebarLink} ${
                pathname === item.href ? styles.active : ""
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.sidebarLinkIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>{user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "E"}</div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>{user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Elev"}</div>
              <div className={styles.sidebarUserProgram}>
                <button
                  onClick={() => supabase.auth.signOut()}
                  style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                >
                  Logga ut
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className={`${styles.mobileOverlay} ${styles.visible}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main
        className={`${styles.mainContent} ${
          chatOpen ? styles.chatOpen : ""
        }`}
      >
        {/* Top Bar */}
        <header className={styles.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button
              className={`btn btn-icon btn-ghost ${styles.mobileMenuBtn}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Öppna meny"
            >
              ☰
            </button>
            <span className={styles.topbarTitle}>
              {NAV_ITEMS.find((i) => i.href === pathname)?.label || "StudieMate"}
            </span>
          </div>
          <div className={styles.topbarActions}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setChatOpen(!chatOpen)}
              title={chatOpen ? "Stäng assistent" : "Öppna assistent"}
            >
              💬
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className={styles.pageContent}>{children}</div>
      </main>

      {/* Chat Sidebar */}
      <aside
        className={`${styles.chatSidebar} ${chatOpen ? styles.open : ""}`}
      >
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderTitle}>
            <span>🤖</span>
            <span>Studieassistent</span>
          </div>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setChatOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className={styles.chatMessages}>
          {messages.map((msg, i) => (
            <div key={i} className={styles.chatMessage}>
              <div
                className={`${styles.chatMessageAvatar} ${
                  msg.role === "ai" ? styles.ai : styles.user
                }`}
              >
                {msg.role === "ai" ? "🤖" : "👤"}
              </div>
              <div className={styles.chatMessageContent}>{msg.content}</div>
            </div>
          ))}
          {chatLoading && (
            <div className={styles.chatMessage}>
              <div className={`${styles.chatMessageAvatar} ${styles.ai}`}>
                🤖
              </div>
              <div className={styles.chatMessageContent}>
                <span style={{ animation: "pulse-soft 1.5s infinite" }}>
                  Tänker...
                </span>
              </div>
            </div>
          )}
          {messages.length === 1 && (
            <div className={styles.chatSuggestions}>
              <button
                className={styles.chatSuggestion}
                onClick={() => {
                  setChatInput("Vad handlar mitt uppladdade material om?");
                }}
              >
                📄 Sammanfatta material
              </button>
              <button
                className={styles.chatSuggestion}
                onClick={() => {
                  setChatInput("Vilka är de viktigaste begreppen jag bör kunna?");
                }}
              >
                📝 Viktiga begrepp
              </button>
              <button
                className={styles.chatSuggestion}
                onClick={() => {
                  setChatInput("Vad bör jag fokusera på för att nå betyg A?");
                }}
              >
                🎯 Tips för betyg A
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.chatInputArea}>
          <div className={styles.chatInputWrapper}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Skriv din fråga..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className={styles.chatSendBtn}
              onClick={handleChatSend}
              disabled={!chatInput.trim() || chatLoading}
            >
              →
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Chat FAB */}
      {!chatOpen && (
        <button
          className={styles.chatFab}
          onClick={() => setChatOpen(true)}
          aria-label="Öppna studieassistent"
        >
          💬
        </button>
      )}

      {/* Add Subject Modal */}
      {addModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {addStep === "subject" && "Välj ämne"}
                {addStep === "level" && `${selectedSubject?.name} — välj kurs`}
                {addStep === "loading" && "Skapar kursplan..."}
              </h3>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setAddModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {addStep === "subject" && (
                <div className={styles.addSubjectGrid}>
                  {SUBJECTS
                    .filter((s) => !subjects.some((existing) =>
                      existing.code === s.code && s.levels.every((l) =>
                        subjects.some((e) => e.levelName === l.name)
                      )
                    ))
                    .map((s) => (
                    <button
                      key={s.code}
                      className={styles.addSubjectCard}
                      onClick={() => {
                        setSelectedSubject(s);
                        setAddStep("level");
                      }}
                    >
                      <span className={styles.addSubjectIcon}>{s.icon}</span>
                      <span className={styles.addSubjectName}>{s.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {addStep === "level" && selectedSubject && (
                <div className={styles.addLevelList}>
                  {selectedSubject.levels
                    .filter((l) => !subjects.some((e) => e.levelName === l.name))
                    .map((l) => (
                    <button
                      key={l.name}
                      className={styles.addLevelItem}
                      onClick={async () => {
                        setSelectedLevel(l);
                        setAddStep("loading");
                        setAddError("");
                        try {
                          const res = await fetch("/api/curriculum", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              subjectName: selectedSubject.name,
                              levelName: l.name,
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            addSubject(data.curriculum);
                            setAddModalOpen(false);
                          } else {
                            setAddError(data.error || "Kunde inte generera kursplan.");
                            setAddStep("level");
                          }
                        } catch (err) {
                          setAddError("Nätverksfel. Försök igen.");
                          setAddStep("level");
                        }
                      }}
                    >
                      <span>{selectedSubject.icon}</span>
                      <span>{l.name}</span>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                        {l.points}p
                      </span>
                    </button>
                  ))}
                  <button
                    className={styles.addBackBtn}
                    onClick={() => setAddStep("subject")}
                  >
                    ← Tillbaka
                  </button>
                  {addError && (
                    <p style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", marginTop: "var(--space-3)" }}>
                      {addError}
                    </p>
                  )}
                </div>
              )}

              {addStep === "loading" && (
                <div className={styles.addLoading}>
                  <div className={styles.addLoadingIcon}>🤖</div>
                  <p>AI genererar kursplan för <strong>{selectedLevel?.name}</strong>...</p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    Centralt innehåll och betygskriterier skapas automatiskt.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
