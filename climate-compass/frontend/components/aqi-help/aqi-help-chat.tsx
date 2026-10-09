"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Trash2 } from "lucide-react";
import { useAqiHelp } from "@/hooks/use-aqi-help";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "What does AQI mean?",
  "How do I check air for my city?",
  "How do I register for alerts?",
] as const;

export function AqiHelpChat({ embed = false }: { embed?: boolean }) {
  const [question, setQuestion] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const {
    ask,
    available,
    clear,
    disclaimer,
    error,
    messages,
    meta,
    metaLoading,
    sending,
  } = useAqiHelp();

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const sent = await ask(question);
    if (sent) setQuestion("");
  }

  const unavailable =
    !metaLoading && meta && !available
      ? meta.unavailable_message || "aqiHelp is currently unavailable."
      : null;

  const canSend = !sending && !unavailable && question.trim().length >= 2;

  return (
    <section
      className={
        embed
          ? "flex h-full min-h-0 flex-col bg-white p-2.5"
          : "page-shell py-8 sm:py-10 max-w-3xl"
      }
    >
      {!embed && (
        <header className="mb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-forest text-white">
              <Bot className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Guides-backed answers</p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                aqiHelp
              </h1>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Ask about air, heat, rain, alerts, or Climate Compass. AI answers
            from published guides — not medical or official advice.
          </p>
        </header>
      )}

      {(unavailable || error) && (
        <div
          className="mb-2 shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950"
          role="alert"
        >
          {unavailable || error}
        </div>
      )}

      <div
        className={
          embed
            ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border"
            : "flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white sm:min-h-[32rem]"
        }
      >
        <div
          ref={logRef}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface p-2.5"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="aqiHelp conversation"
        >
          {messages.length === 0 ? (
            <div className="m-auto flex max-w-md flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted">
                Ask about AQI, alerts, or using the platform.
              </p>
              <div
                className="flex flex-wrap justify-center gap-1.5"
                aria-label="Suggested questions"
              >
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-bold text-forest hover:border-forest"
                    onClick={() => setQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-forest px-3 py-2 text-sm leading-5 text-white"
                    : "max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-white px-3 py-2 text-sm leading-5 text-ink"
                }
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.citations && message.citations.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    Sources:{" "}
                    {message.citations
                      .map((citation) =>
                        [citation.source, citation.heading]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .join("; ")}
                  </p>
                )}
              </article>
            ))
          )}
          {sending && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Thinking…
            </p>
          )}
        </div>

        <form
          onSubmit={submit}
          className="shrink-0 space-y-1.5 border-t border-border p-2.5"
        >
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor={embed ? "aqi-help-question-embed" : "aqi-help-question"}>
              Your question
            </label>
            <textarea
              id={embed ? "aqi-help-question-embed" : "aqi-help-question"}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              maxLength={8000}
              className="max-h-28 min-h-10 w-full resize-y rounded-xl border border-border-strong bg-white px-3 py-2 text-sm"
              placeholder="Ask aqiHelp…"
              disabled={sending || Boolean(unavailable)}
            />
            <Button
              type="submit"
              disabled={!canSend}
              className="shrink-0"
              aria-label="Ask aqiHelp"
            >
              <Send className="size-4" aria-hidden />
              Ask
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted" aria-live="polite">
              {metaLoading
                ? "Checking…"
                : available
                  ? `Ready${meta?.rate_limit_per_minute ? ` · ${meta.rate_limit_per_minute}/min` : ""}`
                  : "Unavailable"}
              {" · "}
              {disclaimer || "AI guide answers only — not medical advice."}
            </p>
            {messages.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={clear}
                disabled={sending}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
