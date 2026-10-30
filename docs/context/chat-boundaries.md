# Chat conversation boundaries

Implemented 2026-09-30, user acceptance pending. The shared hosted chat API covers both web and native clients. General health/fitness questions should get useful conversational answers; food/workout records require separate explicit capture evidence and existing review controls.

| Request | Behavior |
| --- | --- |
| Nutrition, training, recovery, ordinary wellness, cooking, grocery budget, app help | Answer, clarify when necessary, or suggest an existing workflow |
| Investing, unrelated legal/political/coding requests | Briefly redirect to the app's health/fitness scope |
| Personal diagnosis, lab interpretation, medication dose/change, treatment or injury clearance | Clinician/prescriber/pharmacist handoff; may help prepare questions |
| Harmful restriction, compensatory exercise or drug misuse | Supportive safer-direction response, no harmful plan |
| Current potentially urgent symptoms or self-harm crisis | Prompt urgent local help, no diagnosis or reassurance |

`server/chat-boundaries.ts` supplies a policy shared with generation, structured pre-generation review and post-normalization review. Both reviews use the configured provider/fallback with no tools and a 20-second ceiling per review. Since 2026-10-10 every stage (input review, generation, intent gate, USDA lookup, output review) receives min(its ceiling, time remaining) from one shared 180-second request deadline; generation reserves the output review, and an output review with under five seconds left fails by name as AI_BOUNDARY_TIMEOUT_OUTPUT instead of a generic timeout. A normal allowed request adds two generation operations (each may use the existing single fallback); a blocked request ends after its first review. Therefore the previous generation-provider note's two-attempt ceiling applies per operation, not per entire chat request. Telemetry records these provider calls through the existing operation tracking. Tool use/research remains limited to the main allowed generation.

A failed or malformed review returns a retryable error and no result, record or unreviewed draft. A policy rejection returns fixed copy and empty record/action fields. Both reviews must permit record proposals. Tool suggestions only open a workflow. Existing deterministic provenance/nutrition checks and user confirmation still apply; safety review does not validate medical accuracy or replace them. `CHAT_POLICY_VERSION` is part of the hosted request hash, preventing old-policy result replay without deleting user data.

Challenge review: input-only checks would miss an unsafe generated answer; output-only checks would make urgent users wait for full generation. Both are applied. All fields, image evidence and conversation history are reviewed as untrusted data; prior assistant errors and roleplay cannot grant exceptions. Cache replay was included as another output path. False-positive risk was checked with meal/activity capture and ambiguous domain words (cooking stock vs stocks, grocery budget vs investing).

Evidence: `.local-checks/chat-boundaries-red.log`, `chat-boundaries-final-unit.log`, `chat-boundaries-final-build.log`, `chat-boundaries-final-browser.log`; live classification corpus (18 cases), complete-provider results (6 cases), hosted account checks and production report. The initial activity over-rejection and its diagnostic trace are retained. Mock tests establish enforcement and UI state preservation; real-provider cases establish observed semantic behavior only for those fixtures. No universal jailbreak-resistance or clinical-validation claim is made.

Urgent handoff references: [NHS chest pain guidance](https://www.nhs.uk/conditions/chest-pain/) and [NIMH immediate help](https://www.nimh.nih.gov/health/find-help). Crisis copy distinguishes U.S. 988 from local services elsewhere; ordinary medical questions do not receive emergency language.

Managed CYC startup remains blocked by the existing source fingerprint size ceiling; direct project checks were used without weakening configuration. The prior phone help repair is already live; final deployment evidence for this extension is retained separately.
