"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchMe } from "./api";
import { clearSession } from "./session";
import styles from "./ui.module.css";
import { useSignedIn } from "./use-signed-in";

// Shown at the top of every organizer page: who is signed in, and a way out.
// Sign-out is client-side only: the tokens are forgotten, nothing is sent to the backend (spec §5).
export default function OrganizerHeader() {
  const router = useRouter();
  const { onError } = useSignedIn();
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchMe()
      .then((me) => setEmail(me.email))
      .catch((e) => onError(e)); // a failed refresh redirects; anything else just leaves the email blank
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signOut() {
    clearSession();
    router.push("/signin");
  }

  return (
    <header className={styles.header}>
      <span>{email}</span>
      <button type="button" className={styles.linkButton} onClick={signOut}>
        Sign out
      </button>
    </header>
  );
}
