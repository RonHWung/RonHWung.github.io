import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('../workbench-private/atlas-review/overview-controls/activity');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11','--enable-gpu']:[]});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1440,height:1000}}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{
  window.atlasDraws=0;
  for(const type of [WebGLRenderingContext,WebGL2RenderingContext]){
    const clear=type.prototype.clear;
    type.prototype.clear=function(...args){window.atlasDraws++;return clear.apply(this,args);};
  }
});
await page.goto('http://127.0.0.1:4321/',{waitUntil:'networkidle'});
await page.locator('[data-atlas].is-ready').waitFor();
const canvas=page.locator('.atlas-canvas canvas');
await page.mouse.move(0,0);await page.waitForTimeout(250);
const raw=await canvas.evaluate(c=>{
  document.querySelector('[data-atlas-angle]').dispatchEvent(new Event('input',{bubbles:true}));
  return new Promise(resolve=>requestAnimationFrame(()=>resolve(c.toDataURL('image/png'))));
});
const poster=Buffer.from(raw.split(',')[1],'base64');
await writeFile(path.join(out,'overview-poster.png'),poster);
await sharp(poster).flatten({background:'#e1e9df'}).webp({quality:88}).toFile('public/models/atlas-poster.webp');
const effects=[];
for(const key of ['friends','skills','works','character','timeline','recent','about']){
  await page.keyboard.press('Escape');await page.mouse.move(0,0);
  await page.locator('.atlas-node[data-preview-trigger="'+key+'"]').hover();
  await page.waitForTimeout(400);
  await page.locator('.atlas-preview:visible img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode().catch(()=>{}))));
  const before=await canvas.screenshot({path:path.join(out,key+'-first.png')});
  const start=await page.evaluate(()=>({draws:window.atlasDraws,time:performance.now()}));
  await page.waitForTimeout(1200);
  const end=await page.evaluate(()=>({draws:window.atlasDraws,time:performance.now()}));
  const after=await canvas.screenshot({path:path.join(out,key+'-second.png')});
  const a=await sharp(before).ensureAlpha().raw().toBuffer(),b=await sharp(after).ensureAlpha().raw().toBuffer();
  let changed=0;for(let i=0;i<a.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])))>2)changed++;
  const state=await page.locator('[data-atlas]').evaluate(el=>({active:el.dataset.activeEntity,effect:el.dataset.effect,motion:el.dataset.effectMotion}));
  effects.push({key,...state,renderFps:(end.draws-start.draws)/((end.time-start.time)/1000),changedPixels:changed});
  if(state.active!==key||state.motion!=='true'||!changed)errors.push('Activity missing: '+key);
}
await page.keyboard.press('Escape');await page.mouse.move(0,0);await page.waitForTimeout(100);
const idleStart=await page.evaluate(()=>window.atlasDraws);await page.waitForTimeout(500);
const idleDraws=await page.evaluate(()=>window.atlasDraws)-idleStart;
const video=page.video();await context.close();await video.saveAs(path.join(out,'building-activities.webm'));
await browser.close();
const report={effects,idleDraws,errors};await writeFile(path.join(out,'effects.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(errors.length||idleDraws)process.exitCode=1;
