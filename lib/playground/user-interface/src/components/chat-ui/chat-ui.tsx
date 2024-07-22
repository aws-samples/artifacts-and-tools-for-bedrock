import { StatusIndicator } from "@cloudscape-design/components";
import { useEffect } from "react";
import { ReadyState } from "react-use-websocket";
import { ChatMessage, FileItem } from "../../types";
import ChatUIInputPanel from "./chat-ui-input-panel";
import ChatUIMessageList from "./chat-ui-message-list";
import styles from "../../styles/chat-ui.module.scss";

export interface ChatUIProps {
  sessionId: string;
  loading?: boolean;
  running?: boolean;
  messages?: ChatMessage[];
  welcomeText?: string;
  inputPlaceholderText?: string;
  sendButtonText?: string;
  readyState: ReadyState;
  files: FileItem[];
  onSendMessage?: (message: string) => void;
  onAddFiles: (files: FileItem[]) => void;
  onRemoveFile: (file: FileItem) => void;
  setArtifactIndex: (index: number) => void;
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

export function ChatUI(props: ChatUIProps) {
  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }

      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
            window.scrollY -
            document.documentElement.scrollHeight,
        ) <= 10;

      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };

    window.addEventListener("scroll", onWindowScroll);

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, [props.loading]);

  return (
    <div className={styles.chat_container}>
      <ChatUIMessageList
        sessionId={props.sessionId}
        messages={props.messages}
        setArtifactIndex={props.setArtifactIndex}
      />
      <div className={styles.welcome_text}>
        {props.messages?.length === 0 && !props.loading && (
          <center>{props.welcomeText ?? "ChatBot"}</center>
        )}
        {props.loading && (
          <center>
            <StatusIndicator type="loading">Loading</StatusIndicator>
          </center>
        )}
      </div>
      <div className={styles.input_container}>
        <ChatUIInputPanel {...props} />
      </div>
    </div>
  );
}
