# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows.spec.ts >> You reviews and goals update shared records and persist
- Location: tests\flows.spec.ts:395:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Your daily goals' })
Expected substring: "2,200"
Received string:    "Tracking without daily targets.Your reviews describe recorded meals without comparing them with a goal. You can set targets whenever you choose."
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByRole('region', { name: 'Your daily goals' }) with timeout 5000ms
  - waiting for getByRole('region', { name: 'Your daily goals' })
    14 × locator resolved to <section class="you-goals" aria-label="Your daily goals">…</section>
       - unexpected value "Tracking without daily targets.Your reviews describe recorded meals without comparing them with a goal. You can set targets whenever you choose."

```

```yaml
- region "Your daily goals":
  - strong: Tracking without daily targets.
  - paragraph: Your reviews describe recorded meals without comparing them with a goal. You can set targets whenever you choose.
```

# Test source

```ts
  338 |   await page.reload();
  339 |   expect((await stored(page)).workout.exercises[0].sets).toEqual([8, 8, 9]);
  340 |   await expect(page.locator(".fuel-inline-workout")).toContainText("9 reps");
  341 | });
  342 | 
  343 | test("uploaded image stays in chat and persists without guessed nutrition", async ({
  344 |   page,
  345 | }) => {
  346 |   await page
  347 |     .locator("input[type=file]")
  348 |     .first()
  349 |     .setInputFiles("public/images/bowl.jpg");
  350 |   await expect(
  351 |     page.getByRole("img", { name: "Your uploaded capture" }),
  352 |   ).toBeVisible();
  353 |   await page.getByRole("button", { name: "Save my image for review" }).click();
  354 |   await expect(
  355 |     page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  356 |   ).toBeVisible();
  357 |   await expect(
  358 |     page.getByRole("img", { name: "Your captured photo or screenshot" }),
  359 |   ).toBeVisible();
  360 |   expect((await stored(page)).meals).toHaveLength(0);
  361 |   await page.reload();
  362 |   const state = await stored(page);
  363 |   expect(state.reviews.at(-1).image).toMatch(/^data:image\/jpeg;base64,/);
  364 |   expect(state.meals).toHaveLength(0);
  365 | });
  366 | 
  367 | test("secondary screens return home to Chat and profile is keyboard accessible", async ({
  368 |   page,
  369 | }) => {
  370 |   await page
  371 |     .getByRole("navigation", { name: "Chat navigation" })
  372 |     .getByRole("button", { name: "Nutrition", exact: true })
  373 |     .click();
  374 |   await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
  375 |   const navName = "Nutrition navigation";
  376 |   await page
  377 |     .getByRole("navigation", { name: navName, exact: true })
  378 |     .getByRole("button", { name: "Chat", exact: true })
  379 |     .click();
  380 |   await page.getByRole("button", { name: "Your profile", exact: true }).click();
  381 |   await expect(
  382 |     page.getByRole("heading", { name: /^Looking ahead, / }),
  383 |   ).toBeVisible();
  384 |   await page
  385 |     .getByRole("button", { name: "Edit your profile", exact: true })
  386 |     .click();
  387 |   await expect(page.getByRole("dialog")).toBeVisible();
  388 |   await page.keyboard.press("Escape");
  389 |   await expect(page.getByRole("dialog")).toHaveCount(0);
  390 |   await expect(
  391 |     page.getByRole("button", { name: "Edit your profile", exact: true }),
  392 |   ).toBeFocused();
  393 | });
  394 | 
  395 | test("You reviews and goals update shared records and persist", async ({
  396 |   page,
  397 | }) => {
  398 |   await seedExamples(page);
  399 |   await page.getByRole("button", { name: "Your profile", exact: true }).click();
  400 |   await expect(page).toHaveURL(/#you$/);
  401 |   await expect(
  402 |     page.getByRole("button", { name: "Your profile", exact: true }),
  403 |   ).toHaveAttribute("aria-current", "page");
  404 |   await expect(
  405 |     page.getByText("2 little things to review", { exact: true }),
  406 |   ).toBeVisible();
  407 |   await page.getByRole("button", { name: "Chicken", exact: true }).click();
  408 |   await expect(
  409 |     page.getByText("1 little thing to review", { exact: true }),
  410 |   ).toBeVisible();
  411 |   await page.getByRole("button", { name: "About half", exact: true }).click();
  412 |   await expect(
  413 |     page.getByText("Nothing waiting on you.", { exact: true }),
  414 |   ).toBeVisible();
  415 |   const resolvedState = await stored(page);
  416 |   expect(
  417 |     resolvedState.reviews.filter((r: { resolved: boolean }) => r.resolved),
  418 |   ).toHaveLength(2);
  419 |   await page
  420 |     .getByRole("button", { name: "Completed · 2", exact: true })
  421 |     .click();
  422 |   await expect(page.getByRole("dialog")).toContainText("Chicken");
  423 |   await expect(page.getByRole("dialog")).toContainText("About half");
  424 |   await page.keyboard.press("Escape");
  425 |   await page.getByRole("button", { name: "Edit goals", exact: true }).click();
  426 |   await page.getByRole("textbox", { name: "Your first name" }).fill("Alex");
  427 |   await page
  428 |     .getByRole("spinbutton", { name: "Daily calories", exact: true })
  429 |     .fill("2200");
  430 |   await page.locator('input[name="targetsConfigured"]').check();
  431 |   await page
  432 |     .getByRole("button", { name: "Save preferences", exact: true })
  433 |     .click();
  434 |   await expect(
  435 |     page.getByRole("heading", { name: "Looking ahead, Alex.", exact: true }),
  436 |   ).toBeVisible();
  437 |   await expect(
> 438 |     page.getByRole("region", { name: "Your daily goals" }),
      |     ^ Error: expect(locator).toContainText(expected) failed
  439 |   ).toContainText("2,200");
  440 |   await page.reload();
  441 |   await expect(
  442 |     page.getByRole("heading", { name: "Looking ahead, Alex.", exact: true }),
  443 |   ).toBeVisible();
  444 |   expect((await stored(page)).meals).toHaveLength(resolvedState.meals.length);
  445 |   await page.getByRole("button", { name: /Your data & privacy/ }).click();
  446 |   await expect(page.getByRole("dialog")).toContainText(
  447 |     "Conflicting copies wait for your review.",
  448 |   );
  449 |   await page.keyboard.press("Escape");
  450 |   expect(
  451 |     await page.evaluate(
  452 |       () => document.documentElement.scrollWidth <= innerWidth,
  453 |     ),
  454 |   ).toBe(true);
  455 |   await page.goto("/#review");
  456 |   await expect(
  457 |     page.getByRole("navigation", { name: "You navigation" }),
  458 |   ).toBeVisible();
  459 |   await page
  460 |     .getByRole("button", { name: "Rep & Plate home", exact: true })
  461 |     .click();
  462 |   await expect(page).toHaveURL(/#chat$/);
  463 | });
  464 | 
  465 | test("You shows captured notes, editable meals, and real workout history", async ({
  466 |   page,
  467 | }) => {
  468 |   await seedExamples(page, true);
  469 |   await send(page, "A note about my walk today");
  470 |   await page.getByRole("button", { name: "Your profile", exact: true }).click();
  471 |   await page
  472 |     .getByRole("button", { name: "See all 3 reviews", exact: true })
  473 |     .click();
  474 |   await page
  475 |     .getByRole("button", { name: "Keep as a note", exact: true })
  476 |     .click();
  477 |   await page.getByRole("button", { name: /Meals & captures/ }).click();
  478 |   await expect(page.getByRole("dialog")).not.toContainText(
  479 |     "Avocado toast & eggs",
  480 |   );
  481 |   await expect(page.getByRole("dialog")).toContainText(
  482 |     "A note about my walk today",
  483 |   );
  484 |   await page
  485 |     .getByRole("button", {
  486 |       name: "Edit Grilled Chicken, Rice, Broccoli",
  487 |       exact: true,
  488 |     })
  489 |     .click();
  490 |   await expect(
  491 |     page.getByRole("textbox", { name: "Meal name", exact: true }),
  492 |   ).toHaveValue("Grilled Chicken, Rice, Broccoli");
  493 |   await page
  494 |     .getByRole("spinbutton", { name: "Calories", exact: true })
  495 |     .fill("620");
  496 |   await page.getByRole("button", { name: "Save changes", exact: true }).click();
  497 |   expect(
  498 |     (await stored(page)).meals.find(
  499 |       (m: { id: string }) => m.id === "chat-demo-dinner",
  500 |     ).calories,
  501 |   ).toBe(620);
  502 |   await page.getByRole("button", { name: /Workout history/ }).click();
  503 |   await expect(page.getByRole("dialog")).toContainText(
  504 |     "Your first session is ahead of you.",
  505 |   );
  506 |   await page
  507 |     .getByRole("button", { name: "Explore workouts", exact: true })
  508 |     .click();
  509 |   await page
  510 |     .getByRole("button", { name: "Start workout", exact: true })
  511 |     .click();
  512 |   await chooseLoad(page, "Bench Press", "45");
  513 |   await page
  514 |     .getByRole("button", { name: "Bench Press set 1: 8 reps", exact: true })
  515 |     .click();
  516 |   await page.getByRole("button", { name: "Your profile", exact: true }).click();
  517 |   await page.getByRole("button", { name: /Workout history/ }).click();
  518 |   await expect(page.getByRole("dialog")).toContainText("1 sets recorded");
  519 |   await expect(page.getByRole("dialog")).toContainText("In progress");
  520 |   await page
  521 |     .getByRole("button", { name: "Continue your workout", exact: true })
  522 |     .click();
  523 |   await expect(
  524 |     page.getByRole("heading", { name: "Upper Body in progress", exact: true }),
  525 |   ).toBeVisible();
  526 | });
  527 | 
  528 | test("nutrition uses personal evidence and opens pantry comparisons without sample claims", async ({
  529 |   page,
  530 | }) => {
  531 |   await page
  532 |     .getByRole("navigation", { name: "Chat navigation" })
  533 |     .getByRole("button", { name: "Nutrition", exact: true })
  534 |     .click();
  535 |   await expect(
  536 |     page.getByRole("heading", {
  537 |       name: "Your day is coming together.",
  538 |       exact: true,
```