import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// 全局样式入口：tokens (设计变量) + reset (基线重置) + styles.css (组件级样式)
import "./styles/global.css";
import "./styles.css";

const windowParam = new URLSearchParams(window.location.search).get("window");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App windowType={windowParam === "capsule" ? "capsule" : "main"} />
  </React.StrictMode>,
);
