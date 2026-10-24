"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SignInRequired, messageFor } from "./api";
import { getToken } from "./session";

/**
 * For every organizer page. On mount, no token means go to /signin. `onError` sends the organizer to
 * /signin when sign-in can't be restored (returns null), else returns the message to show.
 */
export function useSignedIn() {
  const router = useRouter();
  useEffect(() => {
    if (getToken() === null) router.replace("/signin");
  }, [router]);

  return {
    onError(e: unknown): string | null {
      if (e instanceof SignInRequired) {
        router.replace("/signin");
        return null;
      }
      return messageFor(e);
    },
  };
}
