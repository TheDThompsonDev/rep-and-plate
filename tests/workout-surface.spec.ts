import { test, expect, type Page } from '@playwright/test';

const stored=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')!));
test.beforeEach(async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{available:false,jev:false}}));
  await page.goto('/#workouts');
});

test('workout options show an honest empty history and preserve an active session while browsing',async({page})=>{
  await expect(page.locator('.spot-empty')).toContainText('No reps yet.');
  await expect(page.locator('.workout-preview').first()).toContainText('No finished session recorded');
  await expect(page.getByText('Your bench has increased 15 lb in 7 weeks.',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/Last time:/)).toHaveCount(0);
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await page.getByRole('button',{name:'Bench Press set 1: 8 reps',exact:true}).click();
  const active=(await stored(page)).workout;
  await page.getByRole('button',{name:'Browse workout options',exact:true}).click();
  await expect(page.getByRole('region',{name:'Your active workout'})).toContainText('1 of 12 sets recorded');
  await expect(page.getByRole('button',{name:'Create a workout for me',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Lower Body ~35 min',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Lower Body · ~35 min',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Start workout',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Continue current workout',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Upper Body in progress',exact:true})).toBeVisible();
  expect((await stored(page)).workout).toEqual(active);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Upper Body in progress',exact:true})).toBeVisible();
  expect((await stored(page)).workout).toEqual(active);
  await page.getByRole('button',{name:'Open workout menu',exact:true}).click();
  await page.getByRole('button',{name:'Session history',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Upper Body · In progress');
  await page.getByRole('button',{name:'Resume workout',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('workout previews and recent history use completed recorded sets rather than presets',async({page})=>{
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
    const exercise={name:'Bench Press',weight:95,target:8,previous:[99,99,99],sets:[8,null,6]};
    const saved={title:'Recorded upper body',startedAt:'2026-09-23T12:00:00Z',finishedAt:'2026-09-23T13:00:00Z',exercises:[exercise]};
    state.workout.history=[saved,saved,{...saved,title:'Unfinished upper body',startedAt:'2026-09-24T12:00:00Z',finishedAt:null},{...saved,title:'Sample history',startedAt:'2026-09-25T12:00:00Z',finishedAt:'2026-09-25T13:00:00Z'}];
    localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  });
  await page.reload();const before=(await stored(page)).workout;
  await expect(page.locator('.workout-preview').first()).toContainText('Last recorded: 95 lb · 8, 6 reps');
  await expect(page.locator('.workout-preview').first()).not.toContainText('99');
  await expect(page.locator('.workout-insight').first()).toContainText('2 sets across your latest finished session');
  await page.getByRole('button',{name:'View history',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'Recorded upper body · Saved',exact:true})).toHaveCount(1);
  await expect(dialog).toContainText('95 lb · 8, 6 reps');
  await expect(dialog).not.toContainText('Unfinished upper body');
  await expect(dialog).not.toContainText('Sample history');
  await expect(dialog).not.toContainText('99');
  await page.keyboard.press('Escape');
  expect((await stored(page)).workout).toEqual(before);
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await expect(page.getByRole('region',{name:'Bench Press',exact:true})).toContainText('Last recorded: 95 lb · 8, 6 reps');
});
