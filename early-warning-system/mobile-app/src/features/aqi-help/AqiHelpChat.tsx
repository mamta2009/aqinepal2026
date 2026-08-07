import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { BrandColors } from "@/constants/brand";
import { useAqiHelp } from "@/hooks/useAqiHelp";

const SUGGESTIONS = [
  "What does AQI mean?",
  "How do I check air for my city?",
  "How do I register for alerts?",
] as const;

export function AqiHelpChat() {
  const [question, setQuestion] = useState("");
  const logRef = useRef<ScrollView>(null);
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
    logRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  const unavailable =
    !metaLoading && meta && !available
      ? meta.unavailable_message || "aqiHelp is currently unavailable."
      : null;

  const submit = async () => {
    const sent = await ask(question);
    if (sent) setQuestion("");
  };

  const canSend =
    !sending && !unavailable && question.trim().length >= 2;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      {(unavailable || error) && (
        <View className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2">
          <Text className="text-xs text-amber-950">{unavailable || error}</Text>
        </View>
      )}

      <View className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-white">
        <ScrollView
          ref={logRef}
          className="flex-1"
          contentContainerStyle={{ padding: 10, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            logRef.current?.scrollToEnd({ animated: true })
          }>
          {messages.length === 0 ? (
            <View className="flex-1 justify-center gap-3 py-6">
              <Text className="text-center text-xs text-muted">
                Ask about AQI, alerts, or using Climate Compass.
              </Text>
              <View className="flex-row flex-wrap justify-center gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    onPress={() => setQuestion(suggestion)}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 active:opacity-85">
                    <Text className="text-[11px] font-bold text-forest">
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View className="gap-2">
              {messages.map((message) => (
                <View
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-forest px-3 py-2"
                      : "max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3 py-2"
                  }>
                  <Text
                    className={
                      message.role === "user"
                        ? "text-[13px] leading-[18px] text-white"
                        : "text-[13px] leading-[18px] text-ink"
                    }>
                    {message.text}
                  </Text>
                  {message.citations && message.citations.length > 0 ? (
                    <Text className="mt-1.5 text-[10px] leading-3 text-muted">
                      Sources:{" "}
                      {message.citations
                        .map((citation) =>
                          [citation.source, citation.heading]
                            .filter(Boolean)
                            .join(" · "),
                        )
                        .join("; ")}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          {sending ? (
            <View className="mt-2 flex-row items-center gap-2">
              <ActivityIndicator color={BrandColors.forest} size="small" />
              <Text className="text-xs text-muted">Thinking…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="border-t border-border px-2.5 py-2">
          <View className="mb-1.5 flex-row items-end gap-2">
            <TextInput
              accessibilityLabel="Your question"
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask aqiHelp…"
              placeholderTextColor="#526b78"
              multiline
              maxLength={8000}
              editable={!sending && !unavailable}
              className="max-h-40 min-h-[88px] flex-1 rounded-xl border border-border-strong bg-white px-3 py-3 text-base text-ink"
              style={{ textAlignVertical: "top" }}
              blurOnSubmit={false}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ask aqiHelp"
              onPress={() => {
                void submit();
              }}
              disabled={!canSend}
              className="h-11 items-center justify-center rounded-xl px-3.5 active:opacity-85"
              style={{
                backgroundColor: canSend
                  ? BrandColors.forest
                  : BrandColors.border,
              }}>
              <Text
                className="text-xs font-extrabold"
                style={{ color: canSend ? "#ffffff" : BrandColors.muted }}>
                Ask
              </Text>
            </Pressable>
          </View>
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-[10px] text-muted" numberOfLines={1}>
              {metaLoading
                ? "Checking…"
                : available
                  ? `Ready${meta?.rate_limit_per_minute ? ` · ${meta.rate_limit_per_minute}/min` : ""}`
                  : "Unavailable"}
              {" · "}
              {disclaimer || "AI guide answers only — not medical advice."}
            </Text>
            {messages.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear conversation"
                onPress={clear}
                disabled={sending}
                className="active:opacity-70">
                <Text className="text-[11px] font-bold text-forest">Clear</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
