import {
  ChatMessage,
  ChatMessageContentArtifact,
  ChatMessageContent,
  ChatMessageContentTest,
  ChatMessageContentType,
  ArtifactType,
} from "../../types";

export function normalizeMessages(messages: ChatMessage[]) {
  const normalized: ChatMessage[] = [];
  const artifacts: ChatMessageContentArtifact[] = [];

  for (const message of messages) {
    const current: ChatMessage = { role: message.role, content: [] };

    for (const content of message.content) {
      if (ChatMessageContentTest.textChunks(content)) {
        const sequenceIdx = Math.min(
          ...content.chunks.map((chunk) => chunk.sequence_idx),
        );
        const text = content.chunks
          .sort((a, b) => a.sequence_idx - b.sequence_idx)
          .map((chunk) => chunk.text)
          .join("");
        const values = processTextContent(artifacts, sequenceIdx, text);
        current.content.push(...values);
      } else if (ChatMessageContentTest.text(content)) {
        const text = content.text;
        const values = processTextContent(
          artifacts,
          content.sequence_idx,
          text,
        );
        current.content.push(...values);
      } else {
        current.content.push(content);
      }
    }

    normalized.push(current);
  }

  return {
    normalized,
    artifacts,
  };
}

function processTextContent(
  artifacts: ChatMessageContentArtifact[],
  sequence_idx: number,
  text: string,
): ChatMessageContent[] {
  const retValue: ChatMessageContent[] = [];
  const startTerm = "<x-artifact";
  const endTerm = /<\/\s*x-artifact\s*>/g;

  let startPosition;
  while ((startPosition = text.indexOf(startTerm)) !== -1) {
    const textBefore = text.slice(0, startPosition);
    retValue.push({
      kind: ChatMessageContentType.Text,
      sequence_idx,
      text: textBefore,
    });

    const textAfter = text.slice(startPosition);
    const endMatch = endTerm.exec(textAfter);

    if (endMatch !== null) {
      const artifactText = textAfter.slice(0, endMatch.index);
      text = textAfter.slice(endMatch.index + endMatch[0].length);
      const artifact = getArtifactFromText(
        artifacts.length,
        true,
        artifactText,
      );

      retValue.push(artifact);
      artifacts.push(artifact);
    } else {
      text = "";
      const artifact = getArtifactFromText(artifacts.length, false, textAfter);

      retValue.push(artifact);
      artifacts.push(artifact);
      break;
    }
  }

  if (text.length > 0) {
    retValue.push({
      kind: ChatMessageContentType.Text,
      sequence_idx,
      text,
    });
  }

  return retValue;
}

function getArtifactFromText(
  index: number,
  ready: boolean,
  text: string,
): ChatMessageContentArtifact {
  const tag = findArtifactTag(text);
  text = !tag ? "" : text.substring(tag.length).trim();
  const attributes = getAttributes(tag ?? "");

  return {
    kind: ChatMessageContentType.Artifact,
    index,
    ready,
    type: (attributes["type"] ?? "unknown") as ArtifactType,
    name: attributes["name"] ?? "Artifact",
    text,
  };
}

function findArtifactTag(input: string): string | null {
  const regex = /<x-artifact[^>]*>/;
  const match = input.match(regex);

  return match ? match[0] : null;
}

function getAttributes(input: string) {
  const attributePattern =
    /(\w+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g;
  const attributes: Record<string, string> = {};
  let match;

  while ((match = attributePattern.exec(input)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2];
    attributes[key] = value.toString();
  }

  return attributes;
}
