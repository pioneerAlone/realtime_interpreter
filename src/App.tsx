import React from "react";
import MainView from "./views/MainView";
import SubtitleView from "./views/SubtitleView";
import { WindowChrome } from "./components/WindowChrome";

interface AppProps {
  windowType: "main" | "capsule";
}

export default function App({ windowType }: AppProps): React.ReactElement {
  if (windowType === "capsule") {
    return <SubtitleView />;
  }
  return (
    <WindowChrome>
      <MainView />
    </WindowChrome>
  );
}
