import { Text, View } from "react-native";

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "li"; text: string };

function stripInlineMarkers(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = stripInlineMarkers(paragraph.join(" ").trim());
    if (text) blocks.push({ type: "p", text });
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      blocks.push({ type: "h3", text: stripInlineMarkers(trimmed.slice(4)) });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "h2", text: stripInlineMarkers(trimmed.slice(3)) });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      blocks.push({ type: "h1", text: stripInlineMarkers(trimmed.slice(2)) });
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      blocks.push({
        type: "li",
        text: stripInlineMarkers(trimmed.replace(/^[-*+]\s+/, "")),
      });
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      blocks.push({
        type: "li",
        text: stripInlineMarkers(trimmed.replace(/^\d+\.\s+/, "")),
      });
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks;
}

/** Lightweight markdown renderer for published Climate Compass guides. */
export function GuideMarkdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

  return (
    <View className="gap-3">
      {blocks.map((block, index) => {
        if (block.type === "h1") {
          return (
            <Text
              key={`${block.type}-${index}`}
              className="text-2xl font-extrabold text-ink">
              {block.text}
            </Text>
          );
        }
        if (block.type === "h2") {
          return (
            <Text
              key={`${block.type}-${index}`}
              className="mt-2 text-xl font-extrabold text-ink">
              {block.text}
            </Text>
          );
        }
        if (block.type === "h3") {
          return (
            <Text
              key={`${block.type}-${index}`}
              className="mt-1 text-lg font-bold text-ink">
              {block.text}
            </Text>
          );
        }
        if (block.type === "li") {
          return (
            <View
              key={`${block.type}-${index}`}
              className="flex-row gap-2 pl-1">
              <Text className="text-forest">•</Text>
              <Text className="flex-1 text-base leading-6 text-muted">
                {block.text}
              </Text>
            </View>
          );
        }
        return (
          <Text
            key={`${block.type}-${index}`}
            className="text-base leading-6 text-muted">
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}
