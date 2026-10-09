"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApi } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/error";

export type AqiHelpCitation = {
  source?: string;
  heading?: string;
};

export type AqiHelpMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: AqiHelpCitation[];
};

type MetaResponse = {
  openrouter_configured?: boolean;
  chunk_count?: number;
  build_error?: string | null;
  unavailable_message?: string;
  note?: string;
  rate_limit_per_minute?: number;
};

type ChatResponse = {
  reply?: string;
  citations?: AqiHelpCitation[];
  disclaimer?: string;
};

export function useAqiHelp() {
  const [messages, setMessages] = useState<AqiHelpMessage[]>([]);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    browserApi<MetaResponse>("api/help/aqi/meta")
      .then((result) => {
        if (active) setMeta(result);
      })
      .catch(() => {
        if (active) setError("Could not check aqiHelp availability.");
      })
      .finally(() => {
        if (active) setMetaLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const available = Boolean(
    meta?.openrouter_configured && meta.chunk_count && !meta.build_error,
  );

  const ask = useCallback(async (question: string) => {
    const text = question.trim();
    if (text.length < 2) return false;

    setSending(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text },
    ]);

    try {
      const result = await browserApi<ChatResponse>("api/help/aqi/chat", {
        method: "POST",
        body: { message: text },
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.reply || "aqiHelp returned an empty response.",
          citations: result.citations,
        },
      ]);
      setDisclaimer(result.disclaimer || null);
      return true;
    } catch (cause) {
      const message =
        cause instanceof ApiError && cause.status === 429
          ? "Too many questions were sent. Please wait a minute and try again."
          : cause instanceof Error
            ? cause.message
            : "aqiHelp is currently unavailable.";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: message,
        },
      ]);
      setError(message);
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  return {
    ask,
    available,
    clear: () => {
      setMessages([]);
      setError(null);
      setDisclaimer(null);
    },
    disclaimer,
    error,
    messages,
    meta,
    metaLoading,
    sending,
  };
}
