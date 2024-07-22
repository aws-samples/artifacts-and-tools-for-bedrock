import React from "react";
import ReactDOM from "react-dom/client";
import SandboxApp from "./sandbox-app";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <React.StrictMode>
    <SandboxApp />
  </React.StrictMode>,
);
