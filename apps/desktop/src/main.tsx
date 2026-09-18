import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CodeStudioWindow } from "./components/CodeStudioWindow";
import "./App.css";

const isStandaloneEditor =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).get("view") === "editor" ||
    window.location.hash === "#editor");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isStandaloneEditor ? <CodeStudioWindow /> : <App />}
  </React.StrictMode>,
);
