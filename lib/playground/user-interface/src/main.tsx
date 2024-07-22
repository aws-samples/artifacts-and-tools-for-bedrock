import React from "react";
import ReactDOM from "react-dom/client";
import { StorageHelper } from "./common/helpers/storage-helper";
import MainApp from "./main-app";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

const theme = StorageHelper.getTheme();
StorageHelper.applyTheme(theme);

root.render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>,
);
