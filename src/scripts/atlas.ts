import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createAtlasLabels, HOME_ANGLE, HOME_TARGET_Z } from './atlas-labels';
import { createAtlasEffects } from './atlas-effects';

export async function initAtlas() {
  const world = document.querySelector<HTMLElement>('[data-atlas]');
  if (!world) return;
  const host = world.querySelector<HTMLElement>('[data-atlas-canvas]')!;
  const triggers = [...world.querySelectorAll<HTMLAnchorElement>('[data-preview-trigger]')];
  const routes = new Map(triggers.map(t => [t.dataset.previewTrigger!,t.href]));
  const previews = [...world.querySelectorAll<HTMLElement>('[data-preview]')];
  const fallback = world.querySelector<HTMLElement>('[data-atlas-fallback]')!;
  const status = world.querySelector<HTMLElement>('[data-atlas-status]')!;
  const slider = world.querySelector<HTMLInputElement>('[data-atlas-angle]')!;
  const readout = world.querySelector<HTMLOutputElement>('[data-atlas-angle-readout]')!;
  const simpleButton = world.querySelector<HTMLButtonElement>('[data-atlas-simple]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  let keyboardMode = false, active = '', pinned = false, insidePreview = false, restoringFocus = false;
  let previewOrigin: HTMLAnchorElement | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let highlight = (_key: string) => {};
  let dirty = true;
  let resetToHome = () => {}, relayout = () => {};
  reduced.addEventListener('change', () => dirty = true);
  window.addEventListener('keydown', () => keyboardMode = true, { capture: true });
  window.addEventListener('pointerdown', () => keyboardMode = false, { capture: true });

  function close() {
    clearTimeout(closeTimer);
    active = ''; pinned = false; insidePreview = false;
    previews.forEach(p => p.hidden = true);
    triggers.forEach(t => t.setAttribute('aria-expanded', 'false'));
    highlight('');
  }
  function show(key: string, pin = false, clientX?: number) {
    clearTimeout(closeTimer);
    if (insidePreview) return;
    const rect = host.getBoundingClientRect();
    const side = clientX === undefined || clientX < rect.left + rect.width / 2 ? 'right' : 'left';
    const changed = active !== key;
    active = key; pinned = pin;
    previews.forEach(p => {
      p.hidden = p.dataset.preview !== key;
      if (!p.hidden) {
        // Choose a side only when opening a different preview. A central entity
        // can straddle the midpoint without making its panel chase the pointer.
        if (changed) p.dataset.side = side;
        if (changed) p.scrollTop = 0;
      }
    });
    triggers.forEach(t => t.setAttribute('aria-expanded', String(t.dataset.previewTrigger === key)));
    highlight(key);
  }
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    if (!pinned && !insidePreview && !previews.some(p => !p.hidden && p.contains(document.activeElement))) {
      closeTimer = setTimeout(close, 1200);
    }
  };
  triggers.forEach(t => {
    t.addEventListener('pointerenter', e => {
      if (hover.matches && e.pointerType === 'mouse') show(t.dataset.previewTrigger!, false, e.clientX);
    });
    t.addEventListener('pointerleave', scheduleClose);
    t.addEventListener('focus', () => {
      if (keyboardMode && !restoringFocus) {
        previewOrigin = t;
        show(t.dataset.previewTrigger!, false, t.getBoundingClientRect().left + t.clientWidth / 2);
      }
    });
  });
  previews.forEach(p => {
    p.addEventListener('pointerenter', () => { insidePreview = true; clearTimeout(closeTimer); });
    p.addEventListener('pointerleave', () => { insidePreview = false; scheduleClose(); });
    p.addEventListener('focusin', () => clearTimeout(closeTimer));
    p.addEventListener('focusout', e => { if (!p.contains(e.relatedTarget as Node)) scheduleClose(); });
    p.querySelector('.preview-close')?.addEventListener('click', () => {
      close();
      if (keyboardMode) {
        restoringFocus = true;
        (previewOrigin ?? triggers.find(t => t.dataset.previewTrigger === p.dataset.preview))?.focus();
        restoringFocus = false;
      }
    });
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  let renderer: THREE.WebGLRenderer | undefined, available = false;
  function simple(on: boolean) {
    close(); world!.classList.toggle('is-simplified', on);
    fallback.hidden = !on;
    simpleButton.setAttribute('aria-pressed', String(on));
    status.textContent = on ? '地图索引' : 'EXPLORE // RH-0522';
    dirty = true;
  }
  function directory(on:boolean) {
    resetToHome();
    world!.classList.remove('is-simplified');fallback.hidden=true;
    world!.classList.toggle('is-directory',on);
    simpleButton.setAttribute('aria-pressed',String(on));
    status.textContent=on?'DIRECTORY // RH-0522':'EXPLORE // RH-0522';
    relayout();dirty=true;
  }
  simpleButton.addEventListener('click', () => available ? directory(!world.classList.contains('is-directory')) : simple(true));
  // Native links remain available without JavaScript or WebGL.
  fallback.hidden = true;
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-25,25,25,-25,.1,200);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const context = renderer.getContext(), info = context.getExtension('WEBGL_debug_renderer_info');
    const rendererName = info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const software = /swiftshader|llvmpipe|software/i.test(rendererName);
    renderer.setPixelRatio(software ? .8 : Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 2));
    renderer.shadowMap.enabled = !software; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03;
    const canvas = renderer.domElement;
    host.append(canvas); canvas.tabIndex = 0;
    canvas.setAttribute('aria-label','微缩地图：拖动平移，滚轮调整俯仰角，方向键移动，Home复位');
    scene.add(new THREE.HemisphereLight(0xf4fff2,0x859587,2.5));
    const sun = new THREE.DirectionalLight(0xfff4d6,3.2);
    sun.position.set(-20,40,25); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:100});
    sun.shadow.normalBias = .025; sun.shadow.bias = -.0002; scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc4edf2,.7); fill.position.set(25,16,-25); scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.ShadowMaterial({color:0x365443,opacity:.14}));
    floor.rotation.x = -Math.PI/2; floor.position.y = -.14; floor.receiveShadow = true; scene.add(floor);
    const draco = new DRACOLoader(); draco.setDecoderPath('/models/draco/');
    const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync('/models/ronghuang-atlas.glb'); draco.dispose();
    if (software) {
      const shadow = await new THREE.TextureLoader().loadAsync('/models/atlas-shadow.webp');
      shadow.colorSpace = THREE.NoColorSpace; gltf.scene.updateMatrixWorld(true);
      const direction = new THREE.Vector3(-20,40,25).normalize();
      const normal = new THREE.Vector3(), position = new THREE.Vector3();
      gltf.scene.traverse(o => {
        if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
        const source = o.material, geometry = o.geometry;
        const vertices = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
        const colors = new Float32Array(vertices.count*3), uv = new Float32Array(vertices.count*2);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
        for (let i=0;i<vertices.count;i++) {
          normal.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
          const shade = .64+.5*Math.max(0,normal.dot(direction));
          colors[i*3] = source.color.r*shade; colors[i*3+1] = source.color.g*shade; colors[i*3+2] = source.color.b*shade;
          position.fromBufferAttribute(vertices,i).applyMatrix4(o.matrixWorld);
          uv[i*2] = position.x/43.5+.5; uv[i*2+1] = .5-position.z/43.5;
        }
        geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
        const ground = o.name.startsWith('terrain_land');
        if (ground) geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
        o.material = new THREE.MeshBasicMaterial({vertexColors:true,side:source.side,map:ground?shadow:null});
      });
      world.dataset.renderMode = 'baked';
    } else world.dataset.renderMode = 'realtime';
    gltf.scene.traverse(o => {
      if (o instanceof THREE.Mesh) { o.castShadow = !o.name.startsWith('terrain'); o.receiveShadow = true; }
    });
    scene.add(gltf.scene);
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;

    const labels = createAtlasLabels(triggers.filter(t => t.classList.contains('atlas-node')),world.querySelector<SVGSVGElement>('[data-atlas-connectors]')!);
    const effects = createAtlasEffects(scene,camera);
    const destinations: Record<string,string> = {pavilion:'character',workshop:'skills',gallery:'works',archive:'timeline',camp:'recent',communications:'friends'};
    type Signal = { strength: {value:number}; time: {value:number} };
    const entities = new Map<string,{meshes:THREE.Mesh[]; signals:Signal[]}>();
    const buildings: THREE.Mesh[] = [];
    gltf.scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const zone = o.name.split('_')[0];
      const field = zone === 'cultivated' || zone === 'botanical' || o.name.startsWith('terrain_land');
      const key = destinations[zone] ?? (field ? 'about' : ''); if (!key) return;
      const entity = entities.get(key) ?? {meshes:[],signals:[]};
      const signal = {strength:{value:0},time:{value:0}};
      // Each entity owns its shader uniforms; shared glTF materials never tint other buildings.
      const source = o.material as THREE.Material;
      const material = source.clone();
      material.onBeforeCompile = shader => {
        shader.uniforms.atlasStrength = signal.strength; shader.uniforms.atlasTime = signal.time;
        shader.vertexShader = shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 atlasPosition;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\natlasPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        const mask = key === 'about'
          ? 'smoothstep(-4.8,-4.5,atlasPosition.x) * (1.0-smoothstep(4.5,4.8,atlasPosition.x)) * smoothstep(-16.6,-16.3,atlasPosition.z) * (1.0-smoothstep(-10.7,-10.4,atlasPosition.z))'
          // The station terrace starts at x=12.6; its western bridge shares
          // these material batches but lies outside the station highlight.
          : key === 'friends' ? 'step(12.5,atlasPosition.x)' : '1.0';
        const sweep = key === 'about' ? '(atlasPosition.x + atlasPosition.z)' : 'atlasPosition.y';
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 atlasPosition;\nuniform float atlasStrength;\nuniform float atlasTime;')
          .replace('#include <opaque_fragment>','#include <opaque_fragment>\nfloat atlasMask = '+mask+';\nfloat atlasBand = pow(max(0.0, sin('+sweep+' * 3.0 - atlasTime * 2.3)), 14.0);\nfloat atlasPulse = 0.5 + 0.5 * sin(atlasTime * 2.0);\ngl_FragColor.rgb += atlasStrength * atlasMask * vec3(0.025, 0.26, 0.22) * (0.35 + atlasPulse * 0.15 + atlasBand * 0.7);');
      };
      material.customProgramCacheKey = () => key === 'about' ? 'atlas-field-v1'
        : key === 'friends' ? 'atlas-signal-tower-v1' : 'atlas-entity-v1';
      o.material = material; entity.meshes.push(o); entity.signals.push(signal);
      entities.set(key,entity); if (key !== 'about') buildings.push(o);
    });
    // A single, invisible interaction surface covers the three northern growing
    // beds and their walking aisles. The spatial shader mask highlights only
    // this district, without changing the authored landscape geometry.
    const welcomeField = new THREE.Mesh(new THREE.PlaneGeometry(9.6,6.2),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));
    welcomeField.rotation.x = -Math.PI/2; welcomeField.position.set(0,.9,-13.5);
    welcomeField.userData.preview = 'about'; scene.add(welcomeField); buildings.push(welcomeField);
    let selected = '';
    highlight = key => {
      if (selected === key) return;
      entities.get(selected)?.signals.forEach(s => s.strength.value = 0);
      selected = entities.has(key) ? key : '';
      entities.get(selected)?.signals.forEach(s => s.strength.value = 1);
      effects.select(selected);world.dataset.effect=effects.name();
      world.dataset.activeEntity = selected; dirty = true;
    };
    highlight(active);

    // Camera yaw and roll are fixed. Pitch alone changes, so all grid edges stay screen-aligned.
    const target = new THREE.Vector3(0,0,HOME_TARGET_Z);
    const mapHalf = 20.765;
    let desiredAngle = HOME_ANGLE, angle = HOME_ANGLE, frame = 0, disposed = false, lastTime = performance.now();
    let halfX = 23, halfZ = 13, pixelsPerUnit = 28;
    function updateCamera() {
      const w = Math.max(1,host.clientWidth), h = Math.max(1,host.clientHeight);
      const hud=world!.querySelector<HTMLElement>('.atlas-hud')!;
      world!.style.setProperty('--atlas-preview-bottom',Math.ceil(h-hud.offsetTop+14)+'px');
      const radians = THREE.MathUtils.degToRad(angle), cosine = Math.cos(radians);
      // Fit both endpoints before applying the modest coupled scale change.
      // Portrait screens start closer, so tilting never needs a large zoom jump.
      const maximumScale = 1.18;
      const cover = Math.max(w*.92/(mapHalf*2), h*.90/(mapHalf*2*.5*maximumScale));
      // Directory tags are larger; calculate the camera frame using normal tags
      // and let the label placer resolve the directory's extra spacing.
      const referenceScale=labels.fit(w,h,cover*(1+.18*HOME_ANGLE/60));
      const base = referenceScale/(1+.18*HOME_ANGLE/60);
      // Top-down gets 20% more breathing room; Home and the 60° view retain their framing.
      const topDownScale = .8 + .2 * Math.min(angle / HOME_ANGLE, 1);
      pixelsPerUnit = base*(1+(maximumScale-1)*(angle/60))*topDownScale;
      halfX = w/(2*pixelsPerUnit); halfZ = h/(2*pixelsPerUnit*cosine);
      // Let a map edge move into the viewport by up to 9% of its width/height.
      // This gives breathing room while still preventing an empty map screen.
      const limitX = Math.max(0,mapHalf-halfX*.82), limitZ = Math.max(0,mapHalf-halfZ*.82);
      target.x = THREE.MathUtils.clamp(target.x,-limitX,limitX);
      target.z = THREE.MathUtils.clamp(target.z,-limitZ,limitZ);
      camera.left = -w/(2*pixelsPerUnit); camera.right = -camera.left;
      camera.top = h/(2*pixelsPerUnit); camera.bottom = -camera.top; camera.zoom = 1;
      camera.position.set(target.x,65*cosine,target.z+65*Math.sin(radians));
      // Explicit up vector also defines the exact top-down pole without lookAt's epsilon yaw.
      camera.up.set(0,Math.sin(radians),-cosine); camera.lookAt(target);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      const origin = new THREE.Vector3(0,0,0).project(camera);
      const east = new THREE.Vector3(5,0,0).project(camera), south = new THREE.Vector3(0,0,5).project(camera);
      world!.dataset.gridSkew = Math.max(Math.abs(east.y-origin.y),Math.abs(south.x-origin.x)).toFixed(6);
      world!.dataset.angle = angle.toFixed(2);
      world!.dataset.scale = pixelsPerUnit.toFixed(3);
      world!.dataset.targetX = target.x.toFixed(3); world!.dataset.targetZ = target.z.toFixed(3);
      world!.dataset.halfX = halfX.toFixed(3); world!.dataset.halfZ = halfZ.toFixed(3);
      labels.update(camera,w,h,[world!.querySelector<HTMLElement>('.atlas-title')!,world!.querySelector<HTMLElement>('.atlas-controls')!,world!.querySelector<HTMLElement>('.atlas-hud')!,world!.querySelector<HTMLElement>('.atlas-instruction')!]);
      dirty = true;
    }
    function setAngle(value: number) {
      desiredAngle = THREE.MathUtils.clamp(value,0,60);
      slider.value = desiredAngle.toFixed(1);
      slider.setAttribute('aria-valuetext', desiredAngle < .1 ? '正俯视，0度' : '从正俯视偏转'+Math.round(desiredAngle)+'度');
      readout.textContent = desiredAngle < .1 ? '俯视' : Math.round(desiredAngle)+'°';
      if (reduced.matches) { angle = desiredAngle; updateCamera(); }
      dirty = true;
    }
    function reset() {
      close();world!.classList.remove('is-directory');
      simpleButton.setAttribute('aria-pressed','false');status.textContent='EXPLORE // RH-0522';
      target.set(0,0,HOME_TARGET_Z); angle = desiredAngle = HOME_ANGLE; setAngle(HOME_ANGLE); updateCamera();
    }
    resetToHome=reset;relayout=updateCamera;
    slider.addEventListener('input', () => {
      const value=Number(slider.value);
      if(world!.classList.contains('is-directory'))directory(false);
      setAngle(value);
    });
    world.querySelector('[data-atlas-reset]')?.addEventListener('click',reset);
    canvas.addEventListener('wheel', e => {
      if(world!.classList.contains('is-directory'))return;
      e.preventDefault(); close();
      const delta = e.deltaY*(e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.clientHeight : 1);
      setAngle(desiredAngle-delta*.08);
    }, {passive:false});
    canvas.addEventListener('keydown', e => {
      if (e.key === 'Home') { reset(); e.preventDefault(); return; }
      if(world!.classList.contains('is-directory'))return;
      if (e.key === '+' || e.key === '=' || e.key === '-') {
        setAngle(desiredAngle+(e.key === '-' ? -5 : 5)); e.preventDefault(); return;
      }
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
      const distance = 35/pixelsPerUnit;
      target.x += e.key === 'ArrowLeft' ? -distance : e.key === 'ArrowRight' ? distance : 0;
      target.z += e.key === 'ArrowUp' ? -distance : e.key === 'ArrowDown' ? distance : 0;
      close(); updateCamera(); e.preventDefault();
    });
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
    function ray(x: number,y: number) {
      const rect = host.getBoundingClientRect();
      pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
    }
    function pick(x: number,y: number) {
      ray(x,y); const hit = raycaster.intersectObjects(buildings,false)[0];
      return hit ? hit.object.userData.preview ?? destinations[hit.object.name.split('_')[0]] : '';
    }
    const touches = new Map<number,{x:number;y:number;startX:number;startY:number;moved:boolean}>();
    let pinchDistance = 0;
    canvas.addEventListener('pointerdown', e => {
      if(world!.classList.contains('is-directory'))return;
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});
      if (touches.size>1) {
        const [a,b] = [...touches.values()]; pinchDistance = Math.hypot(a.x-b.x,a.y-b.y);
        touches.forEach(t => t.moved = true); close();
      }
    });
    canvas.addEventListener('pointermove', e => {
      if(world!.classList.contains('is-directory'))return;
      const touch = touches.get(e.pointerId);
      if (touch) {
        const oldX = touch.x, oldY = touch.y;
        touch.x = e.clientX; touch.y = e.clientY;
        if (Math.hypot(touch.x-touch.startX,touch.y-touch.startY)>5) touch.moved = true;
        if (touches.size>1) {
          const [a,b] = [...touches.values()], distance = Math.hypot(a.x-b.x,a.y-b.y);
          if (pinchDistance>0 && distance>0) setAngle(desiredAngle+Math.log(distance/pinchDistance)*70);
          pinchDistance = distance;
        } else if (touch.moved) {
          close(); host.classList.add('is-dragging'); host.classList.remove('is-entity-hovered');
          const before = new THREE.Vector3(), after = new THREE.Vector3();
          ray(oldX,oldY); raycaster.ray.intersectPlane(plane,before);
          ray(touch.x,touch.y); raycaster.ray.intersectPlane(plane,after);
          target.add(before.sub(after)); updateCamera();
        }
        return;
      }
      if (!hover.matches || e.pointerType !== 'mouse') return;
      const key = pick(e.clientX,e.clientY);
      host.classList.toggle('is-entity-hovered',Boolean(key));
      if (key) {
        show(key,false,e.clientX);
      } else {
        if (!pinned) { highlight(''); scheduleClose(); }
        else highlight(active);
      }
    });
    function finishPointer(e: PointerEvent, cancelled = false) {
      const touch = touches.get(e.pointerId); touches.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      host.classList.remove('is-dragging');
      if (touch && !cancelled && !touch.moved) {
        const key = pick(e.clientX,e.clientY);
        if (key) { const href = routes.get(key); if (href) location.assign(href); }
        else close();
      }
      if (!touches.size) pinchDistance = 0;
    }
    canvas.addEventListener('pointerup', e => finishPointer(e));
    canvas.addEventListener('pointercancel', e => finishPointer(e,true));
    canvas.addEventListener('pointerleave', () => {
      host.classList.remove('is-entity-hovered');
      if (!pinned && !touches.size) scheduleClose();
    });
    const observer = new ResizeObserver(() => {
      const w = host.clientWidth,h = host.clientHeight;
      if (w && h) { renderer!.setSize(w,h); updateCamera(); }
    });
    observer.observe(host); renderer.setSize(host.clientWidth,host.clientHeight); updateCamera();
    function render(now: number) {
      if (disposed) return;
      frame = requestAnimationFrame(render);
      const dt = Math.min(.06,(now-lastTime)/1000); lastTime = now;
      if (document.hidden || world!.classList.contains('is-simplified')) return;
      if (Math.abs(angle-desiredAngle)>.01) {
        angle += (desiredAngle-angle)*(1-Math.exp(-dt*14));
        if (Math.abs(angle-desiredAngle)<.02) angle = desiredAngle;
        updateCamera();
      }
      const motion=!reduced.matches&&!world!.classList.contains('is-directory');
      world!.dataset.effectMotion=String(Boolean(selected&&motion));
      if(effects.update(now/1000,motion))dirty=true;
      if (selected && motion) {
        entities.get(selected)?.signals.forEach(s => s.time.value = now/1000); dirty = true;
      }
      if (!dirty) return;
      dirty = false; renderer!.render(scene,camera);
    }
    const requestedDirectory=world.classList.contains('is-simplified');
    available = true; world.classList.add('is-ready'); status.textContent = 'EXPLORE // RH-0522';
    if(requestedDirectory)directory(true);
    const hashKeys: Record<string,string> = {skills:'skills','recent-stories':'recent','character-preview':'character','selected-works':'works'};
    const openHash = () => { const key = hashKeys[location.hash.slice(1)]; if (key) show(key,true); };
    openHash(); window.addEventListener('hashchange',openHash);
    render(performance.now());
    document.addEventListener('visibilitychange', () => dirty = true);
    window.addEventListener('pageshow', e => { if (e.persisted) { lastTime = performance.now(); dirty = true; } });
    window.addEventListener('pagehide', e => {
      if (e.persisted) return;
      disposed = true; clearTimeout(closeTimer); cancelAnimationFrame(frame); observer.disconnect();
      renderer?.dispose();
      scene.traverse(o => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Line)) return;
        o.geometry.dispose();
        (Array.isArray(o.material)?o.material:[o.material]).forEach(m => m.dispose());
      });
    });
  } catch (error) {
    console.warn('Miniature atlas unavailable; showing the destination index.',error);
    renderer?.dispose(); simple(true);
  }
}
