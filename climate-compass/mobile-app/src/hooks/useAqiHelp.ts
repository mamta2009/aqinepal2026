import { useCallback, useEffect, useState } from "react";

import {
  getAqiHelpMeta,
  postAqiHelpChat,
  type AqiHelpCitation,
  type AqiHelpMeta,
} from "@/services/api/aqiHelp";
import { toApiError } from "@/services/api/client";

export type AqiHelpMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: AqiHelpCitation[];
};

function messageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useAqiHelp() {
  const [messages, setMessages] = useState<AqiHelpMessage[]>([]);
  const [meta, setMeta] = useState<AqiHelpMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAqiHelpMeta()
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
      { id: messageId(), role: "user", text },
    ]);

    try {
      const result = await postAqiHelpChat(text);
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text: result.reply || "aqiHelp returned an empty response.",
          citations: result.citations,
        },
      ]);
      setDisclaimer(result.disclaimer || null);
      return true;
    } catch (cause) {
      const apiError = toApiError(cause);
      const message =
        apiError.status === 429
          ? "Too many questions were sent. Please wait a minute and try again."
          : apiError.message || "aqiHelp is currently unavailable.";
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
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

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setDisclaimer(null);
  }, []);

  return {
    ask,
    available,
    clear,
    disclaimer,
    error,
    messages,
    meta,
    metaLoading,
    sending,
  };
}
