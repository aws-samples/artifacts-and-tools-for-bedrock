import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";

const AppFrame = lazy(() => import("./components/app-frame"));
const PlaygroundPage = lazy(() => import("./pages/playground"));
const SessionsPage = lazy(() => import("./pages/sessions"));
const NotFoundPage = lazy(() => import("./pages/not-found"));

export default function MainApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppFrame />}>
          <Route
            index
            path=""
            element={
              <Suspense>
                <PlaygroundPage />
              </Suspense>
            }
          />
          <Route
            path="chat/:sessionId"
            element={
              <Suspense>
                <PlaygroundPage />
              </Suspense>
            }
          />
          <Route
            path="sessions"
            element={
              <Suspense>
                <SessionsPage />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <Suspense>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
