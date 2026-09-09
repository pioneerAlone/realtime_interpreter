import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// design system v2 (T-G-01) — order matters: tokens first, reset, then primitives
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/primitives.css";

const queryParams = new URLSearchParams(window.location.search);
const demo = queryParams.get("demo"); // "atoms" → AtomsDemo
const windowParam = queryParams.get("window"); // "capsule" → SubtitleView

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App
      windowType={windowParam === "capsule" ? "capsule" : "main"}
      demo={demo}
    />
  </React.StrictMode>,
);
