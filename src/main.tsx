import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRecordsNotice } from "./platform/BrowserRecordsNotice";
import "./styles.css";

// Where Supabase Auth sends a person who pressed Connect in Claude. Loaded only on that address.
const OAuthConsent = React.lazy(() => import("./features/connections/OAuthConsent"));
const consent = location.pathname === "/oauth/consent";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {consent ? (
      <Suspense fallback={null}>
        <OAuthConsent />
      </Suspense>
    ) : (
      <>
        <App />
        <BrowserRecordsNotice />
      </>
    )}
  </React.StrictMode>,
);
