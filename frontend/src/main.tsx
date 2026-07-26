import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Imported after index.css so the bundled @font-face rules are registered
// before anything referencing them paints.
import "./fonts.ts";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
