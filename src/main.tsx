import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./styles/globals.css";
import { registerServiceWorker } from "./registerServiceWorker";

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// register service worker in production
if (import.meta.env.PROD) {
  registerServiceWorker();
}
