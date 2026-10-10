import * as THREE from 'three';
import { createAtlasAtmosphere } from './atlas-atmosphere';

/** Play the authored model assemblies, never a second set of overlay props. */
export function createAtlasEffects(model: THREE.Object3D, clips: THREE.AnimationClip[], camera?:THREE.Camera) {
  const names:Record<string,string>={friends:'dish-acquisition',skills:'gantry-inspection',
    works:'glasshouse-ventilation',character:'pavilion-welcome',timeline:'oculus-iris',
    recent:'canvas-and-chimes',about:'garden-seasons'};
  const mixer=new THREE.AnimationMixer(model);
  const atmosphere=camera?createAtlasAtmosphere(model,camera):undefined;
  const actions=new Map(clips.filter(clip=>clip.name in names).map(clip=>[clip.name,mixer.clipAction(clip)]));
  for(const key of Object.keys(names))if(!actions.has(key))throw new Error('Atlas activity missing: '+key);
  let selected='',playing=false,last=0,changed=false;
  function stop() {
    // AnimationMixer restores the captured rest pose, including cloth and plants.
    mixer.stopAllAction();playing=false;changed=true;
  }
  function select(key:string) {
    if(key===selected)return;
    stop();selected=actions.has(key)?key:'';last=0;atmosphere?.select(selected);
  }
  function update(now:number,motion:boolean) {
    if(selected&&motion) {
      if(!playing){actions.get(selected)!.reset().play();playing=true;last=now;}
      mixer.update(Math.min(.08,Math.max(0,now-last)));last=now;
      atmosphere?.update(actions.get(selected)!.time,true);changed=false;return true;
    }
    if(playing)stop();
    const redraw=changed;changed=false;return Boolean(atmosphere?.update(0,false))||redraw;
  }
  return {select,update,name:()=>names[selected]??'',time:()=>actions.get(selected)?.time??0,
    atmosphereCount:()=>atmosphere?.activeCount()??0,dispose:()=>{stop();atmosphere?.dispose();mixer.uncacheRoot(model);}};
}
