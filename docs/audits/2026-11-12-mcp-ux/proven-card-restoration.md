# Restore the working card, change one line

The user explicitly narrowed the request: keep the card they just had and change the entertaining blank-week line. The delivery and layout changes exceeded that scope.

Restore the complete coaching HTML from b34d29c, SHA-256 `c045f8ff1d97819fbb0e74d27800bc33cdcb94d2959f3a952a30e234cf7a6836`, including its original advertised URI. Restore basic Spot HTML and URI `23b171e0d51b2450` as well. Resource aliases for later versions remain readable. Keep the structured Spot result repair from e5af4dc, which the user confirmed worked on the existing card. Restore that release's reply policy.

Across `assistant.ts`, `personality.ts`, `presentation.ts`, `coaching-mcp.ts` and `coaching-prompts.ts`, the runtime difference from the user-confirmed e5af4dc release is only the requested blank-week podcast joke. Template source differs outside the actual HTML only to retain compatibility aliases. No new layout, app loader, tool, credential, scope or data write was introduced.

The real SDK resource test now compares the complete served coaching HTML with the frozen known-working HTML, not an approximate screenshot or latest template. Browser tests assert the original heading and goal prompt and exercise the same current/cached refresh and explicit-approval journeys. The podcast line is data, so changing it does not change the original template hash.

Computer-use accessibility confirmed the user's blank state, but a click lacked geometry and a keyboard page reload retained the old message. The user then stopped Computer Use with Escape. Existing blank cached messages are not proof that a newly requested corrected resource has rendered; that live check is still distinct from the server/template restoration. No further computer control, auth/key changes or cache-bypass experiments are included.

Direct validation and final release evidence are retained in `.local-checks/mcp-proven-release.json`. The CYC runner still fails before a run at its existing source-fingerprint ceiling; engine and configuration were not altered.
