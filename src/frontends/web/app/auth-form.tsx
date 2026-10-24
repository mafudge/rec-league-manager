"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { API_URL, BackendRefused, signIn, signUp } from "./api";
import styles from "./ui.module.css";

// Sends what was typed; the backend's message is shown as-is (no validation of our own).
export default function AuthForm({ mode }: { mode: "signup" | "signin" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await (signup ? signUp : signIn)(email, password);
      router.push("/leagues");
    } catch (err) {
      setMessage(err instanceof BackendRefused ? err.message : `Can't reach the backend at ${API_URL}`);
      setBusy(false);
    }
  }

  return (
    <main className={`${styles.page}`}>
      <div className={styles.narrow}>
        <h1>{signup ? "Create your account" : "Sign in"}</h1>
        <form onSubmit={submit} noValidate className={`${styles.form} ${styles.card}`}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? "new-password" : "current-password"}
          />
          <p className={styles.message} aria-live="polite">
            {message}
          </p>
          <button type="submit" className={styles.button} disabled={busy}>
            {signup ? "Sign up" : "Sign in"}
          </button>
        </form>
        <p className={styles.links}>
          {signup ? "Already have an account?" : "New here?"}{" "}
          <Link href={signup ? "/signin" : "/signup"}>{signup ? "Sign in" : "Sign up"}</Link>
        </p>
      </div>
    </main>
  );
}
