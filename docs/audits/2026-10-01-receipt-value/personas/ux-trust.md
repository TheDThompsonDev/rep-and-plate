# Persona 2 — UI/UX engineer: trust, accessibility, and recovery

**Method:** Source-grounded heuristic simulation of the web receipt journey on October 1, 2026. This is an expert perspective, not real participant evidence. No production changes, live AI submission, authenticated upload, or assistive-technology trial were performed by this persona. Priorities are judgment about user impact, not measured abandonment rates.

**Lens:** A careful shopper uploads a receipt only if the app explains what will happen, preserves their effort, distinguishes guesses from checked data, and provides a clear route to a useful outcome.

## Simulated journey

Kitchen → Add receipt → Camera/file → Readability preview → Send or save for review → Chat processing/result → Pantry review → Correct products and quantities → Use groceries.

The successful route has sound safeguards. The alternate route for a guest or disconnected user does not clearly reach receipt processing later.

## Findings

### 1. P1 — Saving a receipt for later creates a note without a direct processing handoff

**Evidence:** `src/App.tsx:1017` says the grocery receipt is saved for review and not yet added to pantry stock. The sole saved review option is `Keep as a note` at `src/App.tsx:1022`. The message stored at `src/App.tsx:1031` has the image but lacks the AI/pending receipt metadata that drives the retry affordance at `src/ChatLayer.tsx:499`. Inline review renders only the stored options at `src/ChatLayer.tsx:690`. `src/domain.ts:512` resolves review choices without a capture-processing branch.

**Impact:** A shopper who takes the safe or disconnected route can reasonably expect review to finish the promised grocery extraction. The explicit action instead resolves a note. Re-upload or composing a new request becomes the practical recovery path. This loses momentum precisely where the receipt differentiator should first pay off.

**Recommendation:** Persist an unprocessed receipt capture with its intent, context, and processing state. Offer `Read this receipt` once access returns, retain `Keep as a note`, and distinguish `Saved photo` from `Groceries extracted`. Reuse the retained photo without requiring another file selection.

**Validation:** Save while disconnected; reconnect; process from the saved receipt; verify one resulting grocery record and no meal intake. Repeat across reload and an interrupted request.

### 2. P1 — Receipt capture hides the actionable reason a guest cannot get the benefit

**Evidence:** `src/ChatLayer.tsx:258` distinguishes sign-in, setup, restricted access, and unavailable connection, with sign-in/create-account controls at `src/ChatLayer.tsx:273`. Receipt preview collapses all unavailable cases to `AI is unavailable. You can still save this image for review.` at `src/App.tsx:1858`, and only shows the send controls if `available` at `src/App.tsx:1860`.

**Impact:** A guest who enters through Kitchen can take a photo before discovering an unexplained service failure. The receipt screen does not state that signing in may unlock processing or show that route. It weakens comprehension of what uploading actually gets them and compounds finding 1.

**Recommendation:** Show the specific access state in capture. For sign-in, connect the action to the value: `Sign in to turn this receipt into groceries and meal ideas`. Preserve the photo and optional context through sign-in/setup, then return to the preview. Distinguish restricted access from temporary connection failure.

**Validation:** Test guest → preview → sign-in → same preview → send, including cancelled sign-in. Verify no lost photo or silent substitution with another account's draft.

### 3. P1 — The upload privacy note conflicts with optional account saving

**Evidence:** `src/App.tsx:1892` discloses sending to an AI provider and says `Your saved records stay in this browser.` The preferences notice at `src/App.tsx:2819` instead explains optional account saving. `src/features/cloud/useAccountSync.ts:117` encodes records for account saving; `src/features/cloud/media.ts:23` uploads image bytes to the account media bucket. More detailed provider/conversation disclosure is in a separate About dialog at `src/ChatLayer.tsx:902`.

**Impact:** At the decision to send a receipt, users receive an incomplete storage mental model. For users with account saving enabled, a literal reading of the preview implies a boundary the implementation does not maintain. Receipts may contain loyalty or payment information; inconsistent disclosure can damage confidence in the differentiator.

**Recommendation:** Use concise, state-aware copy: images and relevant conversation are sent for processing; records save on this device; enabled account saving also saves a private account copy. Link to Help & privacy for provider, retention, and deletion details. Keep service names subordinate to the shopper's decision.

**Validation:** Compare preview copy in guest, signed-in/device-only, and account-saving states against actual destinations. Review retention claims against configured services before publishing them.

### 4. P2 — Receipt correction has no in-task view of the uploaded source photo

**Evidence:** `src/features/shopping/ReceiptReview.tsx:61` instructs shoppers to check the printed receipt; the review component receives only `GroceryReceipt` at line 12 and has no source image viewer. The receipt schema at `src/ai-contract.ts:59` contains extracted fields without a source-message/image reference. The photo exists on the capture chat message (`src/App.tsx:564`), while receipt cards are associated with the later answer (`src/ai-client.ts:153`).

**Impact:** Reviewing dates, totals, and abbreviated item lines becomes a memory or navigation task. The user must retain the paper or close the modal and find the earlier image. This makes checking uncertain extraction harder and undermines the convenience of digitizing receipts.

**Recommendation:** Link each receipt to its original capture and expose a zoomable source image in amount and item review. Provide full-screen zoom on small screens and a keyboard-accessible close/return route. Do not obscure the selected field while comparing.

**Validation:** On mobile, correct a misread total and abbreviated item from the stored image without leaving the review task. Check zoom, keyboard focus, and screen-reader labels with actual users/devices.

### 5. P2 — A rejected correction removes the editor instead of preserving the recovery task

**Evidence:** Quantity-history protection throws when product, serving, or purchase basis changes at `src/features/pantry/ledger.ts:371`. `src/features/pantry/PantryDialog.tsx:251` catches this during details updates and sets `details` false at line 261. Both manual save (`src/AICards.tsx:241`) and product application (`src/AICards.tsx:205`) clear their editor after `onUpdate`; the parent catches the rejection rather than returning a failure to those editors. The resulting error is shown on the pantry screen, after the edit draft has been abandoned.

**Impact:** A shopper correcting an earlier receipt after using groceries is pushed out of the task and loses their edit context. The underlying safeguard is valuable, but the recovery requires interpreting a history error and retracing the path.

**Recommendation:** Return an explicit success/failure result or throw a handled validation error to the editor. Keep the draft and selected product open; show the existing quantity-history explanation inline; offer the relevant `Adjust remaining amount` or linked-history route. Close the editor only after a successful update.

**Validation:** Consume or prepare from a receipt item, then try changing its serving basis. Verify the error is announced, the draft stays present, and the shopper can reach the permitted correction without re-entering data.

## Strengths to preserve

- Capture has practical guidance, a preview, explicit file formats/size limit, and retake (`src/App.tsx:1856`, `src/App.tsx:1911`, `src/App.tsx:1919`, `src/App.tsx:1940`).
- Purchases are repeatedly separated from food eaten, including the result card (`src/AICards.tsx:120`), the send instruction (`src/App.tsx:1877`), and product confirmation (`src/features/products/ReceiptProductReview.tsx:89`).
- Product ambiguity is explicit; candidates are unselected, manual/barcode paths are available, unknown amounts stay blank, and confirmation is required (`src/features/products/ReceiptProductReview.tsx:16`, `:56`, `:78`, `:82`).
- Processing and failures have status/alert semantics, saved-capture retry, and stale-response protection (`src/features/spot/Spot.tsx:216`, `src/ChatLayer.tsx:501`, `src/App.tsx:590`). Duplicate receipt handling preserves saved edits (`src/ai-client.ts:122`).
- Native dialog semantics, named close buttons, Escape handling, and opener-focus restoration are implemented (`src/components.tsx:179`, `:193`, `:218`). These source features do not establish full accessibility compliance.

## Research tasks and limits

1. Observe first-time shoppers explain, before uploading, what the photo produces and whether purchases become eaten calories. Ask again after a result and a `Save for review` detour.
2. Observe guest, interrupted-processing, and wrong-product scenarios. Record successful recovery, re-upload, lost context, and assistance needed; do not invent completion rates from this audit.
3. Run keyboard and screen-reader checks across modal replacement, processing announcements, returned errors, image zoom, and repeated item actions. Source semantics alone cannot confirm usable focus order or announcement behavior.
4. Verify a real camera photo, a long receipt, faded printing, mixed food/nonfood lines, and unknown serving amounts against actual processing. This audit did not measure OCR quality, latency, or backend availability.
5. Ask shoppers to explain device saving, AI processing, and optional account saving in their own words. Use comprehension results to decide how much disclosure belongs in the preview.

**Suggested acceptance outcome:** A shopper can state the benefit and data destination, upload once, recover from unavailable processing, check uncertain fields against the original photo, and reach a useful pantry action without mistaking purchases for meals eaten.
