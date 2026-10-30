# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recurring-plans.spec.ts >> full-day generation sends selected meal types and reviews all 28 meals before saving
- Location: tests\recurring-plans.spec.ts:110:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -   0
+ Received  + 490

@@ -144,6 +144,496 @@
        },
      ],
      "id": "original-approved",
      "status": "approved",
    },
+   Object {
+     "createdAt": "2026-09-30T15:15:28.674Z",
+     "days": Array [
+       Object {
+         "date": "2026-09-25",
+         "meals": Array [
+           Object {
+             "category": "Breakfast",
+             "id": "full-0-Breakfast",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Breakfast oats 1",
+           },
+           Object {
+             "category": "Lunch",
+             "id": "full-0-Lunch",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Lunch oats 1",
+           },
+           Object {
+             "category": "Dinner",
+             "id": "full-0-Dinner",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Dinner oats 1",
+           },
+           Object {
+             "category": "Snack",
+             "id": "full-0-Snack",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Snack oats 1",
+           },
+         ],
+       },
+       Object {
+         "date": "2026-09-26",
+         "meals": Array [
+           Object {
+             "category": "Breakfast",
+             "id": "full-1-Breakfast",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Breakfast oats 2",
+           },
+           Object {
+             "category": "Lunch",
+             "id": "full-1-Lunch",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Lunch oats 2",
+           },
+           Object {
+             "category": "Dinner",
+             "id": "full-1-Dinner",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Dinner oats 2",
+           },
+           Object {
+             "category": "Snack",
+             "id": "full-1-Snack",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Snack oats 2",
+           },
+         ],
+       },
+       Object {
+         "date": "2026-09-27",
+         "meals": Array [
+           Object {
+             "category": "Breakfast",
+             "id": "full-2-Breakfast",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Breakfast oats 3",
+           },
+           Object {
+             "category": "Lunch",
+             "id": "full-2-Lunch",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Lunch oats 3",
+           },
+           Object {
+             "category": "Dinner",
+             "id": "full-2-Dinner",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Dinner oats 3",
+           },
+           Object {
+             "category": "Snack",
+             "id": "full-2-Snack",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Snack oats 3",
+           },
+         ],
+       },
+       Object {
+         "date": "2026-09-28",
+         "meals": Array [
+           Object {
+             "category": "Breakfast",
+             "id": "full-3-Breakfast",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Breakfast oats 4",
+           },
+           Object {
+             "category": "Lunch",
+             "id": "full-3-Lunch",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Lunch oats 4",
+           },
+           Object {
+             "category": "Dinner",
+             "id": "full-3-Dinner",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Dinner oats 4",
+           },
+           Object {
+             "category": "Snack",
+             "id": "full-3-Snack",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Snack oats 4",
+           },
+         ],
+       },
+       Object {
+         "date": "2026-09-29",
+         "meals": Array [
+           Object {
+             "category": "Breakfast",
+             "id": "full-4-Breakfast",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Breakfast oats 5",
+           },
+           Object {
+             "category": "Lunch",
+             "id": "full-4-Lunch",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Lunch oats 5",
+           },
+           Object {
+             "category": "Dinner",
+             "id": "full-4-Dinner",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Dinner oats 5",
+           },
+           Object {
+             "category": "Snack",
+             "id": "full-4-Snack",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Snack oats 5",
+           },
+         ],
+       },
+       Object {
+         "date": "2026-09-30",
+         "meals": Array [
+           Object {
+             "category": "Breakfast",
+             "id": "full-5-Breakfast",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Breakfast oats 6",
+           },
+           Object {
+             "category": "Lunch",
+             "id": "full-5-Lunch",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Lunch oats 6",
+           },
+           Object {
+             "category": "Dinner",
+             "id": "full-5-Dinner",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Dinner oats 6",
+           },
+           Object {
+             "category": "Snack",
+             "id": "full-5-Snack",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Snack oats 6",
+           },
+         ],
+       },
+       Object {
+         "date": "2026-10-01",
+         "meals": Array [
+           Object {
+             "category": "Breakfast",
+             "id": "full-6-Breakfast",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Breakfast oats 7",
+           },
+           Object {
+             "category": "Lunch",
+             "id": "full-6-Lunch",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Lunch oats 7",
+           },
+           Object {
+             "category": "Dinner",
+             "id": "full-6-Dinner",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Dinner oats 7",
+           },
+           Object {
+             "category": "Snack",
+             "id": "full-6-Snack",
+             "ingredients": Array [
+               Object {
+                 "lotId": "repeat-shop::oats",
+                 "name": "Oats",
+                 "servingLabel": "1/2 cup",
+                 "servings": 1,
+               },
+             ],
+             "minutes": 10,
+             "notes": "",
+             "portions": 1,
+             "title": "Snack oats 7",
+           },
+         ],
+       },
+     ],
+     "id": "full-day-draft",
+     "status": "draft",
+   },
  ]
```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - link "Skip to content" [ref=f1e5] [cursor=pointer]:
    - /url: "#main"
  - main [ref=f1e7]:
    - region "Rep & Plate chat home" [ref=f1e8]:
      - generic [ref=f1e9]:
        - button "Open chat menu" [ref=f1e10] [cursor=pointer]
        - button "Rep & Plate home" [ref=f1e12] [cursor=pointer]:
          - heading "Rep & Plate" [level=1] [ref=f1e13]
        - generic [ref=f1e15]:
          - button "Today’s nutrition in chat" [ref=f1e16] [cursor=pointer]
          - button "Your profile" [ref=f1e19] [cursor=pointer]
      - log "Capture conversation" [ref=f1e23]:
        - region "Tell Spot" [ref=f1e24]:
          - generic [ref=f1e25]:
            - text: YOUR FOOD. YOUR REPS. YOUR PACE.
            - heading "Always here." [level=2] [ref=f1e26]
            - paragraph [ref=f1e27]: (In a supportive way.)
            - text: Tell me what you ate or what you did.
            - generic [ref=f1e28]:
              - button "Tell Spot" [ref=f1e29] [cursor=pointer]
              - button "Another Spot mood" [ref=f1e32] [cursor=pointer]
        - generic [ref=f1e38]: Your conversation
      - generic [ref=f1e40]:
        - button "Scan a barcode in chat" [ref=f1e41] [cursor=pointer]
        - button "Take a meal photo" [ref=f1e47] [cursor=pointer]
        - button "Attach image or screenshot" [ref=f1e51] [cursor=pointer]
        - textbox "Message Rep & Plate" [ref=f1e56]:
          - /placeholder: What happened?
        - button "Use voice" [ref=f1e57] [cursor=pointer]
      - navigation "Chat navigation" [ref=f1e61]:
        - button "Chat" [ref=f1e62] [cursor=pointer]
        - button "Nutrition" [ref=f1e67] [cursor=pointer]
        - button "Scan a barcode" [ref=f1e71] [cursor=pointer]:
          - generic [ref=f1e78]: Scan
        - button "Workouts" [ref=f1e79] [cursor=pointer]
        - button "Kitchen" [ref=f1e87] [cursor=pointer]
  - dialog "Your week of meals" [ref=f1e93]:
    - generic [ref=f1e94]:
      - heading "Your week of meals" [level=2] [ref=f1e95]
      - button "Close dialog" [ref=f1e96] [cursor=pointer]
    - generic [ref=f1e100]:
      - paragraph [ref=f1e105]:
        - text: Start with what’s in your kitchen.
        - strong [ref=f1e106]: Make room for meals you enjoy.
      - paragraph [ref=f1e107]: A seven-day draft for 1 person. Review ingredients and portions before approving.
      - generic [ref=f1e108]:
        - text: Saved weeks
        - combobox "Saved meal-plan weeks" [ref=f1e109]:
          - option "2026-09-25 · Draft" [selected]
          - option "2026-09-25 · Approved"
        - generic [ref=f1e110]: Generated drafts and valid edits are saved automatically. Approval stays your choice.
      - generic [ref=f1e111]:
        - generic [ref=f1e112]:
          - text: Ingredients to use
          - combobox "Ingredients to use" [ref=f1e113]:
            - option "Include a shopping list" [selected]
            - option "Confirmed pantry only"
        - generic [ref=f1e114]:
          - text: Meal variety
          - combobox "Meal variety" [ref=f1e115]:
            - 'option "Variety: at least three ideas" [selected]'
            - option "Repeats are welcome"
      - paragraph [ref=f1e116]: Shopping-supported plans can add ingredients for variety. Pantry-only plans need confirmed quantities for the whole week.
      - group "Meals to plan each day" [ref=f1e117]:
        - generic [ref=f1e119]:
          - generic [ref=f1e120]:
            - checkbox "Breakfast" [checked] [ref=f1e121]
            - text: Breakfast
          - generic [ref=f1e122]:
            - checkbox "Lunch" [checked] [ref=f1e123]
            - text: Lunch
          - generic [ref=f1e124]:
            - checkbox "Dinner" [checked] [ref=f1e125]
            - text: Dinner
          - generic [ref=f1e126]:
            - checkbox "Snack" [checked] [ref=f1e127]
            - text: Snack
        - generic [ref=f1e128]: Choose at least one meal type. Each gets a place on all seven days.
      - generic [ref=f1e129]:
        - generic [ref=f1e130]:
          - text: Week starting
          - textbox "Week starting" [ref=f1e131]: 2026-09-25
        - button "Create a new draft" [ref=f1e132] [cursor=pointer]
      - generic [ref=f1e138]:
        - strong [ref=f1e139]: Draft to review
        - generic [ref=f1e140]: Drafts save automatically. Planning does not change your pantry or daily intake.
      - generic [ref=f1e141]:
        - button "Save draft now" [ref=f1e142] [cursor=pointer]
        - button "Approve reviewed plan" [ref=f1e143] [cursor=pointer]
      - generic [ref=f1e144]:
        - generic [ref=f1e145]:
          - heading "Friday, Sep 25" [level=3] [ref=f1e146]
          - article [ref=f1e147]:
            - heading "Breakfast oats 1" [level=4] [ref=f1e148]
            - paragraph [ref=f1e149]: Breakfast · 1 portion · 10 min
            - list [ref=f1e150]:
              - listitem [ref=f1e151]:
                - generic [ref=f1e152]:
                  - text: Oats
                  - generic [ref=f1e153]: 1/2 cup
                - strong [ref=f1e154]: 1 × 1/2 cup
            - paragraph [ref=f1e155]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e157] [cursor=pointer]
            - paragraph [ref=f1e158]: ~150 cal · 5g protein per portion
            - generic [ref=f1e159]:
              - button "Edit meal" [ref=f1e160] [cursor=pointer]
              - button "Swap meal" [ref=f1e161] [cursor=pointer]
          - article [ref=f1e162]:
            - heading "Lunch oats 1" [level=4] [ref=f1e163]
            - paragraph [ref=f1e164]: Lunch · 1 portion · 10 min
            - list [ref=f1e165]:
              - listitem [ref=f1e166]:
                - generic [ref=f1e167]:
                  - text: Oats
                  - generic [ref=f1e168]: 1/2 cup
                - strong [ref=f1e169]: 1 × 1/2 cup
            - paragraph [ref=f1e170]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e172] [cursor=pointer]
            - paragraph [ref=f1e173]: ~150 cal · 5g protein per portion
            - generic [ref=f1e174]:
              - button "Edit meal" [ref=f1e175] [cursor=pointer]
              - button "Swap meal" [ref=f1e176] [cursor=pointer]
          - article [ref=f1e177]:
            - heading "Dinner oats 1" [level=4] [ref=f1e178]
            - paragraph [ref=f1e179]: Dinner · 1 portion · 10 min
            - list [ref=f1e180]:
              - listitem [ref=f1e181]:
                - generic [ref=f1e182]:
                  - text: Oats
                  - generic [ref=f1e183]: 1/2 cup
                - strong [ref=f1e184]: 1 × 1/2 cup
            - paragraph [ref=f1e185]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e187] [cursor=pointer]
            - paragraph [ref=f1e188]: ~150 cal · 5g protein per portion
            - generic [ref=f1e189]:
              - button "Edit meal" [ref=f1e190] [cursor=pointer]
              - button "Swap meal" [ref=f1e191] [cursor=pointer]
          - article [ref=f1e192]:
            - heading "Snack oats 1" [level=4] [ref=f1e193]
            - paragraph [ref=f1e194]: Snack · 1 portion · 10 min
            - list [ref=f1e195]:
              - listitem [ref=f1e196]:
                - generic [ref=f1e197]:
                  - text: Oats
                  - generic [ref=f1e198]: 1/2 cup
                - strong [ref=f1e199]: 1 × 1/2 cup
            - paragraph [ref=f1e200]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e202] [cursor=pointer]
            - paragraph [ref=f1e203]: ~150 cal · 5g protein per portion
            - generic [ref=f1e204]:
              - button "Edit meal" [ref=f1e205] [cursor=pointer]
              - button "Swap meal" [ref=f1e206] [cursor=pointer]
        - generic [ref=f1e207]:
          - heading "Saturday, Sep 26" [level=3] [ref=f1e208]
          - article [ref=f1e209]:
            - heading "Breakfast oats 2" [level=4] [ref=f1e210]
            - paragraph [ref=f1e211]: Breakfast · 1 portion · 10 min
            - list [ref=f1e212]:
              - listitem [ref=f1e213]:
                - generic [ref=f1e214]:
                  - text: Oats
                  - generic [ref=f1e215]: 1/2 cup
                - strong [ref=f1e216]: 1 × 1/2 cup
            - paragraph [ref=f1e217]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e219] [cursor=pointer]
            - paragraph [ref=f1e220]: ~150 cal · 5g protein per portion
            - generic [ref=f1e221]:
              - button "Edit meal" [ref=f1e222] [cursor=pointer]
              - button "Swap meal" [ref=f1e223] [cursor=pointer]
          - article [ref=f1e224]:
            - heading "Lunch oats 2" [level=4] [ref=f1e225]
            - paragraph [ref=f1e226]: Lunch · 1 portion · 10 min
            - list [ref=f1e227]:
              - listitem [ref=f1e228]:
                - generic [ref=f1e229]:
                  - text: Oats
                  - generic [ref=f1e230]: 1/2 cup
                - strong [ref=f1e231]: 1 × 1/2 cup
            - paragraph [ref=f1e232]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e234] [cursor=pointer]
            - paragraph [ref=f1e235]: ~150 cal · 5g protein per portion
            - generic [ref=f1e236]:
              - button "Edit meal" [ref=f1e237] [cursor=pointer]
              - button "Swap meal" [ref=f1e238] [cursor=pointer]
          - article [ref=f1e239]:
            - heading "Dinner oats 2" [level=4] [ref=f1e240]
            - paragraph [ref=f1e241]: Dinner · 1 portion · 10 min
            - list [ref=f1e242]:
              - listitem [ref=f1e243]:
                - generic [ref=f1e244]:
                  - text: Oats
                  - generic [ref=f1e245]: 1/2 cup
                - strong [ref=f1e246]: 1 × 1/2 cup
            - paragraph [ref=f1e247]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e249] [cursor=pointer]
            - paragraph [ref=f1e250]: ~150 cal · 5g protein per portion
            - generic [ref=f1e251]:
              - button "Edit meal" [ref=f1e252] [cursor=pointer]
              - button "Swap meal" [ref=f1e253] [cursor=pointer]
          - article [ref=f1e254]:
            - heading "Snack oats 2" [level=4] [ref=f1e255]
            - paragraph [ref=f1e256]: Snack · 1 portion · 10 min
            - list [ref=f1e257]:
              - listitem [ref=f1e258]:
                - generic [ref=f1e259]:
                  - text: Oats
                  - generic [ref=f1e260]: 1/2 cup
                - strong [ref=f1e261]: 1 × 1/2 cup
            - paragraph [ref=f1e262]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e264] [cursor=pointer]
            - paragraph [ref=f1e265]: ~150 cal · 5g protein per portion
            - generic [ref=f1e266]:
              - button "Edit meal" [ref=f1e267] [cursor=pointer]
              - button "Swap meal" [ref=f1e268] [cursor=pointer]
        - generic [ref=f1e269]:
          - heading "Sunday, Sep 27" [level=3] [ref=f1e270]
          - article [ref=f1e271]:
            - heading "Breakfast oats 3" [level=4] [ref=f1e272]
            - paragraph [ref=f1e273]: Breakfast · 1 portion · 10 min
            - list [ref=f1e274]:
              - listitem [ref=f1e275]:
                - generic [ref=f1e276]:
                  - text: Oats
                  - generic [ref=f1e277]: 1/2 cup
                - strong [ref=f1e278]: 1 × 1/2 cup
            - paragraph [ref=f1e279]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e281] [cursor=pointer]
            - paragraph [ref=f1e282]: ~150 cal · 5g protein per portion
            - generic [ref=f1e283]:
              - button "Edit meal" [ref=f1e284] [cursor=pointer]
              - button "Swap meal" [ref=f1e285] [cursor=pointer]
          - article [ref=f1e286]:
            - heading "Lunch oats 3" [level=4] [ref=f1e287]
            - paragraph [ref=f1e288]: Lunch · 1 portion · 10 min
            - list [ref=f1e289]:
              - listitem [ref=f1e290]:
                - generic [ref=f1e291]:
                  - text: Oats
                  - generic [ref=f1e292]: 1/2 cup
                - strong [ref=f1e293]: 1 × 1/2 cup
            - paragraph [ref=f1e294]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e296] [cursor=pointer]
            - paragraph [ref=f1e297]: ~150 cal · 5g protein per portion
            - generic [ref=f1e298]:
              - button "Edit meal" [ref=f1e299] [cursor=pointer]
              - button "Swap meal" [ref=f1e300] [cursor=pointer]
          - article [ref=f1e301]:
            - heading "Dinner oats 3" [level=4] [ref=f1e302]
            - paragraph [ref=f1e303]: Dinner · 1 portion · 10 min
            - list [ref=f1e304]:
              - listitem [ref=f1e305]:
                - generic [ref=f1e306]:
                  - text: Oats
                  - generic [ref=f1e307]: 1/2 cup
                - strong [ref=f1e308]: 1 × 1/2 cup
            - paragraph [ref=f1e309]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e311] [cursor=pointer]
            - paragraph [ref=f1e312]: ~150 cal · 5g protein per portion
            - generic [ref=f1e313]:
              - button "Edit meal" [ref=f1e314] [cursor=pointer]
              - button "Swap meal" [ref=f1e315] [cursor=pointer]
          - article [ref=f1e316]:
            - heading "Snack oats 3" [level=4] [ref=f1e317]
            - paragraph [ref=f1e318]: Snack · 1 portion · 10 min
            - list [ref=f1e319]:
              - listitem [ref=f1e320]:
                - generic [ref=f1e321]:
                  - text: Oats
                  - generic [ref=f1e322]: 1/2 cup
                - strong [ref=f1e323]: 1 × 1/2 cup
            - paragraph [ref=f1e324]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e326] [cursor=pointer]
            - paragraph [ref=f1e327]: ~150 cal · 5g protein per portion
            - generic [ref=f1e328]:
              - button "Edit meal" [ref=f1e329] [cursor=pointer]
              - button "Swap meal" [ref=f1e330] [cursor=pointer]
        - generic [ref=f1e331]:
          - heading "Monday, Sep 28" [level=3] [ref=f1e332]
          - article [ref=f1e333]:
            - heading "Breakfast oats 4" [level=4] [ref=f1e334]
            - paragraph [ref=f1e335]: Breakfast · 1 portion · 10 min
            - list [ref=f1e336]:
              - listitem [ref=f1e337]:
                - generic [ref=f1e338]:
                  - text: Oats
                  - generic [ref=f1e339]: 1/2 cup
                - strong [ref=f1e340]: 1 × 1/2 cup
            - paragraph [ref=f1e341]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e343] [cursor=pointer]
            - paragraph [ref=f1e344]: ~150 cal · 5g protein per portion
            - generic [ref=f1e345]:
              - button "Edit meal" [ref=f1e346] [cursor=pointer]
              - button "Swap meal" [ref=f1e347] [cursor=pointer]
          - article [ref=f1e348]:
            - heading "Lunch oats 4" [level=4] [ref=f1e349]
            - paragraph [ref=f1e350]: Lunch · 1 portion · 10 min
            - list [ref=f1e351]:
              - listitem [ref=f1e352]:
                - generic [ref=f1e353]:
                  - text: Oats
                  - generic [ref=f1e354]: 1/2 cup
                - strong [ref=f1e355]: 1 × 1/2 cup
            - paragraph [ref=f1e356]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e358] [cursor=pointer]
            - paragraph [ref=f1e359]: ~150 cal · 5g protein per portion
            - generic [ref=f1e360]:
              - button "Edit meal" [ref=f1e361] [cursor=pointer]
              - button "Swap meal" [ref=f1e362] [cursor=pointer]
          - article [ref=f1e363]:
            - heading "Dinner oats 4" [level=4] [ref=f1e364]
            - paragraph [ref=f1e365]: Dinner · 1 portion · 10 min
            - list [ref=f1e366]:
              - listitem [ref=f1e367]:
                - generic [ref=f1e368]:
                  - text: Oats
                  - generic [ref=f1e369]: 1/2 cup
                - strong [ref=f1e370]: 1 × 1/2 cup
            - paragraph [ref=f1e371]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e373] [cursor=pointer]
            - paragraph [ref=f1e374]: ~150 cal · 5g protein per portion
            - generic [ref=f1e375]:
              - button "Edit meal" [ref=f1e376] [cursor=pointer]
              - button "Swap meal" [ref=f1e377] [cursor=pointer]
          - article [ref=f1e378]:
            - heading "Snack oats 4" [level=4] [ref=f1e379]
            - paragraph [ref=f1e380]: Snack · 1 portion · 10 min
            - list [ref=f1e381]:
              - listitem [ref=f1e382]:
                - generic [ref=f1e383]:
                  - text: Oats
                  - generic [ref=f1e384]: 1/2 cup
                - strong [ref=f1e385]: 1 × 1/2 cup
            - paragraph [ref=f1e386]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e388] [cursor=pointer]
            - paragraph [ref=f1e389]: ~150 cal · 5g protein per portion
            - generic [ref=f1e390]:
              - button "Edit meal" [ref=f1e391] [cursor=pointer]
              - button "Swap meal" [ref=f1e392] [cursor=pointer]
        - generic [ref=f1e393]:
          - heading "Tuesday, Sep 29" [level=3] [ref=f1e394]
          - article [ref=f1e395]:
            - heading "Breakfast oats 5" [level=4] [ref=f1e396]
            - paragraph [ref=f1e397]: Breakfast · 1 portion · 10 min
            - list [ref=f1e398]:
              - listitem [ref=f1e399]:
                - generic [ref=f1e400]:
                  - text: Oats
                  - generic [ref=f1e401]: 1/2 cup
                - strong [ref=f1e402]: 1 × 1/2 cup
            - paragraph [ref=f1e403]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e405] [cursor=pointer]
            - paragraph [ref=f1e406]: ~150 cal · 5g protein per portion
            - generic [ref=f1e407]:
              - button "Edit meal" [ref=f1e408] [cursor=pointer]
              - button "Swap meal" [ref=f1e409] [cursor=pointer]
          - article [ref=f1e410]:
            - heading "Lunch oats 5" [level=4] [ref=f1e411]
            - paragraph [ref=f1e412]: Lunch · 1 portion · 10 min
            - list [ref=f1e413]:
              - listitem [ref=f1e414]:
                - generic [ref=f1e415]:
                  - text: Oats
                  - generic [ref=f1e416]: 1/2 cup
                - strong [ref=f1e417]: 1 × 1/2 cup
            - paragraph [ref=f1e418]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e420] [cursor=pointer]
            - paragraph [ref=f1e421]: ~150 cal · 5g protein per portion
            - generic [ref=f1e422]:
              - button "Edit meal" [ref=f1e423] [cursor=pointer]
              - button "Swap meal" [ref=f1e424] [cursor=pointer]
          - article [ref=f1e425]:
            - heading "Dinner oats 5" [level=4] [ref=f1e426]
            - paragraph [ref=f1e427]: Dinner · 1 portion · 10 min
            - list [ref=f1e428]:
              - listitem [ref=f1e429]:
                - generic [ref=f1e430]:
                  - text: Oats
                  - generic [ref=f1e431]: 1/2 cup
                - strong [ref=f1e432]: 1 × 1/2 cup
            - paragraph [ref=f1e433]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e435] [cursor=pointer]
            - paragraph [ref=f1e436]: ~150 cal · 5g protein per portion
            - generic [ref=f1e437]:
              - button "Edit meal" [ref=f1e438] [cursor=pointer]
              - button "Swap meal" [ref=f1e439] [cursor=pointer]
          - article [ref=f1e440]:
            - heading "Snack oats 5" [level=4] [ref=f1e441]
            - paragraph [ref=f1e442]: Snack · 1 portion · 10 min
            - list [ref=f1e443]:
              - listitem [ref=f1e444]:
                - generic [ref=f1e445]:
                  - text: Oats
                  - generic [ref=f1e446]: 1/2 cup
                - strong [ref=f1e447]: 1 × 1/2 cup
            - paragraph [ref=f1e448]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e450] [cursor=pointer]
            - paragraph [ref=f1e451]: ~150 cal · 5g protein per portion
            - generic [ref=f1e452]:
              - button "Edit meal" [ref=f1e453] [cursor=pointer]
              - button "Swap meal" [ref=f1e454] [cursor=pointer]
        - generic [ref=f1e455]:
          - heading "Wednesday, Sep 30" [level=3] [ref=f1e456]
          - article [ref=f1e457]:
            - heading "Breakfast oats 6" [level=4] [ref=f1e458]
            - paragraph [ref=f1e459]: Breakfast · 1 portion · 10 min
            - list [ref=f1e460]:
              - listitem [ref=f1e461]:
                - generic [ref=f1e462]:
                  - text: Oats
                  - generic [ref=f1e463]: 1/2 cup
                - strong [ref=f1e464]: 1 × 1/2 cup
            - paragraph [ref=f1e465]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e467] [cursor=pointer]
            - paragraph [ref=f1e468]: ~150 cal · 5g protein per portion
            - generic [ref=f1e469]:
              - button "Edit meal" [ref=f1e470] [cursor=pointer]
              - button "Swap meal" [ref=f1e471] [cursor=pointer]
          - article [ref=f1e472]:
            - heading "Lunch oats 6" [level=4] [ref=f1e473]
            - paragraph [ref=f1e474]: Lunch · 1 portion · 10 min
            - list [ref=f1e475]:
              - listitem [ref=f1e476]:
                - generic [ref=f1e477]:
                  - text: Oats
                  - generic [ref=f1e478]: 1/2 cup
                - strong [ref=f1e479]: 1 × 1/2 cup
            - paragraph [ref=f1e480]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e482] [cursor=pointer]
            - paragraph [ref=f1e483]: ~150 cal · 5g protein per portion
            - generic [ref=f1e484]:
              - button "Edit meal" [ref=f1e485] [cursor=pointer]
              - button "Swap meal" [ref=f1e486] [cursor=pointer]
          - article [ref=f1e487]:
            - heading "Dinner oats 6" [level=4] [ref=f1e488]
            - paragraph [ref=f1e489]: Dinner · 1 portion · 10 min
            - list [ref=f1e490]:
              - listitem [ref=f1e491]:
                - generic [ref=f1e492]:
                  - text: Oats
                  - generic [ref=f1e493]: 1/2 cup
                - strong [ref=f1e494]: 1 × 1/2 cup
            - paragraph [ref=f1e495]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e497] [cursor=pointer]
            - paragraph [ref=f1e498]: ~150 cal · 5g protein per portion
            - generic [ref=f1e499]:
              - button "Edit meal" [ref=f1e500] [cursor=pointer]
              - button "Swap meal" [ref=f1e501] [cursor=pointer]
          - article [ref=f1e502]:
            - heading "Snack oats 6" [level=4] [ref=f1e503]
            - paragraph [ref=f1e504]: Snack · 1 portion · 10 min
            - list [ref=f1e505]:
              - listitem [ref=f1e506]:
                - generic [ref=f1e507]:
                  - text: Oats
                  - generic [ref=f1e508]: 1/2 cup
                - strong [ref=f1e509]: 1 × 1/2 cup
            - paragraph [ref=f1e510]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e512] [cursor=pointer]
            - paragraph [ref=f1e513]: ~150 cal · 5g protein per portion
            - generic [ref=f1e514]:
              - button "Edit meal" [ref=f1e515] [cursor=pointer]
              - button "Swap meal" [ref=f1e516] [cursor=pointer]
        - generic [ref=f1e517]:
          - heading "Thursday, Oct 1" [level=3] [ref=f1e518]
          - article [ref=f1e519]:
            - heading "Breakfast oats 7" [level=4] [ref=f1e520]
            - paragraph [ref=f1e521]: Breakfast · 1 portion · 10 min
            - list [ref=f1e522]:
              - listitem [ref=f1e523]:
                - generic [ref=f1e524]:
                  - text: Oats
                  - generic [ref=f1e525]: 1/2 cup
                - strong [ref=f1e526]: 1 × 1/2 cup
            - paragraph [ref=f1e527]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e529] [cursor=pointer]
            - paragraph [ref=f1e530]: ~150 cal · 5g protein per portion
            - generic [ref=f1e531]:
              - button "Edit meal" [ref=f1e532] [cursor=pointer]
              - button "Swap meal" [ref=f1e533] [cursor=pointer]
          - article [ref=f1e534]:
            - heading "Lunch oats 7" [level=4] [ref=f1e535]
            - paragraph [ref=f1e536]: Lunch · 1 portion · 10 min
            - list [ref=f1e537]:
              - listitem [ref=f1e538]:
                - generic [ref=f1e539]:
                  - text: Oats
                  - generic [ref=f1e540]: 1/2 cup
                - strong [ref=f1e541]: 1 × 1/2 cup
            - paragraph [ref=f1e542]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e544] [cursor=pointer]
            - paragraph [ref=f1e545]: ~150 cal · 5g protein per portion
            - generic [ref=f1e546]:
              - button "Edit meal" [ref=f1e547] [cursor=pointer]
              - button "Swap meal" [ref=f1e548] [cursor=pointer]
          - article [ref=f1e549]:
            - heading "Dinner oats 7" [level=4] [ref=f1e550]
            - paragraph [ref=f1e551]: Dinner · 1 portion · 10 min
            - list [ref=f1e552]:
              - listitem [ref=f1e553]:
                - generic [ref=f1e554]:
                  - text: Oats
                  - generic [ref=f1e555]: 1/2 cup
                - strong [ref=f1e556]: 1 × 1/2 cup
            - paragraph [ref=f1e557]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e559] [cursor=pointer]
            - paragraph [ref=f1e560]: ~150 cal · 5g protein per portion
            - generic [ref=f1e561]:
              - button "Edit meal" [ref=f1e562] [cursor=pointer]
              - button "Swap meal" [ref=f1e563] [cursor=pointer]
          - article [ref=f1e564]:
            - heading "Snack oats 7" [level=4] [ref=f1e565]
            - paragraph [ref=f1e566]: Snack · 1 portion · 10 min
            - list [ref=f1e567]:
              - listitem [ref=f1e568]:
                - generic [ref=f1e569]:
                  - text: Oats
                  - generic [ref=f1e570]: 1/2 cup
                - strong [ref=f1e571]: 1 × 1/2 cup
            - paragraph [ref=f1e572]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e574] [cursor=pointer]
            - paragraph [ref=f1e575]: ~150 cal · 5g protein per portion
            - generic [ref=f1e576]:
              - button "Edit meal" [ref=f1e577] [cursor=pointer]
              - button "Swap meal" [ref=f1e578] [cursor=pointer]
      - generic [ref=f1e579]:
        - heading "Your shopping & pantry check" [level=3] [ref=f1e580]
        - paragraph [ref=f1e587]: Amounts below account for every meal in the week, including repeat ingredients.
        - list [ref=f1e588]:
          - listitem [ref=f1e589]:
            - strong [ref=f1e590]: Oats
            - generic [ref=f1e591]: 25 additional servings · 1/2 cup
      - region "Basket cost coverage" [ref=f1e592]:
        - heading "What might the remaining ingredients cost?" [level=3] [ref=f1e593]
        - paragraph [ref=f1e594]: No priced additional quantities yet.
        - paragraph [ref=f1e595]: 0 of 1 ingredients covered by pantry stock; 0 additional ingredients priced; 1 need a price or quantity check.
        - text: Based on reviewed receipt prices from the last 30 days. Shelf prices, full packages, tax and other groceries can change the checkout total.
      - generic [ref=f1e596]:
        - button "Save draft" [ref=f1e597] [cursor=pointer]
        - button "Approve this plan" [ref=f1e598] [cursor=pointer]
      - paragraph [ref=f1e599]: Approval saves the plan. Log a portion only after eating it. Check package ingredients for your restrictions; recipe suggestions cannot verify allergen handling.
      - generic [ref=f1e600]:
        - heading "Make the most of your groceries" [level=3] [ref=f1e601]
        - article [ref=f1e602]:
          - strong [ref=f1e603]: Oats
          - paragraph [ref=f1e604]: 3 labeled servings remain from your 2026-09-25 purchase.
          - generic [ref=f1e605]:
            - button "Find a meal idea" [ref=f1e606] [cursor=pointer]
            - button "Dismiss for now" [ref=f1e607] [cursor=pointer]
        - paragraph [ref=f1e608]: Purchase dates help organize ideas. They do not tell us whether food is fresh or spoiled.
```

# Test source

```ts
  29  |   await page.getByLabel('Repeat week starting',{exact:true}).fill('2026-10-02');
  30  |   await page.getByRole('button',{name:'Repeat this week as a draft',exact:true}).click();
  31  |   await expect(page.locator('.fuel-plan-status')).toContainText('Draft to review');
  32  |   await expect(page.getByRole('button',{name:'Log one portion',exact:true})).toHaveCount(0);
  33  |   await expect(page.locator('.fuel-plan-shopping')).toContainText('4 additional servings');
  34  |   // Repeated drafts now save automatically; the original approved week stays byte-equivalent.
  35  |   await expect.poll(async()=>(await stored(page)).mealPlans.length).toBe(2);
  36  |   expect((await stored(page)).mealPlans[0]).toEqual(original);
  37  |   expect((await stored(page)).mealPlans[1].status).toBe('draft');
  38  |   expect((await stored(page)).meals).toEqual(before.meals);
  39  |   expect((await stored(page)).pantryEvents).toEqual(before.pantryEvents);
  40  |   await page.getByRole('button',{name:'Save draft',exact:true}).click();
  41  |   await expect.poll(async()=>(await stored(page)).mealPlans.length).toBe(2);
  42  |   let saved=await stored(page);
  43  |   expect(saved.mealPlans).toHaveLength(2);expect(saved.mealPlans[0]).toEqual(original);
  44  |   const repeatedId=saved.mealPlans[1].id;expect(repeatedId).not.toBe(original.id);
  45  |   expect(saved.mealPlans[1].days[0].date).toBe('2026-10-02');
  46  |   expect(saved.mealPlans[1].days[0].meals[0].id).not.toBe(original.days[0].meals[0].id);
  47  |   await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  48  |   await page.getByLabel('Meal name',{exact:true}).fill('Morning oats');
  49  |   await page.getByLabel('Meal type',{exact:true}).selectOption('Breakfast');
  50  |   await page.getByLabel('Recipe portions',{exact:true}).fill('2');
  51  |   await page.getByLabel('Meal day',{exact:true}).selectOption('2026-10-03');
  52  |   await expect(page.locator('.fuel-plan-day').first()).toContainText('Nothing planned for this day yet');
  53  |   await page.getByRole('button',{name:'Done editing',exact:true}).click();
  54  |   await page.getByRole('button',{name:'Approve this plan',exact:true}).click();
  55  |   saved=await stored(page);
  56  |   expect(saved.mealPlans).toHaveLength(2);expect(saved.mealPlans[0]).toEqual(original);
  57  |   const repeated=saved.mealPlans.find((plan:any)=>plan.id===repeatedId);
  58  |   expect(repeated.status).toBe('approved');expect(repeated.days[0].meals).toEqual([]);
  59  |   expect(repeated.days[1].meals.find((meal:any)=>meal.title==='Morning oats')).toMatchObject({category:'Breakfast',portions:2});
  60  |   expect(saved.meals).toEqual(before.meals);expect(saved.pantryEvents).toEqual(before.pantryEvents);
  61  |   await page.reload();await openPlan(page);
  62  |   const meal=page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Morning oats',exact:true})});
  63  |   await expect(meal).toContainText('Breakfast · 2 portions');
  64  |   await expect(meal).toContainText('75 cal');
  65  |   await meal.getByRole('button',{name:'Log one portion',exact:true}).click();
  66  |   let after=await stored(page);expect(after.meals.at(-1)).toMatchObject({title:'Morning oats',category:'Breakfast',calories:75});
  67  |   expect(after.pantryEvents.filter((event:any)=>event.kind==='consumed')).toHaveLength(1);
  68  |   expect(after.meals.at(-1).id).toContain(repeatedId);
  69  |   // Selecting the older approved week must use that week's identity, not the newest saved plan.
  70  |   await page.getByLabel('Saved meal-plan weeks').selectOption('original-approved');
  71  |   await page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Oatmeal 1',exact:true})}).getByRole('button',{name:'Log one portion',exact:true}).click();
  72  |   after=await stored(page);expect(after.meals.at(-1).id).toContain('original-approved');
  73  |   expect(after.meals.at(-1).category).toBe('Dinner');
  74  |   expect(after.meals).toHaveLength(before.meals.length+2);expect(generated).toBe(0);
  75  |   await page.reload();await openPlan(page);
  76  |   await expect(page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Morning oats',exact:true})}).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  77  |   await page.getByLabel('Saved meal-plan weeks').selectOption('original-approved');
  78  |   await expect(page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Oatmeal 1',exact:true})}).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  79  |   const replayed=await stored(page);
  80  |   expect(replayed.meals).toEqual(after.meals);
  81  |   expect(replayed.pantryEvents).toEqual(after.pantryEvents);
  82  |   expect(replayed.mealPlans.find((plan:any)=>plan.id==='original-approved')).toEqual(original);
  83  | });
  84  | 
  85  | test('editing or extending an approved week creates a new revision and preserves existing identities',async({page})=>{
  86  |   await seedWeek(page);const before=await stored(page);await openPlan(page);
  87  |   await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  88  |   await expect(page.locator('.fuel-plan-status')).toContainText('Draft to review');
  89  |   await page.getByLabel('Meal name',{exact:true}).fill('Lunch oats');
  90  |   await page.getByLabel('Meal type',{exact:true}).selectOption('Lunch');
  91  |   await page.getByRole('button',{name:'Done editing',exact:true}).click();
  92  |   await page.getByRole('button',{name:'Add a meal to this day',exact:true}).first().click();
  93  |   const copySelect=page.getByLabel('Meal to copy to 2026-09-25');
  94  |   await copySelect.selectOption({label:'Lunch · Lunch oats'});
  95  |   await page.getByLabel('Meal name',{exact:true}).fill('Snack oats');
  96  |   await page.getByLabel('Meal type',{exact:true}).selectOption('Snack');
  97  |   await page.getByRole('button',{name:'Done editing',exact:true}).click();
  98  |   await page.getByRole('button',{name:'Save draft',exact:true}).click();
  99  |   const after=await stored(page);expect(after.mealPlans).toHaveLength(2);
  100 |   expect(after.mealPlans[0]).toEqual(before.mealPlans[0]);
  101 |   const revised=after.mealPlans[1];expect(revised.id).not.toBe(before.mealPlans[0].id);
  102 |   expect(revised.days[0].meals.map((meal:any)=>meal.category)).toEqual(['Lunch','Snack']);
  103 |   expect(revised.days[0].meals.map((meal:any)=>meal.id)).not.toContain('original-0');
  104 |   expect(new Set(revised.days.flatMap((day:any)=>day.meals.map((meal:any)=>meal.id))).size).toBe(8);
  105 |   expect(after.meals).toEqual(before.meals);expect(after.pantryEvents).toEqual(before.pantryEvents);
  106 |   await expect(page.getByRole('button',{name:'Log one portion',exact:true})).toHaveCount(0);
  107 |   expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  108 | });
  109 | 
  110 | test('full-day generation sends selected meal types and reviews all 28 meals before saving',async({page})=>{
  111 |   let context:any;
  112 |   await page.route('**/api/plans/meals',route=>{
  113 |     context=route.request().postDataJSON();
  114 |     const start=new Date(context.startDate+'T12:00:00Z');
  115 |     return route.fulfill({json:{id:'full-day-draft',status:'draft',createdAt:new Date().toISOString(),days:Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:context.mealCategories.map((category:string)=>({id:`full-${index}-${category}`,title:`${category} oats ${index+1}`,category,portions:1,minutes:10,ingredients:[{lotId:'repeat-shop::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:''}))};})}});
  116 |   });
  117 |   await seedWeek(page);const before=await stored(page);await openPlan(page);
  118 |   await expect(page.getByRole('checkbox',{name:'Dinner',exact:true})).toBeChecked();
  119 |   await expect(page.getByRole('checkbox',{name:'Breakfast',exact:true})).not.toBeChecked();
  120 |   await page.getByRole('checkbox',{name:'Breakfast',exact:true}).check();
  121 |   await page.getByRole('checkbox',{name:'Lunch',exact:true}).check();
  122 |   await page.getByRole('checkbox',{name:'Snack',exact:true}).check();
  123 |   await page.getByRole('button',{name:'Create a new draft',exact:true}).click();
  124 |   await expect(page.locator('.fuel-planned-meal')).toHaveCount(28);
  125 |   expect(context.mealCategories).toEqual(['Breakfast','Lunch','Dinner','Snack']);
  126 |   const firstDay=page.locator('.fuel-plan-day').first();
  127 |   for(const category of ['Breakfast','Lunch','Dinner','Snack'])await expect(firstDay).toContainText(`${category} · 1 portion`);
  128 |   await expect(page.locator('.fuel-plan-shopping')).toContainText('25 additional servings');
> 129 |   expect((await stored(page)).mealPlans).toEqual(before.mealPlans);
      |                                          ^ Error: expect(received).toEqual(expected) // deep equality
  130 |   expect((await stored(page)).meals).toEqual(before.meals);
  131 |   expect((await stored(page)).pantryEvents).toEqual(before.pantryEvents);
  132 |   await page.getByRole('button',{name:'Save draft',exact:true}).click();
  133 |   expect((await stored(page)).mealPlans.at(-1).days.flatMap((day:any)=>day.meals)).toHaveLength(28);
  134 | });
  135 | 
  136 | 
  137 | test('oversized planned portions fail visibly without crashing or changing intake',async({page})=>{
  138 |   await seedWeek(page);
  139 |   await page.evaluate(()=>{
  140 |     const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
  141 |     state.groceries[0].items[0].servingsPurchased=1000;
  142 |     state.pantryEvents=[];
  143 |     state.mealPlans[0].days[0].meals[0].ingredients[0].servings=200;
  144 |     localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  145 |   });
  146 |   await commitSeededRecords(page);
  147 |   await page.reload();const before=await stored(page);await openPlan(page);
  148 |   const first=page.locator('.fuel-planned-meal').first();
  149 |   await first.getByRole('button',{name:'Log one portion',exact:true}).click();
  150 |   await expect(page.getByRole('alert')).toContainText('too large');
  151 |   await expect(first.getByRole('button',{name:'Log one portion',exact:true})).toBeEnabled();
  152 |   const after=await stored(page);expect(after.meals).toEqual(before.meals);expect(after.pantryEvents).toEqual(before.pantryEvents);
  153 |   await page.locator('.fuel-planned-meal').nth(1).getByRole('button',{name:'Log one portion',exact:true}).click();
  154 |   await expect(page.locator('.fuel-planned-meal').nth(1).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  155 |   expect((await stored(page)).meals).toHaveLength(before.meals.length+1);
  156 | });
  157 | 
```