import React from "react";
import { SpaceBetween } from "@cloudscape-design/components";
import { ChatMessage, ChatMessageRole } from "../../types";
import ChatUIAssistantMessage from "./chat-ui-assistant-message";
import ChatUIUserMessage from "./chat-ui-user-message";

export interface ChatUIMessageListProps {
  sessionId: string;
  messages?: ChatMessage[];
  setArtifactIndex: (index: number) => void;
}

export default function ChatUIMessageList(props: ChatUIMessageListProps) {
  const messages = props.messages || [];

  return (
    <SpaceBetween direction="vertical" size="m">
      {messages.map((message, idx) => (
        <React.Fragment key={idx}>
          {message?.role === ChatMessageRole.Assistant && (
            <ChatUIAssistantMessage
              sessionId={props.sessionId}
              message={message}
              setArtifactIndex={props.setArtifactIndex}
            />
          )}
          {message?.role === ChatMessageRole.User && (
            <ChatUIUserMessage message={message} />
          )}
        </React.Fragment>
      ))}
    </SpaceBetween>
  );
}
