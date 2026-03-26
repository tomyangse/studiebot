"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (searchParams.get("mode") === "register") {
      setIsRegister(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isRegister) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });
        if (signUpError) throw signUpError;
        setSuccess(
          "Konto skapat! Kolla din e-post för att verifiera ditt konto."
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Något gick fel. Försök igen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <div className={styles.authHeader}>
          <Link href="/" className={styles.authLogo}>
            <span className={styles.authLogoIcon}>📚</span>
            <span>StudieMate</span>
          </Link>
          <h1>{isRegister ? "Skapa konto" : "Välkommen tillbaka"}</h1>
          <p>
            {isRegister
              ? "Börja studera smartare idag"
              : "Logga in för att fortsätta studera"}
          </p>
        </div>

        <div className={`card ${styles.authCard}`}>
          <form className={styles.authForm} onSubmit={handleSubmit}>
            {isRegister && (
              <div className={styles.formGroup}>
                <label htmlFor="name" className="input-label">
                  Ditt namn
                </label>
                <input
                  id="name"
                  type="text"
                  className="input"
                  placeholder="Anna Andersson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={isRegister}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="email" className="input-label">
                E-postadress
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="anna@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className="input-label">
                Lösenord
              </label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="Minst 6 tecken"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && <p className={styles.formError}>{error}</p>}
            {success && <p className={styles.formSuccess}>{success}</p>}

            <button
              type="submit"
              className={`btn btn-primary btn-lg ${styles.authSubmit}`}
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? (
                <span className={styles.loadingSpinner} />
              ) : isRegister ? (
                "Skapa konto"
              ) : (
                "Logga in"
              )}
            </button>
          </form>
        </div>

        <p className={styles.authSwitch}>
          {isRegister ? (
            <>
              Har du redan ett konto?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegister(false);
                  setError("");
                  setSuccess("");
                }}
              >
                Logga in
              </a>
            </>
          ) : (
            <>
              Inget konto än?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsRegister(true);
                  setError("");
                  setSuccess("");
                }}
              >
                Skapa konto gratis
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
