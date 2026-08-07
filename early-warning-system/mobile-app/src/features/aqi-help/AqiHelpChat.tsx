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
import { PrimaryButton } from "@/features/auth/FormFields";
import { useAqiHelp } from "@/hooks/useAqiHelp";

const SUGGESTIONS = [
  "What does AQI mean?",
  "How do I check air, heat, and rain for my city?",
  "How do I register for air and heat alerts?",
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

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            onPress={() => setQuestion(suggestion)}
            className="rounded-full border border-border bg-white px-3 py-2 active:opacity-85"
            style={{ borderColor: BrandColors.border }}>
            <Text className="text-xs font-bold text-forest">{suggestion}</Text>
          </Pressable>
        ))}
      </View>

      {(unavailable || error) && (
        <View className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <Text className="text-sm text-amber-950">{unavailable || error}</Text>
        </View>
      )}

      <View className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white">
        <ScrollView
          ref={logRef}
          className="flex-1"
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            logRef.current?.scrollToEnd({ animated: true })
          }>
          {messages.length === 0 ? (
            <View className="flex-1 items-center justify-center py-16">
              <Text className="max-w-sm text-center text-sm text-muted">
                Ask about AQI, local air checks, alerts, or using the platform.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {messages.map((message) => (
                <View
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-forest px-4 py-3"
                      : "max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-white px-4 py-3"
                  }>
                  <Text
                    className={
                      message.role === "user"
                        ? "mb-1 text-xs font-extrabold text-white/75"
                        : "mb-1 text-xs font-extrabold text-muted"
                    }>
                    {message.role === "user" ? "You" : "aqiHelp"}
                  </Text>
                  <Text
                    className={
                      message.role === "user"
                        ? "text-sm leading-5 text-white"
                        : "text-sm leading-5 text-ink"
                    }>
                    {message.text}
                  </Text>
                  {message.citations && message.citations.length > 0 ? (
                    <Text className="mt-3 border-t border-border pt-2 text-xs text-muted">
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
            <View className="mt-3 flex-row items-center gap-2">
              <ActivityIndicator color={BrandColors.forest} size="small" />
              <Text className="text-sm text-muted">
                aqiHelp is preparing an answer…
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="border-t border-border p-3">
          <Text className="mb-1 text-sm font-bold text-ink">Your question</Text>
          <TextInput
            accessibilityLabel="Your question"
            value={question}
            onChangeText={setQuestion}
            placeholder="For example: What should I do when air quality is unhealthy?"
            placeholderTextColor="#526b78"
            multiline
            maxLength={8000}
            editable={!sending && !unavailable}
            className="mb-3 min-h-[88px] rounded-xl border border-border-strong bg-white px-3 py-3 text-base text-ink"
            style={{ textAlignVertical: "top" }}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (!sending && question.trim().length >= 2) {
                void submit();
              }
            }}
          />
          <View className="mb-2 flex-row flex-wrap gap-2">
            <View className="min-w-[140px] flex-1">
              <PrimaryButton
                label="Ask aqiHelp"
                onPress={() => {
                  void submit();
                }}
                disabled={
                  sending ||
                  Boolean(unavailable) ||
                  question.trim().length < 2
                }
              />
            </View>
            <View className="min-w-[100px]">
              <PrimaryButton
                label="Clear"
                variant="ghost"
                onPress={clear}
                disabled={sending || messages.length === 0}
              />
            </View>
          </View>
          <Text className="mb-1 text-xs text-muted">
            {metaLoading
              ? "Checking availability…"
              : available
                ? `Available${meta?.rate_limit_per_minute ? ` · up to ${meta.rate_limit_per_minute}/minute` : ""}`
                : "Unavailable"}
          </Text>
          {disclaimer ? (
            <Text className="mb-1 text-xs text-muted">{disclaimer}</Text>
          ) : null}
          <Text className="text-xs leading-4 text-muted">
            AI answers from published guides only. Conversations are not
            monitored by staff and are not a substitute for official or medical
            advice.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
