import React from "react";
import MainView from "./views/MainView";
import SubtitleView from "./views/SubtitleView";

interface AppProps {
  windowType: "main" | "capsule";
}

export default function App({ windowType }: AppProps): React.ReactElement {
  return windowType === "capsule" ? <SubtitleView /> : <MainView />;
}
