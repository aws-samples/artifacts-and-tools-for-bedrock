import React from "react";
import { TextContent } from "@cloudscape-design/components";
import { ChatMessage, ChatMessageContentTest } from "../../types";

export interface ChatUIMessageProps {
  message: ChatMessage;
}

export default function ChatUIUserMessage(props: ChatUIMessageProps) {
  return (
    <div>
      {props.message.content.map((content, idx) => (
        <React.Fragment key={idx}>
          {ChatMessageContentTest.text(content) && (
            <TextContent>
              <strong>{content.text}</strong>
            </TextContent>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
