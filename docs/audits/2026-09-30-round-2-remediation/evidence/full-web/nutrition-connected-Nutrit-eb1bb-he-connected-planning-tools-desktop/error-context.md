# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: nutrition-connected.spec.ts >> Nutrition excludes persisted example meals and opens the connected planning tools
- Location: tests\nutrition-connected.spec.ts:104:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('progressbar', { name: 'protein', exact: true })
Expected: "20"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" getByRole('progressbar', { name: 'protein', exact: true }) with timeout 5000ms
  - waiting for getByRole('progressbar', { name: 'protein', exact: true })

```

```yaml
- link "Skip to content":
  - /url: "#main"
- main:
  - region "Nutrition":
    - button "Open nutrition menu"
    - button "Rep & Plate home": Rep & Plate
    - button "Today’s nutrition in chat"
    - button "Your profile"
    - heading "Your day is coming together." [level=1]
    - paragraph: A clear picture of what fuels you.
    - paragraph:
      - text: You’re tracking without daily targets. Your recorded totals are shown below.
      - button "Set daily targets"
    - button "Previous day"
    - text: Today · Sep 30
    - button "Next day" [disabled]
    - button "Day" [pressed]
    - button "Week"
    - region "Today’s nutrition":
      - heading "Today’s nutrition" [level=2]
      - paragraph: Recorded calories · no daily target
      - button "View and edit today’s meals":
        - strong: "200"
        - text: cal recorded
      - text: Protein
      - strong: 20g
      - text: Carbs
      - strong: 15g
      - text: Fats
      - strong: 7g
      - text: From 1 meal you logged
      - button "Edit daily targets": Edit targets
    - button "Scan a food barcode":
      - strong: Have a label? Scan it.
      - text: Check the portion, then add it to your day.
    - region "Today's logged meals":
      - heading "What you’ve had" [level=2]
      - button "Log a meal"
      - button "Enter meal manually"
      - paragraph: Example meals are excluded from your totals and food log.
      - region "Breakfast meals":
        - heading "Breakfast" [level=3]
        - text: 200 cal
        - button "Edit My actual breakfast":
          - strong: My actual breakfast
          - text: 8:32 AM · Estimated 200 cal 20g protein 15g carbs 7g fat
    - heading "A little inspiration for later" [level=2]
    - paragraph: Make room for something you’ll enjoy.
    - button "MEALS AHEAD What sounds good for your next meal? Explore your meal plan":
      - text: MEALS AHEAD
      - strong: What sounds good for your next meal?
      - text: Explore your meal plan
    - heading "Your insights" [level=2]
    - button "See all"
    - 'button "1 meal across 1 logged day. Average recorded intake: 200 calories per logged day."':
      - strong: 1 meal across 1 logged day.
      - text: "Average recorded intake: 200 calories per logged day."
    - heading "Your food, organized" [level=2]
    - navigation "Food planning tools":
      - button "Pantry What you have":
        - strong: Pantry
        - text: What you have
      - button "Meal plan Your week":
        - strong: Meal plan
        - text: Your week
      - button "Recipes Meals & leftovers":
        - strong: Recipes
        - text: Meals & leftovers
    - heading "Smart swaps" [level=2]
    - text: Your foods. Your portions.
    - button "Compare foods in your pantry Add two foods with confirmed serving details to compare them here.":
      - strong: Compare foods in your pantry
      - text: Add two foods with confirmed serving details to compare them here.
    - navigation "Nutrition navigation":
      - button "Chat"
      - button "Nutrition"
      - button "Scan a barcode": Scan
      - button "Workouts"
      - button "Kitchen"
```

# Test source

```ts
  49  |               sources: [],
  50  |             },
  51  |           },
  52  |         }) + "\n",
  53  |     });
  54  |   });
  55  |   await blankMeals(page);
  56  |   await page
  57  |     .getByRole("textbox", { name: "Message Rep & Plate" })
  58  |     .fill("I ate a bowl of lentils for lunch.");
  59  |   await page.getByRole("button", { name: "Send message", exact: true }).click();
  60  |   await expect(
  61  |     page.getByRole("button", { name: "Yep, add to Lunch", exact: true }),
  62  |   ).toBeVisible();
  63  |   await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  64  |   await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
  65  |   await expect(
  66  |     page.getByRole("region", { name: "Today's logged meals" }),
  67  |   ).toContainText("Nothing here yet.");
  68  |   await page.getByRole("button", { name: "Tell Spot", exact: true }).click();
  69  |   expect(calls).toBe(1);
  70  |   await page.getByRole("button", { name: "Yep, add to Lunch", exact: true }).click();
  71  |   await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  72  |   const meal = page.getByRole("button", {
  73  |     name: "Edit Fixture lentil lunch",
  74  |     exact: true,
  75  |   });
  76  |   await expect(meal).toContainText("420 cal");
  77  |   await expect(meal).toContainText("24g protein");
  78  |   await expect(page.locator(".nutrition-ring-label strong")).toHaveText("420");
  79  |   await expect(page.getByRole("region", { name: "Lunch meals" })).toBeVisible();
  80  |   await meal.click();
  81  |   await page.getByLabel("Calories", { exact: true }).fill("450");
  82  |   await page.getByLabel("Protein (g)", { exact: true }).fill("27");
  83  |   await page.getByRole("button", { name: "Save changes", exact: true }).click();
  84  |   await expect(meal).toContainText("450 cal");
  85  |   await expect(page.locator(".nutrition-ring-label strong")).toHaveText("450");
  86  |   await expect(
  87  |     page.getByRole("progressbar", { name: "protein", exact: true }),
  88  |   ).toHaveAttribute("aria-valuenow", "27");
  89  |   await page.reload();
  90  |   await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  91  |   await expect(meal).toContainText("450 cal");
  92  |   expect(calls).toBe(1);
  93  |   expect(
  94  |     await page.evaluate(
  95  |       () => document.documentElement.scrollWidth <= window.innerWidth,
  96  |     ),
  97  |   ).toBe(true);
  98  |   if (testInfo.project.name === "mobile")
  99  |     await page.screenshot({
  100 |       path: testInfo.outputPath("nutrition-mobile.png"),
  101 |     });
  102 | });
  103 | 
  104 | test("Nutrition excludes persisted example meals and opens the connected planning tools", async ({
  105 |   page,
  106 | }) => {
  107 |   let calls = 0;
  108 |   await page.route("**/api/status", (route) =>
  109 |     route.fulfill({ json: { available: true, jev: true } }),
  110 |   );
  111 |   await page.route("**/api/chat", (route) => {
  112 |     calls++;
  113 |     return route.abort();
  114 |   });
  115 |   await page.goto("/");
  116 |   const samples = demoState();
  117 |   const sample = samples.meals[0];
  118 |   const real = {
  119 |     ...sample,
  120 |     id: "personal-nutrition",
  121 |     title: "My actual breakfast",
  122 |     source: "Your confirmed meal",
  123 |     example: false,
  124 |     calories: 200,
  125 |     protein: 20,
  126 |     carbs: 15,
  127 |     fat: 7,
  128 |   };
  129 |   await page.evaluate(
  130 |     ({ sample, real }) => {
  131 |       const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
  132 |       state.meals = [sample, real];
  133 |       localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  134 |     },
  135 |     { sample, real },
  136 |   );
  137 |   await commitSeededRecords(page);
  138 |   await page.reload();
  139 |   await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  140 |   await expect(
  141 |     page.getByRole("region", { name: "Today's logged meals" }),
  142 |   ).toContainText("My actual breakfast");
  143 |   await expect(
  144 |     page.getByRole("region", { name: "Today's logged meals" }),
  145 |   ).not.toContainText(sample.title);
  146 |   await expect(page.locator(".nutrition-ring-label strong")).toHaveText("200");
  147 |   await expect(
  148 |     page.getByRole("progressbar", { name: "protein", exact: true }),
> 149 |   ).toHaveAttribute("aria-valuenow", "20");
      |     ^ Error: expect(locator).toHaveAttribute(expected) failed
  150 |   expect(
  151 |     (await readBrowserRecords(page)).meals.length,
  152 |   ).toBe(2);
  153 |   const tools = page.getByRole("navigation", { name: "Food planning tools" });
  154 |   for (const [name, title] of [
  155 |     ["Pantry", "Your pantry"],
  156 |     ["Meal plan", "Your week of meals"],
  157 |     ["Recipes", "Recipes & leftovers"],
  158 |   ]) {
  159 |     await tools.getByRole("button", { name: new RegExp(name) }).click();
  160 |     await expect(
  161 |       page
  162 |         .getByRole("dialog")
  163 |         .getByRole("heading", { name: title, exact: true }),
  164 |     ).toBeVisible();
  165 |     await page
  166 |       .getByRole("button", { name: "Close dialog", exact: true })
  167 |       .click();
  168 |   }
  169 |   expect(calls).toBe(0);
  170 | });
  171 | 
```