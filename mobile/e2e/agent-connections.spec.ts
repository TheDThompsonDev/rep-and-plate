import {test,expect} from './app-fixture';
import {mockCloud} from '../../tests/cloud-fixture';
import {initialState} from '../../src/domain';
import type {AgentAction,AgentConnection} from '../../src/features/connections/contracts';

test.setTimeout(90000);

test('native hosted agent review persists before acknowledgment and survives a failed acknowledgment',async({page})=>{
  await mockCloud(page);
  await page.addInitScript(state=>{
    sessionStorage.setItem('health.connection',JSON.stringify({url:'https://health-beta.example',token:''}));
    localStorage.setItem('dannys-health.native.v1',JSON.stringify({...state,meals:[]}));
  },initialState());
  const createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+86400000).toISOString();
  const connection:AgentConnection={id:'22222222-2222-4222-8222-222222222222',name:'Dinner assistant',scopes:['nutrition:read','meals:propose'],createdAt,expiresAt,revokedAt:null};
  const action:AgentAction={id:'33333333-3333-4333-8333-333333333333',connectionId:connection.id,connectionName:connection.name,requestId:'44444444-4444-4444-8444-444444444444',status:'pending',createdAt,expiresAt,resolvedAt:null,meal:{title:'Agent lentil bowl',day:'2026-09-29',time:'18:30',category:'Dinner',portion:'One bowl',calories:420,protein:22,carbs:58,fat:11,note:'Estimated from the reported portion.'}};
  let connected=false,acknowledgments=0,publishes=0;
  await page.route('**/api/agents/manage',async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,OPTIONS'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    expect(route.request().headers()['x-rp-client']).toBe('web');
    const body=route.request().postDataJSON();
    if(body.operation==='list')return route.fulfill({headers,json:{connections:connected?[connection]:[],actions:connected?[action]:[],publishedAt:null}});
    if(body.operation==='create'){
      expect(body.name).toBe('Dinner assistant');
      expect(body.scopes.sort()).toEqual(['meals:propose','nutrition:read']);
      connected=true;
      return route.fulfill({headers,json:{connection,token:'rp_agent_native_test_only'}});
    }
    if(body.operation==='publish'){
      publishes++;
      expect(body.context).not.toHaveProperty('messages');
      expect(body.context).not.toHaveProperty('profile');
      return route.fulfill({headers,json:{published:true}});
    }
    if(body.operation==='resolve'){
      acknowledgments++;
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dannys-health.native.v1')!));
      expect(saved.meals.filter((meal:{id:string})=>meal.id===`agent-meal:${action.id}`)).toHaveLength(1);
      expect(saved.agentResolutions).toContainEqual(expect.objectContaining({actionId:action.id,status:'accepted'}));
      if(acknowledgments===1)return route.fulfill({status:503,headers,json:{error:{message:'Temporary test failure'}}});
      action.status='accepted';action.resolvedAt=new Date().toISOString();
      return route.fulfill({headers,json:{action}});
    }
    if(body.operation==='revoke'){
      expect(body.connectionId).toBe(connection.id);connection.revokedAt=new Date().toISOString();
      return route.fulfill({headers,json:{revoked:true}});
    }
    throw Error(`Unexpected management operation ${body.operation}`);
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Your profile',exact:true}).click();
  await page.getByRole('button',{name:'Cloud & your records',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill('fixture@example.test');
  await page.getByLabel('Password',{exact:true}).fill('test-password-only');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'These device records are mine',exact:true}).click();
  // Ownership binding may close the sheet when the store opens the account.
  const close=page.getByRole('button',{name:'Close',exact:true});
  if(await close.isVisible())await close.click();
  await page.getByRole('button',{name:'Agent connections',exact:true}).click();
  await page.getByRole('textbox',{name:'Connection name',exact:true}).fill('Dinner assistant');
  await page.getByRole('switch',{name:'Nutrition summaries',exact:true}).click();
  await page.getByRole('button',{name:'Create connection',exact:true}).click();
  await expect(page.getByText('rp_agent_native_test_only',{exact:true})).toBeVisible();
  await expect(page.getByText('https://health-beta.example/api/agents/v1',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'I saved the token',exact:true}).click();
  await expect(page.getByText('rp_agent_native_test_only',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Agent lentil bowl',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Log this meal',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Your review is saved on this device');
  await page.getByRole('button',{name:'Refresh connections',exact:true}).click();
  await expect.poll(()=>acknowledgments).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button',{name:'Log this meal',exact:true})).toHaveCount(0);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dannys-health.native.v1')!));
  expect(saved.meals.filter((meal:{id:string})=>meal.id===`agent-meal:${action.id}`)).toHaveLength(1);
  expect(saved.agentResolutions.filter((receipt:{actionId:string})=>receipt.actionId===action.id)).toHaveLength(1);
  expect(publishes).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Disconnect Dinner assistant',exact:true}).click();
  await expect(page.getByText('Disconnected',{exact:true})).toBeVisible();
});

test('native paired development bridge explains its limitation without exposing management',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('health.connection',JSON.stringify({url:'http://127.0.0.1:5174',token:'a'.repeat(64)})));
  let managementCalls=0;
  await page.route('**/api/agents/manage',route=>{managementCalls++;return route.abort();});
  await page.route('**/api/cloud/config',route=>route.fulfill({json:{available:false}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Your profile',exact:true}).click();
  await page.getByRole('button',{name:'Agent connections',exact:true}).click();
  await expect(page.getByText(/Agent connections on mobile require a hosted account/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Create connection',exact:true})).toHaveCount(0);
  expect(managementCalls).toBe(0);
});
