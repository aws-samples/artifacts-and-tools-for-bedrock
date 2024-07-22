import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";

const SandboxPage = lazy(() => import("./pages/sandbox"));

export default function SandboxApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/sandbox.html"
          element={
            <Suspense>
              <SandboxPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
