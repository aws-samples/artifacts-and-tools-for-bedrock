import { ChatMessageContentArtifact } from "./messages";

export enum SandboxEventType {
  EXPAND = "EXPAND",
  SOURCE_CODE_REQUEST = "SOURCE_CODE_REQUEST",
  SOURCE_CODE_RESPONSE = "SOURCE_CODE_RESPONSE",
}

export enum ArtifactType {
  REACT = "react",
  HTML = "html",
  UNKNOWN = "unknown",
}

export type SandboxEvent =
  | SandboxSourceCodeRequestEvent
  | SandboxSourceCodeResponseEvent
  | SandboxExpandEvent;

export interface SandboxSourceCodeRequestEvent {
  type: SandboxEventType.SOURCE_CODE_REQUEST;
}

export interface SandboxSourceCodeResponseEvent {
  type: SandboxEventType.SOURCE_CODE_RESPONSE;
  artifact: ChatMessageContentArtifact;
}

export interface SandboxExpandEvent {
  type: SandboxEventType.EXPAND;
  expanded: boolean;
}
