import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'regressions.spec.ts',workers:1,retries:0,timeout:15000,outputDir:'./evidence/regression-results',use:{baseURL:'http://127.0.0.1:5173',viewport:{width:390,height:844},timezoneId:'America/Chicago',screenshot:'only-on-failure'},expect:{timeout:1500}});
