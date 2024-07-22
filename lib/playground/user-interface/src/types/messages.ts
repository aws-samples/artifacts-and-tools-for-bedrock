import { ToolStatus } from "./payload";
import { ArtifactType } from "./sandbox";

export interface ChatMessage {
  role: ChatMessageRole;
  content: ChatMessageContent[];
}

export enum ChatMessageRole {
  User = "user",
  Assistant = "assistant",
}

export enum ChatMessageContentType {
  Text = "text",
  TextChunks = "text-chunks",
  ToolUse = "tool-use",
  Artifact = "artifact",
}

export type ChatMessageContent =
  | ChatMessageContentText
  | ChatMessageContentTextChunks
  | ChatMessageContentToolUse
  | ChatMessageContentArtifact;

export interface ChatMessageContentText {
  kind: ChatMessageContentType.Text;
  sequence_idx: number;
  text: string;
}

export interface ChatMessageContentTextChunks {
  kind: ChatMessageContentType.TextChunks;
  chunks: {
    sequence_idx: number;
    text: string;
  }[];
}

export interface ChatMessageContentToolUse {
  kind: ChatMessageContentType.ToolUse;
  sequence_idx: number;
  tool_use_id: string;
  tool_name: string;
  status: ToolStatus;
  extra: {
    request_text?: string;
    response_text?: string;
    response_html?: string;
    output_files?: {
      file_id: string;
      file_name: string;
    }[];
  };
}

export interface ChatMessageContentArtifact {
  kind: ChatMessageContentType.Artifact;
  index: number;
  ready: boolean;
  type: ArtifactType;
  name: string;
  text: string;
}

export abstract class ChatMessageContentTest {
  static text(content: ChatMessageContent): content is ChatMessageContentText {
    return content.kind === ChatMessageContentType.Text;
  }

  static textChunks(
    content: ChatMessageContent,
  ): content is ChatMessageContentTextChunks {
    return content.kind === ChatMessageContentType.TextChunks;
  }

  static toolUse(
    content: ChatMessageContent,
  ): content is ChatMessageContentToolUse {
    return content.kind === ChatMessageContentType.ToolUse;
  }

  static artifact(
    content: ChatMessageContent,
  ): content is ChatMessageContentArtifact {
    return content.kind === ChatMessageContentType.Artifact;
  }
}
