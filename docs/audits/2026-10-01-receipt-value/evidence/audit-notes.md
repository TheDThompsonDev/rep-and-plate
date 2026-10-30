# Audit verification notes

The CYC review playbook could not initialize. Two start attempts, including explicit src/server/tests/docs scopes, returned: `Source fingerprint exceeds 20,000 files or 128 MiB of selected source; review source exclusions or narrow the project.` No run ID or state was created. Scope restricts changes but does not narrow source selection. The selected project includes large tracked image archives; the existing error ledger records the same limitation under CYC-ASSETS-001. Configuration and engine code were preserved. No managed-run completion is claimed.

The first additional walkthrough expected Keep as a note immediately after image saving. It failed correctly: the application first tells the person to ask What needs review. The walkthrough now follows that instruction and confirms the resulting note-only action. That extra discovery step is retained in the audit, rather than changing the application to satisfy the test.

Agent-browser's native/ref clicks did not reliably advance some controls; invoking the observed DOM controls through its documented eval facility did. Its upload attempt gave an image-open error. The isolated Playwright walkthrough and the existing upload suites opened the same fixture successfully. No product defect is inferred from the conflicting automation result.

An initial persona hypothesis confused the cook step key with its action. Source review established that the action is planner and Kitchen maps it correctly. The crash claim was retracted and excluded from recommendations.

All recommendations remain pending product decisions. No context index, shared ledger or production files were edited by this audit. Focused existing browser checks plus an additional controlled walkthrough provide the task-specific verification; unrelated complete-project checks were not rerun for a documentation audit.
