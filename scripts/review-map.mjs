import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve('../workbench-private/atlas-review/overview-controls/final');
await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11','--enable-gpu']:[]});
const issues = [], comparisons = [], states = [];
for (const size of [{name:'desktop',width:1440,height:1000},{name:'laptop',width:1366,height:768},{name:'mobile',width:390,height:844}]) {
  const context = await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:1,isMobile:size.name==='mobile',hasTouch:size.name==='mobile'});
  const page = await context.newPage();
  page.on('pageerror',e=>issues.push({size:size.name,error:e.message}));
  await page.goto('http://127.0.0.1:4321/',{waitUntil:'networkidle'});
  await page.locator('[data-atlas].is-ready').waitFor({timeout:60000});
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(out,size.name+'-home.png'),fullPage:true});
  await page.mouse.move(0,0);
  for (const angle of [0,30,60]) {
    await page.locator('[data-atlas-angle]').evaluate((input,value)=>{
      input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));
    },angle);
    await page.waitForTimeout(700);
    await page.screenshot({path:path.join(out,size.name+'-'+angle+'.png'),fullPage:true});
    states.push({size:size.name,angle,data:await page.locator('[data-atlas]').evaluate(el=>({...el.dataset,width:el.clientWidth,height:el.clientHeight})),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});
  }
  await page.locator('[data-atlas-reset]').click();
  await page.locator('[data-atlas-simple]').click();
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(out,size.name+'-directory.png'),fullPage:true});
  await page.locator('[data-atlas-reset]').click();
  if(size.name==='mobile'){
    await page.keyboard.press('Tab');
    await page.locator('.atlas-hud [data-preview-trigger="skills"]').focus();
  }else await page.locator('.atlas-hud [data-preview-trigger="skills"]').hover();
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(out,size.name+'-preview.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await page.locator('.atlas-hud [data-preview-trigger="about"]').focus();
  await page.locator('[data-preview="about"] .hero-art img').evaluate(img=>img.decode());
  await page.locator('[data-preview="about"]').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(out,size.name+'-welcome.png'),fullPage:true});
  await context.close();
}
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
for (const route of ['/welcome/','/timeline/','/art/','/making/','/character/','/journey/','/friends/','/moments/2026-08-extreme-furry-meet/']) {
  const captures = [];
  for (const port of [4321,4322]) {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:'+port+(route==='/welcome/'&&port===4322?'/':route),{waitUntil:'networkidle'});
    await page.addStyleTag({content:'astro-dev-toolbar{display:none!important}*{animation:none!important;transition:none!important}'});
    await page.mouse.move(0,0); await page.waitForTimeout(200);
    const png = await page.screenshot({animations:'disabled'});
    await writeFile(path.join(out,route.replaceAll('/','-')+port+'.png'),png);
    captures.push(await sharp(png).ensureAlpha().raw().toBuffer());
    await page.close();
  }
  let different = 0;
  for(let i=0;i<captures[0].length;i+=4) if(Math.max(...[0,1,2].map(k=>Math.abs(captures[0][i+k]-captures[1][i+k])))>3)different++;
  comparisons.push({route,differentPixels:different,ratio:different/(1440*1000)});
}
await context.close();await browser.close();
const report={issues,states,comparisons};
await writeFile(path.join(out,'review.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
