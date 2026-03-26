"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={styles.landing}>
      {/* Navigation */}
      <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
        <Link href="/" className={styles.navLogo}>
          <span className={styles.navLogoIcon}>📚</span>
          <span>StudieMate</span>
        </Link>
        <div className={styles.navActions}>
          <Link href="/login" className="btn btn-ghost">
            Logga in
          </Link>
          <Link href="/login?mode=register" className="btn btn-primary">
            Kom igång gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>✨</span>
            <span>AI-driven studiehjälp för gymnasiet</span>
          </div>
          <h1 className={styles.heroTitle}>
            Studera smartare.{" "}
            <span className="text-gradient">Nå betyg A.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Ladda upp ditt studiematerial, låt AI analysera och matcha mot
            Skolverkets ämnesplan. Få personlig studiecoach, smarta quiz och
            flashcards — allt på ett ställe.
          </p>
          <div className={styles.heroCta}>
            <Link href="/login?mode=register" className="btn btn-primary btn-lg">
              Börja studera nu →
            </Link>
            <Link href="#features" className="btn btn-secondary btn-lg">
              Hur fungerar det?
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={styles.features}>
        <div className={styles.featuresHeader}>
          <h2>Allt du behöver för att lyckas</h2>
          <p>
            StudieMate kombinerar AI med beprövade studiemetoder för att
            maximera ditt lärande.
          </p>
        </div>
        <div className={styles.featuresGrid}>
          <div className={`card card-interactive ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.blue}`}>📄</div>
            <h3>Ladda upp material</h3>
            <p>
              Ladda upp PDF:er, bilder av tavlor eller anteckningar. AI
              extraherar alla kunskapspunkter automatiskt.
            </p>
          </div>
          <div className={`card card-interactive ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.purple}`}>🎯</div>
            <h3>Ämnesplan-matchning</h3>
            <p>
              Automatisk matchning mot Skolverkets ämnesplan (Gy25). Se exakt
              vad du täcker och var luckorna finns.
            </p>
          </div>
          <div className={`card card-interactive ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.green}`}>🧠</div>
            <h3>Smarta quiz & flashcards</h3>
            <p>
              AI genererar quiz och flashcards baserade på ditt material med
              spaced repetition för långsiktig inlärning.
            </p>
          </div>
          <div className={`card card-interactive ${styles.featureCard}`}>
            <div className={`${styles.featureIcon} ${styles.gold}`}>💬</div>
            <h3>AI-studieassistent</h3>
            <p>
              Chatta med din AI-tutor som förstår ditt material och guidar dig
              med sokratisk metod — aldrig direkta svar.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howItWorks}>
        <div className={styles.howItWorksInner}>
          <div className={styles.featuresHeader}>
            <h2>Så fungerar det</h2>
            <p>Tre steg till smartare studier</p>
          </div>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <h3>Välj ditt program & ämne</h3>
              <p>
                Berätta vilket gymnasieprogram och ämne du läser. Vi hämtar
                rätt ämnesplan från Skolverket.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <h3>Ladda upp material</h3>
              <p>
                Ladda upp det material din lärare delat ut — PDF:er, bilder,
                anteckningar. AI analyserar allt.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <h3>Studera & nå betyg A</h3>
              <p>
                Följ din personliga studieplan med quiz, flashcards och
                AI-chatt. Se dina framsteg i realtid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2026 StudieMate. Byggt med ❤️ för svenska gymnasieelever.</p>
      </footer>
    </div>
  );
}
