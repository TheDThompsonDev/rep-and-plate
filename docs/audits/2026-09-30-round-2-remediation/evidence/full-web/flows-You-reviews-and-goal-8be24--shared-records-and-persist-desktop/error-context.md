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
  430 |   await page
  431 |     .getByRole("button", { name: "Save preferences", exact: true })
  432 |     .click();
  433 |   await expect(
  434 |     page.getByRole("heading", { name: "Looking ahead, Alex.", exact: true }),
  435 |   ).toBeVisible();
  436 |   await expect(
  437 |     page.getByRole("region", { name: "Your daily goals" }),
> 438 |   ).toContainText("2,200");
      |     ^ Error: expect(locator).toContainText(expected) failed
  439 |   await page.reload();
  440 |   await expect(
  441 |     page.getByRole("heading", { name: "Looking ahead, Alex.", exact: true }),
  442 |   ).toBeVisible();
  443 |   expect((await stored(page)).meals).toHaveLength(resolvedState.meals.length);
  444 |   await page.getByRole("button", { name: /Your data & privacy/ }).click();
  445 |   await expect(page.getByRole("dialog")).toContainText(
  446 |     "Conflicting copies wait for your review.",
  447 |   );
  448 |   await page.keyboard.press("Escape");
  449 |   expect(
  450 |     await page.evaluate(
  451 |       () => document.documentElement.scrollWidth <= innerWidth,
  452 |     ),
  453 |   ).toBe(true);
  454 |   await page.goto("/#review");
  455 |   await expect(
  456 |     page.getByRole("navigation", { name: "You navigation" }),
  457 |   ).toBeVisible();
  458 |   await page
  459 |     .getByRole("button", { name: "Rep & Plate home", exact: true })
  460 |     .click();
  461 |   await expect(page).toHaveURL(/#chat$/);
  462 | });
  463 | 
  464 | test("You shows captured notes, editable meals, and real workout history", async ({
  465 |   page,
  466 | }) => {
  467 |   await seedExamples(page, true);
  468 |   await send(page, "A note about my walk today");
  469 |   await page.getByRole("button", { name: "Your profile", exact: true }).click();
  470 |   await page
  471 |     .getByRole("button", { name: "See all 3 reviews", exact: true })
  472 |     .click();
  473 |   await page
  474 |     .getByRole("button", { name: "Keep as a note", exact: true })
  475 |     .click();
  476 |   await page.getByRole("button", { name: /Meals & captures/ }).click();
  477 |   await expect(page.getByRole("dialog")).not.toContainText(
  478 |     "Avocado toast & eggs",
  479 |   );
  480 |   await expect(page.getByRole("dialog")).toContainText(
  481 |     "A note about my walk today",
  482 |   );
  483 |   await page
  484 |     .getByRole("button", {
  485 |       name: "Edit Grilled Chicken, Rice, Broccoli",
  486 |       exact: true,
  487 |     })
  488 |     .click();
  489 |   await expect(
  490 |     page.getByRole("textbox", { name: "Meal name", exact: true }),
  491 |   ).toHaveValue("Grilled Chicken, Rice, Broccoli");
  492 |   await page
  493 |     .getByRole("spinbutton", { name: "Calories", exact: true })
  494 |     .fill("620");
  495 |   await page.getByRole("button", { name: "Save changes", exact: true }).click();
  496 |   expect(
  497 |     (await stored(page)).meals.find(
  498 |       (m: { id: string }) => m.id === "chat-demo-dinner",
  499 |     ).calories,
  500 |   ).toBe(620);
  501 |   await page.getByRole("button", { name: /Workout history/ }).click();
  502 |   await expect(page.getByRole("dialog")).toContainText(
  503 |     "Your first session is ahead of you.",
  504 |   );
  505 |   await page
  506 |     .getByRole("button", { name: "Explore workouts", exact: true })
  507 |     .click();
  508 |   await page
  509 |     .getByRole("button", { name: "Start workout", exact: true })
  510 |     .click();
  511 |   await chooseLoad(page, "Bench Press", "45");
  512 |   await page
  513 |     .getByRole("button", { name: "Bench Press set 1: 8 reps", exact: true })
  514 |     .click();
  515 |   await page.getByRole("button", { name: "Your profile", exact: true }).click();
  516 |   await page.getByRole("button", { name: /Workout history/ }).click();
  517 |   await expect(page.getByRole("dialog")).toContainText("1 sets recorded");
  518 |   await expect(page.getByRole("dialog")).toContainText("In progress");
  519 |   await page
  520 |     .getByRole("button", { name: "Continue your workout", exact: true })
  521 |     .click();
  522 |   await expect(
  523 |     page.getByRole("heading", { name: "Upper Body in progress", exact: true }),
  524 |   ).toBeVisible();
  525 | });
  526 | 
  527 | test("nutrition uses personal evidence and opens pantry comparisons without sample claims", async ({
  528 |   page,
  529 | }) => {
  530 |   await page
  531 |     .getByRole("navigation", { name: "Chat navigation" })
  532 |     .getByRole("button", { name: "Nutrition", exact: true })
  533 |     .click();
  534 |   await expect(
  535 |     page.getByRole("heading", {
  536 |       name: "Your day is coming together.",
  537 |       exact: true,
  538 |     }),
```