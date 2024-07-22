import { Fragment } from "react";
import {
  Box,
  Button,
  Container,
  ExpandableSection,
  Flashbar,
  FlashbarProps,
  SpaceBetween,
  Spinner,
} from "@cloudscape-design/components";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import {
  ChatMessage,
  ChatMessageContentToolUse,
  ChatMessageContentTest,
  ToolStatus,
  ChatMessageContentText,
  ChatMessageContentArtifact,
} from "../../types";
import styles from "../../styles/chat-ui.module.scss";
import { ApiClient } from "../../common/api-client/api-client";

export interface ChatUIMessageProps {
  sessionId: string;
  message: ChatMessage;
  setArtifactIndex: (index: number) => void;
}

export default function ChatUIAssistantMessage(props: ChatUIMessageProps) {
  return (
    <Container>
      {props.message.content.length === 0 ? (
        <Box>
          <Spinner />
        </Box>
      ) : null}
      {props.message.content.map((content, idx) => (
        <Fragment key={idx}>
          {ChatMessageContentTest.text(content) && (
            <ContentText content={content} />
          )}
          {ChatMessageContentTest.toolUse(content) && (
            <ContentToolUse sessionId={props.sessionId} content={content} />
          )}
          {ChatMessageContentTest.artifact(content) && (
            <ContentArtifact
              content={content}
              setArtifactIndex={props.setArtifactIndex}
            />
          )}
        </Fragment>
      ))}
    </Container>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      children={text}
      remarkPlugins={[remarkGfm]}
      components={{
        pre(props) {
          const { children, ...rest } = props;
          return (
            <pre {...rest} className={styles.codeMarkdown}>
              {children}
            </pre>
          );
        },
        table(props) {
          const { children, ...rest } = props;
          return (
            <table {...rest} className={styles.markdownTable}>
              {children}
            </table>
          );
        },
        th(props) {
          const { children, ...rest } = props;
          return (
            <th {...rest} className={styles.markdownTableCell}>
              {children}
            </th>
          );
        },
        td(props) {
          const { children, ...rest } = props;
          return (
            <td {...rest} className={styles.markdownTableCell}>
              {children}
            </td>
          );
        },
      }}
    />
  );
}

function ContentText({ content }: { content: ChatMessageContentText }) {
  return <Markdown text={content.text} />;
}

function ContentToolUse({
  sessionId,
  content,
}: {
  sessionId: string;
  content: ChatMessageContentToolUse;
}) {
  const onFileDownload = async (fileId: string, fileName: string) => {
    const apiClient = new ApiClient();
    const result = await apiClient.files.presignedFileDonwload(
      sessionId,
      fileId,
      fileName,
    );

    window.open(result.data);
  };

  return (
    <>
      <Flashbar
        items={[
          {
            id: "tool",
            type: toolStatusMapper(content.status),
            loading: content.status == ToolStatus.RUNNING,
            content: content.tool_name,
          },
        ]}
      />
      {content.extra.request_text && (
        <ExpandableSection headerText="Request">
          <div style={{ width: "100%", overflowX: "scroll" }}>
            <Markdown text={content.extra.request_text} />
          </div>
        </ExpandableSection>
      )}
      <ExpandableSection headerText="Response">
        <div style={{ width: "100%", overflowX: "scroll" }}>
          <pre>{content.extra.response_text ?? "Not available"}</pre>
        </div>
      </ExpandableSection>
      {content.extra.output_files && (
        <div style={{ marginTop: "0.5rem" }}>
          <SpaceBetween size="l" direction="horizontal">
            {content.extra.output_files.map((c) => (
              <Button
                key={c.file_id}
                iconName="download"
                iconAlign="right"
                onClick={() => onFileDownload(c.file_id, c.file_name)}
              >
                {c.file_name}
              </Button>
            ))}
          </SpaceBetween>
        </div>
      )}
      {content.extra.response_html && (
        <div
          dangerouslySetInnerHTML={{ __html: content.extra.response_html }}
          className={styles.result_html}
        />
      )}
    </>
  );
}

function toolStatusMapper(status: ToolStatus): FlashbarProps.Type {
  switch (status) {
    case ToolStatus.RUNNING:
      return "in-progress";
    case ToolStatus.SUCCESS:
      return "success";
    case ToolStatus.ERROR:
      return "error";
    default:
      return "info";
  }
}

function ContentArtifact({
  content,
  setArtifactIndex,
}: {
  content: ChatMessageContentArtifact;
  setArtifactIndex: (index: number) => void;
}) {
  return (
    <div>
      <Button
        iconName="external"
        onClick={() => setArtifactIndex(content.index)}
      >
        {content.name}
      </Button>
    </div>
  );
}
