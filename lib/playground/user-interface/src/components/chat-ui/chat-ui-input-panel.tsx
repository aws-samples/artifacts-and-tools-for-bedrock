import {
  Button,
  Container,
  SpaceBetween,
  Spinner,
} from "@cloudscape-design/components";
import { useEffect, useLayoutEffect, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ChatScrollState } from "./chat-ui";
import { ReadyState } from "react-use-websocket";
import { ChatMessage, FileItem } from "../../types";
import FileDialog from "./file-dialog";
import styles from "../../styles/chat-ui.module.scss";

export interface ChatUIInputPanelProps {
  sessionId: string;
  loading?: boolean;
  inputPlaceholderText?: string;
  sendButtonText?: string;
  running?: boolean;
  messages?: ChatMessage[];
  readyState: ReadyState;
  files: FileItem[];
  onSendMessage?: (message: string) => void;
  onAddFiles: (files: FileItem[]) => void;
  onRemoveFile: (file: FileItem) => void;
}

export default function ChatUIInputPanel(props: ChatUIInputPanelProps) {
  const [inputText, setInputText] = useState("");
  const [fileDialogVisible, setFileDialogVisible] = useState(false);

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
  }, []);

  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }

    if (!ChatScrollState.userHasScrolled && (props.messages ?? []).length > 0) {
      ChatScrollState.skipNextScrollEvent = true;

      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messages]);

  const onSendMessage = () => {
    if (props.loading) return;
    if (props.readyState !== ReadyState.OPEN) return;
    if (props.running) return;
    if (!inputText.trim()) return;

    ChatScrollState.userHasScrolled = false;
    props.onSendMessage?.(inputText);
    setInputText("");
  };

  const onTextareaKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (!props.running && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSendMessage();
    }
  };

  return (
    <SpaceBetween direction="vertical" size="l">
      <Container>
        <div className={styles.input_textarea_container}>
          <SpaceBetween size="xxs" direction="horizontal" alignItems="center">
            <Button
              variant="icon"
              iconName={props.files.length > 0 ? "file-open" : "file"}
              disabled={props.loading}
              onClick={() => setFileDialogVisible(true)}
            />
            {fileDialogVisible && (
              <FileDialog
                sessionId={props.sessionId}
                setVisible={setFileDialogVisible}
                files={props.files}
                onAddFiles={props.onAddFiles}
                onRemoveFile={props.onRemoveFile}
              />
            )}
          </SpaceBetween>
          <TextareaAutosize
            className={styles.input_textarea}
            maxRows={6}
            minRows={1}
            spellCheck={true}
            autoFocus
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            value={inputText}
            placeholder={props.inputPlaceholderText ?? "Send a message"}
          />
          <div style={{ marginLeft: "8px" }}>
            <Button
              disabled={
                props.loading ||
                props.readyState !== ReadyState.OPEN ||
                props.running ||
                inputText.trim().length === 0
              }
              onClick={onSendMessage}
              iconAlign="right"
              iconName={!props.running ? "angle-right-double" : undefined}
              variant="primary"
            >
              {props.running ? (
                <>
                  Loading&nbsp;&nbsp;
                  <Spinner />
                </>
              ) : props.readyState !== ReadyState.OPEN ? (
                <>
                  Connecting&nbsp;&nbsp;
                  <Spinner />
                </>
              ) : (
                <>{props.sendButtonText ?? "Send"}</>
              )}
            </Button>
          </div>
        </div>
      </Container>
    </SpaceBetween>
  );
}
