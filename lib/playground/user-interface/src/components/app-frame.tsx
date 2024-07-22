import { useEffect, useState } from "react";
import {
  Alert,
  Authenticator,
  Heading,
  ThemeProvider,
  defaultDarkModeOverride,
  useTheme,
} from "@aws-amplify/ui-react";
import { Outlet } from "react-router-dom";
import { StorageHelper } from "../common/helpers/storage-helper";
import { Mode } from "@cloudscape-design/global-styles";
import { APP_NAME } from "../common/constants";
import { Amplify, ResourcesConfig } from "aws-amplify";
import { AppConfig } from "../types/app";
import { AppContext } from "../common/app-context";
import GlobalHeader from "./global-header";
import "@cloudscape-design/global-styles/index.css";
import "@aws-amplify/ui-react/styles.css";
import "../styles/app.scss";

export default function AppFrame() {
  const { tokens } = useTheme();
  const [config, setConfig] = useState<(ResourcesConfig & AppConfig) | null>(
    null,
  );
  const [error, setError] = useState<boolean | null>(null);
  const [theme, setTheme] = useState(StorageHelper.getTheme());

  useEffect(() => {
    (async () => {
      try {
        const result = await fetch("/aws-exports.json");
        const awsExports: ResourcesConfig & AppConfig = await result.json();

        Amplify.configure(awsExports);

        setConfig(awsExports);
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();
  }, []);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          const newValue =
            document.documentElement.style.getPropertyValue(
              "--app-color-scheme",
            );

          const mode = newValue === "dark" ? Mode.Dark : Mode.Light;
          if (mode !== theme) {
            setTheme(mode);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
    };
  }, [theme]);

  if (!config) {
    if (error) {
      return (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Alert heading="Configuration error" variation="error">
            Error loading configuration from "
            <a href="/aws-exports.json" style={{ fontWeight: "600" }}>
              /aws-exports.json
            </a>
            "
          </Alert>
        </div>
      );
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        ...
      </div>
    );
  }

  return (
    <AppContext.Provider value={config}>
      <ThemeProvider
        theme={{
          name: "default-theme",
          overrides: [defaultDarkModeOverride],
        }}
        colorMode={theme === Mode.Dark ? "dark" : "light"}
      >
        <Authenticator
          hideSignUp={true}
          components={{
            SignIn: {
              Header: () => {
                return (
                  <Heading
                    padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
                    level={3}
                  >
                    {APP_NAME}
                  </Heading>
                );
              },
            },
          }}
        >
          <GlobalHeader />
          <div style={{ height: "56px" }}>&nbsp;</div>
          <Outlet />
        </Authenticator>
      </ThemeProvider>
    </AppContext.Provider>
  );
}
