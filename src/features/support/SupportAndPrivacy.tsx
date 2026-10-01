import { useState, useEffect } from "react";
import {
  dataHandling,
  supportDiagnostics,
  validSupportUrl,
  defaultSupportUrl,
} from "./model";

export default function SupportAndPrivacy({
  supportUrl,
  requestIds = [],
}: {
  supportUrl?: string;
  requestIds?: readonly string[];
}) {
  const [notice, setNotice] = useState("");
  const [configured, setConfigured] = useState(supportUrl);
  useEffect(() => {
    if (supportUrl) return;
    let live = true;
    void fetch("/api/cloud/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (live) setConfigured(validSupportUrl(v?.supportUrl));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [supportUrl]);
  const contact = validSupportUrl(configured) ?? defaultSupportUrl;
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([supportDiagnostics("web", requestIds)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "rep-and-plate-support.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Diagnostic file downloaded. Review it before sharing with support.",
    );
  };
  return (
    <section aria-label="Help and your data" className="cloud-local">
      <h3>Help & your data</h3>
      <p>
        Something off? Tell us what you were trying to do and what happened.
        Keep receipts, passwords and private meal details out of your report.
      </p>
      {contact ? (
        <a
          className="you-dialog-action"
          href={contact}
          target="_blank"
          rel="noopener noreferrer"
        >
          Contact support
        </a>
      ) : (
        <p>
          A support contact has not been configured for this preview. Share
          feedback with the person who invited you.
        </p>
      )}
      <button type="button" className="you-dialog-action" onClick={download}>
        Download safe diagnostics
      </button>
      <small>
        The file includes app version, platform, time and available request IDs.
        It contains no account email, messages, photos or health records.
      </small>
      <p role="status">{notice}</p>
      <details>
        <summary>How your data is handled</summary>
        {dataHandling.map((item) => (
          <div key={item.title}>
            <h4>{item.title}</h4>
            <p>{item.text}</p>
          </div>
        ))}
      </details>
    </section>
  );
}
