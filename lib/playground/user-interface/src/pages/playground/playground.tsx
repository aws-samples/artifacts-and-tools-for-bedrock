import { useContext, useEffect, useState } from "react";
import { ChatUI } from "../../components/chat-ui/chat-ui";
import {
  ChatMessage,
  ChatMessageContentToolUse,
  ChatMessageContentTest,
  ChatMessageRole,
  InboundEventType,
  InboundFrame,
  InboundPayload,
  OutboundEventType,
  ChatMessageContentType,
  FileItem,
} from "../../types";
import { useParams } from "react-router-dom";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import { fetchAuthSession } from "aws-amplify/auth";
import { normalizeMessages } from "../../common/helpers/message-helper";
import useWebSocket from "react-use-websocket";
import BaseAppLayout from "../../components/base-app-layout";
import SandboxWrapper from "../../components/sandbox/sandbox-wrapper";
import styles from "../../styles/playground.module.scss";

const frames: Record<string, InboundFrame[]> = {};

export default function Playground() {
  const appContext = useContext(AppContext);
  const { sessionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [socketUrl, setSocketUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [artifactIndex, setArtifactIndex] = useState(-1);
  const { sendJsonMessage, readyState } = useWebSocket(socketUrl, {
    share: true,
    shouldReconnect: () => true,
    onOpen: () => {
      sendJsonMessage({
        session_id: sessionId,
        event_type: OutboundEventType.HEARTBEAT,
      });
    },
    onMessage: (payload) => {
      const frame: InboundFrame = JSON.parse(payload.data);

      if (!frames[frame.frame_id]) {
        frames[frame.frame_id] = [];
      }

      frames[frame.frame_id].push(frame);
      if (!frame.last) {
        return;
      }

      const data = JSON.parse(
        frames[frame.frame_id]
          .sort((a, b) => a.frame_idx - b.frame_idx)
          .map((f) => f.data)
          .join(""),
      ) as InboundPayload;
      delete frames[frame.frame_id];

      if (data.event_type === InboundEventType.ERROR) {
        const updated = [...messages];
        if (updated.length === 0) {
          updated.push({
            role: ChatMessageRole.Assistant,
            content: [],
          });
        }

        const lastMessage = updated[updated.length - 1];
        lastMessage.content.push({
          kind: ChatMessageContentType.TextChunks,
          chunks: [{ sequence_idx: data.sequence_idx, text: data.error }],
        });

        setRunning(false);
      } else if (data.event_type === InboundEventType.LOOP) {
        if (data.finish) {
          setRunning(false);
        } else {
          const message_data = {
            session_id: sessionId,
            event_type: OutboundEventType.CONVERSE,
            files,
          };

          console.log("Sending message", message_data);

          sendJsonMessage(message_data);
        }
      } else if (
        data.event_type === InboundEventType.TEXT_CHUNK ||
        data.event_type === InboundEventType.TOOL_USE
      ) {
        if (messages.length === 0) {
          console.error("Received text chunk without any messages");
          return;
        }

        const updated = [...messages];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage.role !== ChatMessageRole.Assistant) {
          console.error("Received text chunk without an assistant message");
          return;
        }

        if (data.event_type === InboundEventType.TEXT_CHUNK) {
          if (lastMessage.content.length === 0) {
            lastMessage.content.push({
              kind: ChatMessageContentType.TextChunks,
              chunks: [{ sequence_idx: data.sequence_idx, text: data.text }],
            });
          } else {
            const lastContent =
              lastMessage.content[lastMessage.content.length - 1];

            if (ChatMessageContentTest.textChunks(lastContent)) {
              lastContent.chunks.push({
                sequence_idx: data.sequence_idx,
                text: data.text,
              });
            } else {
              lastMessage.content.push({
                kind: ChatMessageContentType.TextChunks,
                chunks: [{ sequence_idx: data.sequence_idx, text: data.text }],
              });
            }
          }
        } else if (data.event_type === InboundEventType.TOOL_USE) {
          let toolUseContent: ChatMessageContentToolUse | null = null;
          for (const current of lastMessage.content) {
            if (
              ChatMessageContentTest.toolUse(current) &&
              current.tool_use_id === data.tool_use_id
            ) {
              toolUseContent = current;
              toolUseContent.status = data.status;
              toolUseContent.extra ??= {};
              toolUseContent.extra.request_text ??= data.extra?.request_text;
              toolUseContent.extra.response_text ??= data.extra?.response_text;
              toolUseContent.extra.response_html ??= data.extra?.response_html;
              toolUseContent.extra.output_files ??= data.extra?.output_files;

              break;
            }
          }

          if (!toolUseContent) {
            toolUseContent = {
              kind: ChatMessageContentType.ToolUse,
              sequence_idx: data.sequence_idx,
              tool_use_id: data.tool_use_id,
              tool_name: data.tool_name,
              status: data.status,
              extra: {
                request_text: data.extra.request_text,
                response_text: data.extra.response_text,
                response_html: data.extra.response_html,
                output_files: data.extra.output_files,
              },
            };

            lastMessage.content.push(toolUseContent);
          }
        }

        setMessages(updated);
      }
    },
  });

  useEffect(() => {
    (async () => {
      if (!appContext) return;
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();

      if (token) {
        setSocketUrl(`${appContext.config.websocket_endpoint}?token=${token}`);
      }
    })();
  }, [appContext]);

  useEffect(() => {
    (async () => {
      const apiClient = new ApiClient();
      const result = await apiClient.sessions.getSession(sessionId ?? "");

      if (result.exists) {
        setFiles(result.files ?? []);
        setMessages(result.messages ?? []);
      }

      setLoading(false);
    })();
  }, [sessionId]);

  const onAddFiles = async (update: FileItem[]) => {
    const fileNames = update.map((f) => f.file_name);
    let values = files.filter((f) => !fileNames.includes(f.file_name));
    values = values.concat(update);

    const apiClient = new ApiClient();
    await apiClient.files.setSessionFiles(sessionId ?? "", values);

    setFiles(values);
  };

  const onRemoveFile = async (fileItem: FileItem) => {
    const data = files.filter((f) => f.checksum !== fileItem.checksum);
    const apiClient = new ApiClient();
    await apiClient.files.setSessionFiles(sessionId ?? "", data);

    setFiles(data);
  };

  const sendMessage = (message: string) => {
    setRunning(true);

    const message_data = {
      session_id: sessionId,
      event_type: OutboundEventType.CONVERSE,
      message,
      files,
    };

    console.log("Sending message", message_data);

    sendJsonMessage(message_data);

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        role: ChatMessageRole.User,
        content: [
          {
            kind: ChatMessageContentType.Text,
            sequence_idx: 0,
            text: message,
          },
        ],
      },
      {
        role: ChatMessageRole.Assistant,
        content: [],
      },
    ]);
  };

  const { normalized, artifacts } = normalizeMessages(messages);

  if (!sessionId) return null;
  return (
    <BaseAppLayout
      contentType={artifactIndex >= 0 ? "table" : "default"}
      content={
        <div
          className={
            artifactIndex >= 0 ? styles.sandbox_open : styles.sandbox_closed
          }
        >
          <ChatUI
            sessionId={sessionId}
            loading={loading}
            messages={normalized}
            running={running}
            welcomeText="Generative AI Playground"
            readyState={readyState}
            files={files}
            onSendMessage={sendMessage}
            onAddFiles={onAddFiles}
            onRemoveFile={onRemoveFile}
            setArtifactIndex={setArtifactIndex}
          />
          {!loading && (
            <SandboxWrapper
              artifacts={artifacts}
              artifactIndex={artifactIndex}
              setArtifactIndex={setArtifactIndex}
            />
          )}
        </div>
      }
    />
  );
}
