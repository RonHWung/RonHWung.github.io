import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('../workbench-private/atlas-review');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11','--enable-gpu']:[]});
const issues=[];
for(const size of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:1,isMobile:size.name==='mobile',hasTouch:size.name==='mobile'});
  const page=await context.newPage();
  page.on('pageerror',e=>issues.push({viewport:size.name,error:e.message}));
  for(const route of ['/','/timeline/','/art/','/making/','/character/','/journey/','/friends/','/moments/2026-08-extreme-furry-meet/','/moments/2023-10-making-ronghuang-1/','/404.html']){
    await page.goto('http://127.0.0.1:4321'+route,{waitUntil:'networkidle'});
    if(route==='/')await page.locator('[data-atlas].is-ready, [data-atlas].is-simplified').waitFor({timeout:60000});
    await page.waitForTimeout(700);
    const key=route==='/'?'home':route.replaceAll('/','-').replace(/^-|-$/g,'');
    await page.screenshot({path:path.join(out,`${size.name}-${key}.png`),fullPage:!['/','/timeline/'].includes(route)});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    if(overflow)issues.push({viewport:size.name,route,error:'horizontal overflow'});
    console.log(size.name,route,'captured');
    if(route==='/'){
      await page.keyboard.press('Tab');
      await page.locator('.atlas-hud [data-preview-trigger="skills"]').focus();
      await page.screenshot({path:path.join(out,`${size.name}-home-preview.png`)});
      await page.locator('[data-preview="skills"] .preview-close').click();
      if(size.name==='desktop'){
        await page.locator('[data-atlas-angle]').evaluate(input=>{input.value='60';input.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'desktop-home-close.png')});
      }
    }
  }
  await context.close();
}
await browser.close();await writeFile(path.join(out,'visual-issues.json'),JSON.stringify(issues,null,2));console.log(JSON.stringify(issues));
