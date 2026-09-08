import React from "react";
import MainView from "./views/MainView";
import SubtitleView from "./views/SubtitleView";
import { WindowChrome } from "./components/WindowChrome";
import { Review } from "./components/_demo/Review";

interface AppProps {
  windowType: "main" | "capsule";
}

export default function App({ windowType }: AppProps): React.ReactElement {
  if (windowType === "capsule") {
    return <SubtitleView />;
  }
  // TEMP v0.2 收尾：用 Review（v0 重设计）作为主窗默认内容，
  // 直到 v0.2 UI framework 稳定后再合回 MainView。
  if (window.location.search.includes("demo=old")) {
    return (
      <WindowChrome>
        <MainView />
      </WindowChrome>
    );
  }
  return <Review />;
}
