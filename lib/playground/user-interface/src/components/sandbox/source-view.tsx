import { CodeView } from "@cloudscape-design/code-view";
import { ChatMessageContentArtifact } from "../../types";
import { useLayoutEffect, useRef } from "react";
import { SandboxScrollState } from "./sandbox";
import typescriptHighlight from "@cloudscape-design/code-view/highlight/typescript";
import htmlHightlight from "@cloudscape-design/code-view/highlight/html";

export default function SourceView({
  artifact,
  sourceCode,
}: {
  artifact: ChatMessageContentArtifact;
  sourceCode: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (SandboxScrollState.skipNextHistoryUpdate) {
      SandboxScrollState.skipNextHistoryUpdate = false;
      return;
    }

    if (!SandboxScrollState.userHasScrolled && sourceCode.length > 0) {
      SandboxScrollState.skipNextScrollEvent = true;
      endRef.current?.scrollIntoView();
    }
  }, [sourceCode]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <CodeViewContainer artifact={artifact} sourceCode={sourceCode} />
      <div ref={endRef}></div>
    </div>
  );
}

function CodeViewContainer({
  artifact,
  sourceCode,
}: {
  artifact: ChatMessageContentArtifact;
  sourceCode: string;
}) {
  if (artifact.type === "react") {
    return <CodeView content={sourceCode} highlight={typescriptHighlight} />;
  } else if (artifact.type === "html") {
    return <CodeView content={sourceCode} highlight={htmlHightlight} />;
  } else {
    return <CodeView content={sourceCode} />;
  }
}
