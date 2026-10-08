"use client";

import { useEffect, useState } from "react";

import { API_URL, fetchBackendName } from "./api";

export default function BackendGreeting() {
  const [message, setMessage] = useState("Connecting to the backend…");

  useEffect(() => {
    fetchBackendName()
      .then((name) => setMessage(`Hello from ${name}`))
      .catch(() => setMessage(`Can't reach the backend at ${API_URL}`));
  }, []);

  return <p>{message}</p>;
}
