import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRecordsNotice } from "./platform/BrowserRecordsNotice";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <BrowserRecordsNotice />
  </React.StrictMode>,
);
