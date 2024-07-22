import { useEffect, useRef, useState } from "react";
import {
  ArtifactType,
  ChatMessageContentArtifact,
  SandboxEvent,
  SandboxEventType,
} from "../../types";
import ReactComponent from "../../components/sandbox/react-component/react-component";
import "../../styles/sandbox.scss";

export default function SandboxPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [artifact, setArtifact] = useState<
    ChatMessageContentArtifact | undefined
  >();

  useEffect(() => {
    const messageHandler = (event: MessageEvent<SandboxEvent>) => {
      const data = event.data;
      console.log(data);

      if (data.type === SandboxEventType.SOURCE_CODE_RESPONSE) {
        if (
          artifact?.text !== data.artifact.text ||
          artifact?.index !== data.artifact.index
        ) {
          setArtifact(data.artifact);
        }
      } else if (data.type === SandboxEventType.EXPAND) {
        iframeRef.current?.contentWindow?.focus();
      }
    };

    window.addEventListener("message", messageHandler);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [artifact]);

  useEffect(() => {
    window.parent.postMessage(
      {
        type: SandboxEventType.SOURCE_CODE_REQUEST,
      },
      "*",
    );
  }, []);

  useEffect(() => {
    iframeRef.current?.contentWindow?.focus();
  }, [artifact]);

  if (!artifact) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      {artifact.type == ArtifactType.REACT && (
        <ReactComponent code={artifact.text} />
      )}
      {artifact.type == ArtifactType.HTML && (
        <iframe
          ref={iframeRef}
          srcDoc={artifact.text}
          sandbox="allow-scripts allow-same-origin allow-modals"
          tabIndex={1}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      )}
    </div>
  );
}
