"use client";

import { useEffect, useState } from "react";

import { fetchBackendName, messageFor } from "./api";

export default function BackendGreeting() {
  const [message, setMessage] = useState("Connecting to the backend…");

  useEffect(() => {
    fetchBackendName()
      .then((name) => setMessage(`Hello from ${name}`))
      .catch((e) => setMessage(messageFor(e)));
  }, []);

  return <p>{message}</p>;
}
