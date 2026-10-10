/// <reference types="node" />
import { defineConfig } from '@playwright/test';
import process from 'node:process';
export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4321', headless: true, viewport: { width: 1440, height: 1000 }, launchOptions: { args: process.platform === 'win32' ? ['--use-angle=d3d11','--enable-gpu'] : [] } },
});
