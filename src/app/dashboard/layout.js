"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./dashboard.module.css";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Översikt" },
  { href: "/dashboard/material", icon: "📄", label: "Material" },
  { href: "/dashboard/kunskapskarta", icon: "🗺️", label: "Kunskapskarta" },
  { href: "/dashboard/quiz", icon: "❓", label: "Quiz" },
  { href: "/dashboard/flashcards", icon: "🃏", label: "Flashcards" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      content:
        "Hej! 👋 Jag är din studieassistent. Jag kan hjälpa dig att förstå ditt material, skapa quiz eller förklara begrepp. Vad vill du jobba med?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    // Simulate AI response (will be replaced with Gemini RAG)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "Det är en bra fråga! 🤔 Låt mig tänka på det... (AI-integration kommer snart — just nu är jag en demo-assistent.)",
        },
      ]);
      setChatLoading(false);
    }, 1500);
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
            <div className={styles.sidebarAvatar}>E</div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>Elev</div>
              <div className={styles.sidebarUserProgram}>
                Samhällsvetenskap åk 1
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
                  setChatInput("Förklara industriella revolutionen");
                }}
              >
                📝 Förklara ett begrepp
              </button>
              <button
                className={styles.chatSuggestion}
                onClick={() => {
                  setChatInput("Skapa ett quiz om världskrigen");
                }}
              >
                ❓ Skapa quiz
              </button>
              <button
                className={styles.chatSuggestion}
                onClick={() => {
                  setChatInput("Hjälp mig göra en studieplan");
                }}
              >
                📅 Studieplan
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
    </div>
  );
}
