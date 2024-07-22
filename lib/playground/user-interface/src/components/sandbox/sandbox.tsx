import { useEffect, useRef, useState } from "react";
import {
  ChatMessageContentArtifact,
  SandboxEvent,
  SandboxEventType,
  SandboxExpandEvent,
  SandboxSourceCodeResponseEvent,
} from "../../types";
import {
  Container,
  Header,
  SpaceBetween,
  SegmentedControl,
  Button,
  CopyToClipboard,
} from "@cloudscape-design/components";
import SourceView from "./source-view";
import styles from "../../styles/playground.module.scss";

export interface SandboxProps {
  artifact: ChatMessageContentArtifact;
  versions: number[];
  setArtifactIndex: (index: number) => void;
  onClose: () => void;
}

export abstract class SandboxScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

export default function Sandbox(props: SandboxProps) {
  const artifact = props.artifact;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(artifact.ready);
  const [currentKey, setCurrentKey] = useState(0);
  const [selectedId, setSelectedId] = useState(
    artifact.ready ? "view" : "source",
  );

  const currentVersionIndex = props.versions.indexOf(artifact.index);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<SandboxEvent>) => {
      if (event.data.type === SandboxEventType.SOURCE_CODE_REQUEST) {
        if (artifact.ready) {
          const event: SandboxSourceCodeResponseEvent = {
            type: SandboxEventType.SOURCE_CODE_RESPONSE,
            artifact,
          };

          iframeRef.current?.contentWindow?.postMessage(event, "*");
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [artifact]);

  useEffect(() => {
    if (artifact.ready && !ready) {
      const event: SandboxSourceCodeResponseEvent = {
        type: SandboxEventType.SOURCE_CODE_RESPONSE,
        artifact,
      };

      iframeRef.current?.contentWindow?.postMessage(event, "*");

      setReady(true);
      setSelectedId("view");
    }
  }, [artifact, ready]);

  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [expanded]);

  useEffect(() => {
    const current = containerRef.current;
    if (!current) return;

    const onScroll = (event: Event) => {
      const target = event.target as HTMLDivElement;
      if (SandboxScrollState.skipNextScrollEvent) {
        SandboxScrollState.skipNextScrollEvent = false;
        return;
      }

      const isScrollToTheEnd =
        Math.abs(
          target.scrollTop + target.offsetHeight - target.scrollHeight,
        ) <= 10;

      if (!isScrollToTheEnd) {
        SandboxScrollState.userHasScrolled = true;
      } else {
        SandboxScrollState.userHasScrolled = false;
      }
    };

    const childs = current.getElementsByTagName("div");
    for (const child of childs) {
      child.addEventListener("scroll", onScroll);
    }

    return () => {
      for (const child of childs) {
        child.removeEventListener("scroll", onScroll);
      }
    };
  }, []);

  const onRefresh = () => {
    setCurrentKey((prevKey) => prevKey + 1);
  };

  const onExpandToggle = () => {
    const newValue = !expanded;
    setExpanded(newValue);

    const event: SandboxExpandEvent = {
      type: SandboxEventType.EXPAND,
      expanded: newValue,
    };

    iframeRef.current?.contentWindow?.postMessage(event, "*");
  };

  const actualSelectedId = ready ? selectedId : "source";

  return (
    <div
      ref={containerRef}
      className={
        expanded ? styles.sandbox_container_expanded : styles.sandbox_container
      }
    >
      <Container
        fitHeight={true}
        header={
          <Header
            variant="h3"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <SegmentedControl
                  selectedId={actualSelectedId}
                  onChange={({ detail }) => setSelectedId(detail.selectedId)}
                  label="Default segmented control"
                  options={[
                    {
                      text: "View",
                      id: "view",
                      disabled: !ready,
                      iconName: !ready ? "status-pending" : undefined,
                    },
                    {
                      text: "Source",
                      id: "source",
                    },
                  ]}
                />
                <Button variant="icon" iconName="close" onClick={props.onClose}>
                  Close
                </Button>
              </SpaceBetween>
            }
          >
            {artifact.name}
          </Header>
        }
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Button
                variant="icon"
                iconName="arrow-left"
                disabled={currentVersionIndex === 0}
                onClick={() =>
                  props.setArtifactIndex(
                    props.versions[currentVersionIndex - 1],
                  )
                }
              >
                Back
              </Button>
              <span>
                Version {currentVersionIndex + 1} of {props.versions.length}
              </span>
              <Button
                variant="icon"
                iconName="arrow-right"
                disabled={currentVersionIndex === props.versions.length - 1}
                onClick={() =>
                  props.setArtifactIndex(
                    props.versions[currentVersionIndex + 1],
                  )
                }
              >
                Forward
              </Button>
            </SpaceBetween>
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="icon"
                iconName="refresh"
                onClick={onRefresh}
                disabled={actualSelectedId !== "view"}
              >
                Refresh
              </Button>
              <CopyToClipboard
                variant="icon"
                copySuccessText="Copied"
                copyErrorText="Error copying text"
                textToCopy={artifact.text}
              />
              <Button
                variant="icon"
                iconName={expanded ? "shrink" : "expand"}
                onClick={onExpandToggle}
              >
                Expand
              </Button>
            </SpaceBetween>
          </div>
        }
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            display: actualSelectedId === "view" ? "block" : "none",
          }}
        >
          <iframe
            src="/sandbox.html"
            title="Artifacts"
            tabIndex={1}
            allowFullScreen={false}
            sandbox="allow-scripts allow-modals allow-popups allow-same-origin"
            ref={iframeRef}
            key={currentKey}
          ></iframe>
        </div>
        <div
          style={{
            display: actualSelectedId === "source" ? "block" : "none",
          }}
        >
          <SourceView artifact={artifact} sourceCode={artifact.text} />
        </div>
      </Container>
    </div>
  );
}
