import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { createAtlasEffects } from '../src/scripts/atlas-effects';
const pageErrors=new WeakMap<import('@playwright/test').Page,string[]>();
test.beforeEach(({page})=>{
  const errors:string[]=[];pageErrors.set(page,errors);
  page.on('pageerror',error=>errors.push(error.message));
});
test.afterEach(({page})=>{expect(pageErrors.get(page)??[]).toEqual([]);});

async function ready(page: import('@playwright/test').Page) {
  await page.goto('/'); await expect(page.locator('[data-atlas]')).toHaveClass(/is-ready/);
  await page.mouse.move(0,0);
}
async function angle(page: import('@playwright/test').Page, value: number) {
  await page.locator('[data-atlas-angle]').evaluate((input,value) => {
    (input as HTMLInputElement).value = String(value); input.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
  await expect.poll(async () => Number(await page.locator('[data-atlas]').getAttribute('data-angle'))).toBeCloseTo(value,1);
}
test('map starts at the 58 degree overview and Home restores the same view', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror',e => errors.push(e.message));
  await ready(page);
  await expect(page.locator('.atlas-preview:visible')).toHaveCount(0);
  await expect(page.locator('[data-atlas]')).toHaveAttribute('data-angle','58.00');
  await expect(page.locator('[data-atlas-zoom]')).toHaveCount(0);
  const homeScale=Number(await page.locator('[data-atlas]').getAttribute('data-scale'));
  await angle(page,0);
  const initial = await page.locator('[data-atlas]').evaluate(el => ({
    scale:Number((el as HTMLElement).dataset.scale), w:el.clientWidth, h:el.clientHeight
  }));
  expect(initial.scale*41.53).toBeGreaterThan(initial.w*.72);
  expect(initial.scale*41.53).toBeGreaterThan(initial.h*.70);
  expect(initial.scale/homeScale).toBeCloseTo(.8/(1+.18*58/60),3);
  await angle(page,30); await angle(page,60);
  expect(Number(await page.locator('[data-atlas]').getAttribute('data-scale'))/initial.scale).toBeLessThan(1.8);
  const box = (await page.locator('.atlas-canvas canvas').boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.wheel(0,150);
  await expect.poll(async()=>Number(await page.locator('[data-atlas-angle]').inputValue())).toBeLessThan(60);
  await page.locator('[data-atlas-reset]').click();
  await expect(page.locator('[data-atlas]')).toHaveAttribute('data-angle','58.00');
  expect(errors).toEqual([]);
});
test('drag limits account for the visible footprint at every pitch', async ({ page }) => {
  await ready(page);
  for (const pitch of [0,30,60]) {
    await angle(page,pitch);
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-grid-skew','0.000000');
    const box = (await page.locator('.atlas-canvas canvas').boundingBox())!;
    await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5);
    await page.mouse.down(); await page.mouse.move(box.x-1800,box.y+box.height+1800,{steps:8}); await page.mouse.up();
    const s = await page.locator('[data-atlas]').evaluate(el => {
      const d = (el as HTMLElement).dataset;
      return {x:Number(d.targetX),z:Number(d.targetZ),halfX:Number(d.halfX),halfZ:Number(d.halfZ)};
    });
    expect(Math.abs(s.x)).toBeLessThanOrEqual(Math.max(0,20.765-s.halfX*.82)+.003);
    expect(Math.abs(s.z)).toBeLessThanOrEqual(Math.max(0,20.765-s.halfZ*.82)+.003);
    const panLimit=Math.max(0,20.765-s.halfX*.82);
    if(panLimit>.05)expect(Math.abs(s.x)).toBeGreaterThan(Math.max(0,20.765-s.halfX)+.05);
    else expect(Math.abs(s.x)).toBeLessThanOrEqual(.003);
    // The smaller top-down map may fit inside the viewport; dragging may add
    // at most 9% empty space beyond the breathing room already present at Home.
    const centeredGap=Math.max(0,s.halfX-20.765)/(s.halfX*2);
    expect((Math.abs(s.x)+s.halfX-20.765)/(s.halfX*2)-centeredGap).toBeLessThan(.091);
    await expect(page).toHaveURL('http://127.0.0.1:4321/');
  }
});
test('building hover previews; clicking the building or its label goes directly to its page', async ({ page }) => {
  await ready(page);
  const origin = await page.locator('.atlas-node[data-preview-trigger="character"]').evaluate(el=>({x:Number((el as HTMLElement).dataset.anchorX),y:Number((el as HTMLElement).dataset.anchorY)}));
  const box=(await page.locator('.atlas-canvas').boundingBox())!;
  const x = box.x+origin.x,y = box.y+origin.y+5;
  await page.mouse.move(x,y);
  await expect(page.locator('[data-atlas]')).toHaveAttribute('data-active-entity','character');
  await expect(page.locator('[data-preview="character"]')).toBeVisible();
  await page.mouse.click(x,y);
  await expect(page).toHaveURL(/\/character\/$/);
  await ready(page);
  await page.locator('.atlas-node[data-preview-trigger="friends"]').click();
  await expect(page).toHaveURL(/\/friends\/$/);
});
test('previews choose the opposite side and keep their position while reading', async ({ page }) => {
  await ready(page);
  await page.locator('.atlas-hud [data-preview-trigger="skills"]').hover();
  const preview = page.locator('[data-preview="skills"]');
  await expect(preview).toContainText('同一只毛毛龙的两种诞生方式');
  await expect(preview).toHaveAttribute('data-side','right');
  await preview.hover(); await page.waitForTimeout(1300);
  await expect(preview).toBeVisible(); await expect(preview).toHaveAttribute('data-side','right');
  await preview.locator('.preview-close').click();
  await page.locator('.atlas-node[data-preview-trigger="friends"]').hover();
  await expect(page.locator('[data-preview="friends"]')).toHaveAttribute('data-side','left');
  await page.locator('[data-preview="friends"]').hover();
  await expect(page.locator('[data-preview="friends"]')).toHaveAttribute('data-side','left');
});
test('touch links navigate immediately and fallback destinations remain usable', async ({ browser }) => {
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page = await context.newPage(); await ready(page);
  await page.locator('.atlas-hud [data-preview-trigger="skills"]').tap();
  await expect(page).toHaveURL(/\/making\/$/);
  await ready(page);
  await page.locator('[data-atlas-simple]').tap();
  await expect(page.locator('[data-atlas]')).toHaveClass(/is-directory/);
  await expect(page.locator('.atlas-node[aria-hidden="false"]')).toHaveCount(7);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await context.close();
});
test('terminal timeline and event details retain their original navigation and credits', async ({ page,request }) => {
  await page.goto('/timeline/'); await expect(page.locator('.timeline-card')).toHaveCount(31);
  await expect(page.locator('[data-archive]')).toHaveCount(0);
  await page.locator('[data-timeline-next]').click();
  await expect.poll(()=>page.locator('[data-timeline-scroller]').evaluate(el=>el.scrollLeft)).toBeGreaterThan(100);
  await page.goto('/moments/2026-08-extreme-furry-meet/');
  await expect(page.locator('.prose')).toContainText('罗罗');
  await expect(page.locator('.adaptive-gallery--primary')).toBeVisible();
  await expect(page.locator('.image-expand, .document-index, .detail-pager')).toHaveCount(0);
  const old = await request.get('http://127.0.0.1:4322/');
  expect(old.status()).toBe(200); expect(await old.text()).toContain('把想象画下来');
});
test('WebGL unavailable shows links and leaves the terminal timeline usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement,type:string,...args:unknown[]) {
      if (type.includes('webgl')) return null;
      return (original as Function).apply(this,[type,...args]);
    } as typeof original;
  });
  await page.goto('/'); await expect(page.locator('[data-atlas-fallback]')).toBeVisible();
  await expect(page.locator('.atlas-preview:visible')).toHaveCount(0);
  await page.locator('[data-atlas-simple]').click(); await expect(page.locator('[data-atlas-fallback]')).toBeVisible();
  await page.goto('/timeline/'); await expect(page.locator('.timeline-card')).toHaveCount(31);
});

test('keyboard close returns focus without reopening the preview', async ({ page }) => {
  await ready(page); await page.keyboard.press('Tab');
  const trigger = page.locator('.atlas-hud [data-preview-trigger="skills"]');
  await trigger.focus(); await expect(page.locator('[data-preview="skills"]')).toBeVisible();
  await page.locator('[data-preview="skills"] .preview-close').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-preview="skills"]')).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/making\/$/);
});

test('homepage frame fills the screen, footer is compact and preview has readable scale', async ({ page }) => {
  for (const viewport of [{width:1440,height:1000},{width:1920,height:1080},{width:390,height:844}]) {
    await page.setViewportSize(viewport); await ready(page);
    const frame = await page.evaluate(()=>{
      const rect = (s:string)=>document.querySelector(s)!.getBoundingClientRect().toJSON();
      return {header:rect('.site-header'),map:rect('[data-atlas]'),footer:rect('.site-footer'),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    for (const rect of [frame.header,frame.map,frame.footer]) {
      expect(rect.x).toBeCloseTo(0,0); expect(rect.width).toBeCloseTo(viewport.width,0);
    }
    expect(frame.footer.height).toBeLessThanOrEqual(frame.header.height+16);
    expect(frame.overflow).toBeFalsy();
    await page.keyboard.press('Tab');
    await page.locator('.atlas-hud [data-preview-trigger="skills"]').focus();
    const preview = page.locator('[data-preview="skills"]');
    await expect(preview).toBeVisible();
    const layout = await preview.evaluate(el=>({
      width:el.getBoundingClientRect().width,
      font:parseFloat(getComputedStyle(el.querySelector('p.section-description')!).fontSize)
    }));
    if(viewport.width>=1260) expect(layout.width/viewport.width).toBeCloseTo(1/3,2);
    expect(layout.font).toBeGreaterThanOrEqual(15);
    const gaps = await preview.locator('.skill-panel').evaluateAll(panels=>panels.map(panel=>{
      const body = panel.querySelector('p:not(.eyebrow)')!,link = panel.querySelector('.button-link')!;
      return link.getBoundingClientRect().top-body.getBoundingClientRect().bottom;
    }));
    gaps.forEach(gap=>expect(gap).toBeGreaterThanOrEqual(0));
  }
});

test('welcome opens on hover, shows the full picture, and preserves the original homepage destination', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-atlas]')).toHaveClass(/is-ready/);
  const welcome = page.locator('[data-preview="about"]');
  await expect(welcome).toBeHidden();
  await page.locator('.atlas-hud [data-preview-trigger="about"]').hover();
  await expect(welcome).toBeVisible(); await expect(welcome).toContainText('HELLO, I AM RONHWUNG');
  const picture = await welcome.locator('.hero-art picture').evaluate(async el=>{
    const img=el.querySelector('img')!;
    await img.decode();
    const image=img.getBoundingClientRect(),frame=el.getBoundingClientRect();
    return {ratio:image.width/image.height,natural:img.naturalWidth/img.naturalHeight,imageHeight:image.height,frameHeight:frame.height};
  });
  expect(picture.ratio).toBeCloseTo(picture.natural,2);
  expect(picture.frameHeight).toBeCloseTo(picture.imageHeight,0);
  await expect(page.locator('.atlas-hud [data-preview-trigger="about"]')).toHaveAttribute('href','/welcome/');
  await expect(page.locator('.atlas-hud [data-preview-trigger="character"]')).toHaveAttribute('href','/character/');
  await welcome.locator('a[href="/welcome/"]').click();
  await expect(page).toHaveURL(/\/welcome\/$/);
  for(const copy of ['HELLO, I AM RONHWUNG','DRAW IT · MAKE IT','ALONG THE WAY','MEET RONHWUNG','SELECTED WORKS'])
    await expect(page.locator('main')).toContainText(copy);
  await expect(page.locator('[data-atlas]')).toHaveCount(0);
  await expect(page.locator('.site-header nav a[href="/"]')).toHaveAttribute('aria-current','page');
});

test('central pavilion preview stays on one side while the pointer crosses the midpoint', async ({ page }) => {
  await ready(page);
  const point=await page.locator('.atlas-node[data-preview-trigger="character"]').evaluate(el=>({x:Number((el as HTMLElement).dataset.anchorX),y:Number((el as HTMLElement).dataset.anchorY)}));
  const box=(await page.locator('.atlas-canvas').boundingBox())!;
  const center = box.x+point.x,y = box.y+point.y+5;
  await page.mouse.move(center-20,y);
  const preview = page.locator('[data-preview="character"]');
  await expect(preview).toBeVisible(); await expect(preview).toHaveAttribute('data-side','right');
  const initial = (await preview.boundingBox())!;
  for(const offset of [20,-20,20,-20,20]) {
    await page.mouse.move(center+offset,y);
    await expect(preview).toHaveAttribute('data-side','right');
    expect((await preview.boundingBox())!.x).toBe(initial.x);
  }
  await preview.hover(); await page.waitForTimeout(1300);
  await expect(preview).toBeVisible();
  await preview.locator('a[href="/character/"]').click();
  await expect(page).toHaveURL(/\/character\/$/);
});

test('northern growing beds are an interactive welcome destination', async ({ page }) => {
  await ready(page);
  const point=await page.locator('.atlas-node[data-preview-trigger="about"]').evaluate(el=>({x:Number((el as HTMLElement).dataset.anchorX),y:Number((el as HTMLElement).dataset.anchorY)}));
  const box=(await page.locator('.atlas-canvas').boundingBox())!;
  const x = box.x+point.x+30,y = box.y+point.y+4;
  await page.mouse.move(x,y);
  await expect(page.locator('[data-atlas]')).toHaveAttribute('data-active-entity','about');
  await expect(page.locator('[data-preview="about"]')).toBeVisible();
  await page.mouse.click(x,y); await expect(page).toHaveURL(/\/welcome\/$/);
  await page.goBack(); await expect(page.locator('[data-atlas]')).toHaveClass(/is-ready/);
  await angle(page,30);
});

test('overview and directory keep seven tags clear; directory preserves the visible map and title', async ({ page }) => {
  for(const viewport of [{width:1440,height:1000},{width:1366,height:768},{width:390,height:844}]) {
    await page.setViewportSize(viewport);await ready(page);
    const title=await page.locator('.atlas-title').evaluate(el=>({color:getComputedStyle(el.querySelector('h1')!).color,rect:el.getBoundingClientRect().toJSON()}));
    await expect(page.locator('.atlas-node[aria-hidden="false"]')).toHaveCount(7);
    const rects=await page.locator('.atlas-node').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON()));
    for(let i=0;i<rects.length;i++) {
      const a=rects[i];expect(a.x).toBeGreaterThanOrEqual(0);expect(a.right).toBeLessThanOrEqual(viewport.width);
      expect(a.bottom).toBeLessThan(viewport.height);
      expect(a.x>=title.rect.right||a.right<=title.rect.x||a.y>=title.rect.bottom||a.bottom<=title.rect.y).toBeTruthy();
      for(const b of rects.slice(i+1))expect(a.x>=b.right||a.right<=b.x||a.y>=b.bottom||a.bottom<=b.y).toBeTruthy();
    }
    const initialScale=await page.locator('[data-atlas]').getAttribute('data-scale');
    await angle(page,20);await page.locator('[data-atlas-simple]').click();
    await expect(page.locator('[data-atlas]')).toHaveClass(/is-directory/);
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-angle','58.00');
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-scale',initialScale!);
    await expect(page.locator('[data-atlas-fallback]')).toBeHidden();
    const style=await page.locator('.atlas-canvas').evaluate(el=>({filter:getComputedStyle(el).filter,opacity:Number(getComputedStyle(el).opacity),display:getComputedStyle(el).display}));
    expect(style.filter).not.toContain('grayscale');expect(style.filter).toContain('brightness');
    expect(style.opacity).toBeGreaterThan(.6);expect(style.opacity).toBeLessThan(1);expect(style.display).not.toBe('none');
    expect(await page.locator('.atlas-title h1').evaluate(el=>getComputedStyle(el).color)).toBe(title.color);
    await page.locator('[data-atlas-reset]').click();await expect(page.locator('[data-atlas]')).not.toHaveClass(/is-directory/);
  }
});

test('all seven English HUD links preview and navigate independently', async ({ page }) => {
  await ready(page);
  const links=page.locator('.atlas-hud a');await expect(links).toHaveCount(7);
  const entries=await links.evaluateAll(els=>els.map(el=>({key:(el as HTMLElement).dataset.previewTrigger,text:el.textContent,href:el.getAttribute('href')})));
  for(const entry of entries) {
    expect(entry.text).not.toMatch(/[\u4e00-\u9fff↗]/);
    await page.locator('.atlas-hud [data-preview-trigger="'+entry.key+'"]').hover();
    await expect(page.locator('[data-preview="'+entry.key+'"]')).toBeVisible();
  }
  await links.last().click();await expect(page).toHaveURL(/\/friends\/$/);
});

test('entity activity is exclusive, stops on close and has an independent motion control', async ({ page,browser }) => {
  await ready(page);
  for(const key of ['friends','skills','works','character','timeline','recent','about']) {
    await page.locator('.atlas-node[data-preview-trigger="'+key+'"]').hover();
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-active-entity',key);
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-effect-motion','true');
    expect(await page.locator('[data-atlas]').getAttribute('data-effect')).not.toBe('');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-effect-motion','false');
  }
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});
  const reduced=await context.newPage();await ready(reduced);
  await reduced.locator('.atlas-node[data-preview-trigger="friends"]').hover();
  await expect(reduced.locator('[data-atlas]')).toHaveAttribute('data-effect-motion','true');
  await reduced.locator('[data-atlas-motion]').click();
  await expect(reduced.locator('[data-atlas]')).toHaveAttribute('data-effect-motion','false');
  await reduced.reload();await expect(reduced.locator('[data-atlas]')).toHaveClass(/is-ready/);
  await reduced.locator('.atlas-node[data-preview-trigger="friends"]').hover();
  await expect(reduced.locator('[data-atlas]')).toHaveAttribute('data-effect-motion','false');
  await reduced.locator('[data-atlas-motion]').click();
  await expect(reduced.locator('[data-atlas]')).toHaveAttribute('data-effect-motion','true');
  await context.close();
});

test('each building has moving effect geometry and other districts stay still', () => {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const activity=createAtlasEffects(scene,camera);
  const groups=scene.children as THREE.Group[];
  const state=(group:THREE.Group)=>group.children.map(object=>{
    const mesh=object as THREE.Mesh;
    return {position:object.position.toArray(),rotation:object.quaternion.toArray(),scale:object.scale.toArray(),
      opacity:(mesh.material as THREE.MeshBasicMaterial|undefined)?.opacity,draw:mesh.geometry?.drawRange.count,
      children:object.children.map(child=>child.position.toArray())};
  });
  expect(groups).toHaveLength(7);expect(groups.every(group=>!group.visible)).toBeTruthy();
  for(const key of ['friends','skills','works','character','timeline','recent','about']) {
    activity.select(key);
    const current=groups.find(group=>group.name==='activity-'+key)!;
    const others=groups.filter(group=>group!==current),still=others.map(state);
    const now=performance.now()/1000;
    activity.update(now+.35,true);const first=state(current);
    activity.update(now+1.1,true);
    expect(state(current)).not.toEqual(first);
    expect(groups.filter(group=>group.visible)).toEqual([current]);
    expect(others.map(state)).toEqual(still);
    if(key==='friends')expect(new THREE.Box3().setFromObject(current).min.x).toBeGreaterThan(12.5);
    expect(activity.update(now+1.2,false)).toBeTruthy();
    expect(groups.every(group=>!group.visible)).toBeTruthy();
    expect(activity.update(now+1.3,false)).toBeFalsy();
  }
  activity.select('');expect(activity.name()).toBe('');
});

test('signal tower gaps keep receiving animation active without including the bridge', async ({page}) => {
  await page.setViewportSize({width:1280,height:720});
  for(const pitch of [58,0]) {
    await ready(page);await angle(page,pitch);
    const point=await page.locator('.atlas-node[data-preview-trigger="friends"]').evaluate(el=>({
      x:Number((el as HTMLElement).dataset.anchorX),y:Number((el as HTMLElement).dataset.anchorY),
    }));
    const box=(await page.locator('.atlas-canvas').boundingBox())!;
    const x=box.x+point.x,y=box.y+point.y+(pitch ? 80 : 8);
    await page.mouse.move(x,y);
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-active-entity','friends');
    // Hold the pointer in the open lattice longer than the preview close delay.
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-atlas]')).toHaveAttribute('data-effect-motion','true');
    for(const dx of [-6,0,6]) {
      await page.mouse.move(x+dx,y);
      await expect(page.locator('[data-atlas]')).toHaveAttribute('data-active-entity','friends');
    }
    const clip={x:x-60,y:box.y+point.y-6,width:120,height:155};
    const first=await page.screenshot({clip});await page.waitForTimeout(450);
    const second=await page.screenshot({clip});
    expect(first.equals(second)).toBeFalsy();
    await page.keyboard.press('Escape');
    const bridge=await page.locator('[data-atlas]').evaluate((el,pitch)=>{
      const d=(el as HTMLElement).dataset,s=Number(d.scale),r=pitch*Math.PI/180;
      return {x:el.clientWidth/2+(9-Number(d.targetX))*s,
        y:el.clientHeight/2+((3-Number(d.targetZ))*Math.cos(r)-.8*Math.sin(r))*s};
    },pitch);
    await page.mouse.move(box.x+bridge.x,box.y+bridge.y);
    await expect(page.locator('[data-atlas]')).not.toHaveAttribute('data-active-entity','friends');
  }
});
