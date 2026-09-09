import React from "react";
import MainView from "./views/MainView";
import SubtitleView from "./views/SubtitleView";
import AtomsDemo from "./components/_demo/AtomsDemo";

interface AppProps {
  windowType: "main" | "capsule";
  /** route to demo pages; overrides windowType when set */
  demo?: string | null;
}

export default function App({ windowType, demo }: AppProps): React.ReactElement {
  // demo routes take precedence (design system v2 verification pages)
  if (demo === "atoms") return <AtomsDemo />;

  return windowType === "capsule" ? <SubtitleView /> : <MainView />;
}
