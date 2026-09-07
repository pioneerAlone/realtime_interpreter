import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const windowParam = new URLSearchParams(window.location.search).get("window");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App windowType={windowParam === "capsule" ? "capsule" : "main"} />
  </React.StrictMode>,
);
