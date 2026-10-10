import * as THREE from 'three';
import atlasModel from '../data/atlas-model.json' with {type:'json'};
import {gardenCycle} from './atlas-garden-cycle';

/** Physical cues bound to the active district and its moving mechanisms. */
export function createAtlasAtmosphere(model:THREE.Object3D,camera:THREE.Camera) {
  const root=new THREE.Group();root.name='atlas-atmosphere';(model.parent??model).add(root);
  const cues=new Map<string,{group:THREE.Group;animate:(t:number)=>void}>();
  const teal=0x238f9b,gold=0xeac268,cream=0xffe7a1;
  const basic=(color=teal,opacity=.8)=>new THREE.MeshBasicMaterial({color,opacity,transparent:true,
    depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const plane=new THREE.PlaneGeometry(1,1);
  function soft(group:THREE.Group,color:number,opacity=.4) {
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{color:{value:new THREE.Color(color)},opacity:{value:opacity}},
      vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 q;uniform vec3 color;uniform float opacity;void main(){float r=length((q-.5)*2.0);float a=pow(max(0.0,1.0-r*r),2.0);gl_FragColor=vec4(color,a*opacity);}'
    });
    const mesh=new THREE.Mesh(plane,mat);group.add(mesh);return mesh;
  }
  function opacity(mesh:THREE.Mesh,value:number) {
    const mat=mesh.material as THREE.MeshBasicMaterial|THREE.ShaderMaterial;
    if(mat instanceof THREE.ShaderMaterial)mat.uniforms.opacity.value=value;else mat.opacity=value;
  }
  function tube(group:THREE.Group,points:THREE.Vector3[],color=teal,width=.04,alpha=.7):THREE.Mesh<THREE.BufferGeometry,THREE.Material> {
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,width,6,false),basic(color,alpha));
    group.add(mesh);return mesh;
  }
  function add(key:string,make:(group:THREE.Group)=>(t:number)=>void) {
    const group=new THREE.Group();group.name='atmosphere-'+key;group.visible=false;root.add(group);
    cues.set(key,{group,animate:make(group)});
  }
  function point(name:string,out:THREE.Vector3,fallback:THREE.Vector3,center=false) {
    const object=model.getObjectByName(name);
    if(!object)return out.copy(fallback);
    object.updateWorldMatrix(true,false);
    if(center&&object instanceof THREE.Mesh) {
      object.geometry.computeBoundingBox();return out.copy(object.geometry.boundingBox!.getCenter(out)).applyMatrix4(object.matrixWorld);
    }
    return out.setFromMatrixPosition(object.matrixWorld);
  }
  // A translucent shaft with feathered edges, independent of bitmap assets.
  function beam(group:THREE.Group,from:THREE.Vector3,to:THREE.Vector3,width:number,color=cream) {
    const mesh=new THREE.Mesh(plane,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{color:{value:new THREE.Color(color)},opacity:{value:.2}},
      vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 q;uniform vec3 color;uniform float opacity;void main(){float edge=pow(max(0.0,1.0-abs(q.x*2.0-1.0)),1.5);float end=sin(q.y*3.14159);gl_FragColor=vec4(color,edge*end*opacity);}'
    }));group.add(mesh);
    const midpoint=from.clone().add(to).multiplyScalar(.5),direction=from.clone().sub(to).normalize();
    const normal=new THREE.Vector3(),right=new THREE.Vector3(),matrix=new THREE.Matrix4();
    return (alpha:number)=>{
      normal.copy(camera.position).sub(midpoint).normalize();right.crossVectors(direction,normal).normalize();
      normal.crossVectors(right,direction).normalize();matrix.makeBasis(right,direction,normal);
      mesh.position.copy(midpoint);mesh.quaternion.setFromRotationMatrix(matrix);
      mesh.scale.set(width,from.distanceTo(to),1);opacity(mesh,alpha);
    };
  }
  add('friends',group=>{
    const rings=Array.from({length:3},()=>{
      const mesh=new THREE.Mesh(new THREE.RingGeometry(.97,1.025,64),basic(teal));group.add(mesh);return mesh;
    });
    const pulses=Array.from({length:3},()=>soft(group,cream,.8));
    const origin=new THREE.Vector3(),feed=new THREE.Vector3(),direction=new THREE.Vector3(),orientation=new THREE.Quaternion();
    return t=>{
      point('communications_dish',origin,new THREE.Vector3(16.3,4.05,3));
      point('communications_dish_yellow',feed,new THREE.Vector3(16.95,4.95,3.12),true);
      direction.copy(feed).sub(origin).normalize();orientation.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      rings.forEach((ring,i)=>{
        const p=(t/2.7+i/3)%1;
        // Alternate incoming and outgoing waves, anchored on the moving dish.
        const r=i%2?1.65*(1-p)+.7:.7+p*1.65;
        ring.position.copy(origin).addScaledVector(direction,.45+p*1.15);
        ring.quaternion.copy(orientation);ring.scale.setScalar(r);
        opacity(ring,.85*Math.sin(Math.PI*p));
      });
      pulses.forEach((pulse,i)=>{
        const p=(t/2+i/3)%1;pulse.position.copy(origin).addScaledVector(direction,.5+(1-p)*2.6);
        pulse.quaternion.copy(camera.quaternion);pulse.scale.setScalar(.28+.12*Math.sin(p*Math.PI));
        opacity(pulse,.8*Math.sin(p*Math.PI));
      });
    };
  });
  add('recent',group=>{
    const streams=Array.from({length:3},(_,i)=>tube(group,Array.from({length:16},(_,j)=>{
      const u=j/15;return new THREE.Vector3(u*1.8,.12*Math.sin(u*Math.PI),.18*Math.sin(u*Math.PI*2+i));
    }),i===1?gold:teal,.045,.65));
    streams.forEach((stream,i)=>{
      (stream.material as THREE.Material).dispose();
      stream.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
        uniforms:{color:{value:new THREE.Color(i===1?gold:teal)},opacity:{value:.65}},
        vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:'varying vec2 q;uniform vec3 color;uniform float opacity;void main(){gl_FragColor=vec4(color,opacity*pow(max(0.0,sin(q.x*3.14159)),.7));}'
      });
    });
    const shape=new THREE.Shape();shape.moveTo(-.18,0);shape.quadraticCurveTo(-.04,.12,.18,0);shape.quadraticCurveTo(.04,-.11,-.18,0);
    const leaves=Array.from({length:4},(_,i)=>{
      const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape,12),basic(i%2?gold:0x649b71));group.add(mesh);return mesh;
    });
    const chimeWind=Array.from({length:2},(_,i)=>tube(group,Array.from({length:18},(_,j)=>{
      const u=j/17;return new THREE.Vector3(-.5+u*.95,.055*Math.sin(u*Math.PI*2+i),.16*Math.sin(u*Math.PI));
    }),teal,.025,.55));
    const bell=new THREE.Vector3();
    return t=>{
      streams.forEach((stream,i)=>{
        const p=(t/4.2+i/3)%1;stream.position.set(-.3+p*6.2,3.45+i*.2,12.2+i*.65);
        opacity(stream,.75*Math.sin(Math.PI*p));
      });
      leaves.forEach((leaf,i)=>{
        const p=(t/5+i/4)%1;leaf.position.set(.3+p*5.2,3.35+.25*Math.sin(p*Math.PI*2+i),12.1+i*.55);
        leaf.quaternion.copy(camera.quaternion);leaf.rotateZ(t*1.6+i);opacity(leaf,.85*Math.sin(Math.PI*p));
      });
      point('camp_chime_steel',bell,new THREE.Vector3(4.55,1.45,14.5),true);
      chimeWind.forEach((stream,i)=>{
        const p=(t/2.8+i/2)%1;stream.position.copy(bell).add(new THREE.Vector3(-.3+p*.6,.07+i*.16,.12));
        opacity(stream,.6*Math.sin(Math.PI*p));
      });
    };
  });
  add('about',group=>{
    const centers=[[0,-12],[-3.2,-15.2],[3.2,-15.2]];
    const clouds=Array.from({length:12},()=>soft(group,0x8eb3bd));
    const rain=Array.from({length:42},()=>{const mesh=new THREE.Mesh(plane,basic(0x448f9e,.7));group.add(mesh);return mesh;});
    const rows=atlasModel.gardenRows;
    const wet=rows.map(row=>{const patch=soft(group,0x375852);patch.rotation.x=-Math.PI/2;patch.position.set(row.x,row.y+.008,row.z);patch.scale.set(2.35,.38,1);return patch;});
    const splashes=rows.map(row=>{const splash=new THREE.Mesh(new THREE.RingGeometry(.82,1,32),basic(teal));splash.rotation.x=-Math.PI/2;splash.position.set(row.x,row.y+.015,row.z);group.add(splash);return splash;});
    const sunshine=centers.map(([x,z])=>beam(group,new THREE.Vector3(x-2.2,6.5,z-1.8),new THREE.Vector3(x,.85,z),1.65));
    const harvest=Array.from({length:15},()=>soft(group,gold));
    return t=>{
      const cycle=gardenCycle(t);
      clouds.forEach((cloud,i)=>{const [x,z]=centers[Math.floor(i/4)];cloud.position.set(x+(i%4-1.5)*.48,4.2+.12*Math.sin(i+t*.4),z+.18*Math.sin(i*2));cloud.quaternion.copy(camera.quaternion);cloud.scale.set(1.6,1,1);opacity(cloud,.30*cycle.rain);});
      rain.forEach((drop,i)=>{
        const [x,z]=centers[i%3],p=(t*1.3+i/42)%1;
        drop.position.set(x+Math.sin(i*13)*1.1+p*.12,.9+(1-p)*3.15,z+Math.cos(i*7)*1.2);
        drop.quaternion.copy(camera.quaternion);drop.rotateZ(-.15);drop.scale.set(.045,.40,1);opacity(drop,.7*cycle.rain*Math.sin(p*Math.PI));
      });
      wet.forEach(patch=>opacity(patch,.26*cycle.wet));
      splashes.forEach((splash,i)=>{const p=(t*1.8+i/12)%1;splash.scale.setScalar(.04+p*.2);opacity(splash,.65*(1-p)*cycle.rain);});
      sunshine.forEach(shaft=>shaft(.24*cycle.sun));
      harvest.forEach((spark,i)=>{
        const [x,z]=centers[i%3],p=(t/1.4+i/15)%1;
        spark.position.set(x+Math.sin(i*3)*.85,.9+p*.65,z+Math.cos(i*2)*.9);
        spark.quaternion.copy(camera.quaternion);spark.scale.setScalar(.13);opacity(spark,.75*Math.sin(p*Math.PI)*cycle.harvest);
      });
    };
  });
  add('character',group=>{
    const shafts=[-1.7,0,1.7].map(x=>beam(group,new THREE.Vector3(x-2.5,7.5,-4.5),new THREE.Vector3(x,3.06,-2),.85));
    const glints=Array.from({length:5},()=>soft(group,cream));
    return t=>{
      shafts.forEach((shaft,i)=>shaft(.2+.12*Math.sin(t*.9+i)**2));
      glints.forEach((glint,i)=>{
        glint.position.set(-2.4+i*1.2,3.085,-2);
        glint.rotation.set(-Math.PI/2,0,0);glint.scale.set(.9,.7,1);
        opacity(glint,.35+.32*Math.sin(t*1.4-i*.7)**4);
      });
    };
  });
  add('timeline',group=>{
    const center=new THREE.Vector3(-11,0,10.2);
    const roofY=(r:number)=>2.78-(r-1.18)*.18/.46+.035;
    const ticks=Array.from({length:12},(_,i)=>{
      const a=i/12*Math.PI*2;
      return tube(group,[new THREE.Vector3(center.x+1.28*Math.cos(a),roofY(1.28),center.z+1.28*Math.sin(a)),
        new THREE.Vector3(center.x+1.58*Math.cos(a),roofY(1.58),center.z+1.58*Math.sin(a))],i%3?teal:gold,.045,.7);
    });
    const sweep=tube(group,Array.from({length:24},(_,i)=>{
      const a=i/23*.85;return new THREE.Vector3(1.43*Math.cos(a),0,1.43*Math.sin(a));
    }),teal,.06,.9);
    sweep.position.set(-11,roofY(1.43),10.2);
    const light=soft(group,cream);light.rotation.x=-Math.PI/2;
    return t=>{
      const a=t/6*Math.PI*2;sweep.rotation.y=-a;
      ticks.forEach((tick,i)=>opacity(tick,.35+.65*Math.max(0,Math.cos(a-i/12*Math.PI*2))**8));
      light.position.set(-11+1.43*Math.cos(a),roofY(1.43)+.015,10.2+1.43*Math.sin(a));light.scale.setScalar(.38);
    };
  });
  add('works',group=>{
    const shafts=[-11.3,-9.1].map(z=>beam(group,new THREE.Vector3(13,4.8,z),new THREE.Vector3(13,3.22,z),.65));
    const motes=Array.from({length:7},()=>soft(group,cream));
    return t=>{
      const opening=.5-.5*Math.cos(t/6*Math.PI*2);
      shafts.forEach(shaft=>shaft(.2+.16*opening));
      motes.forEach((mote,i)=>{
        const p=(t/4+i/7)%1;mote.position.set(12.6+.8*Math.sin(i*2),3.3+p*.9,-11.4+(i%2)*2.3);
        mote.quaternion.copy(camera.quaternion);mote.scale.setScalar(.13);opacity(mote,.8*Math.sin(p*Math.PI));
      });
    };
  });
  add('skills',group=>{
    const lamp=soft(group,cream),dust=Array.from({length:6},()=>soft(group,cream));
    const path=Array.from({length:65},(_,i)=>{const a=Math.PI*i/64;return new THREE.Vector3(-12+2.95*Math.cos(a),2.35+.85*Math.sin(a)+.09,-4.95);});
    const scan=tube(group,path,teal,.047,.75);
    const trace=soft(group,cream);
    const ventilation=Array.from({length:6},()=>soft(group,0xb6d2cf));
    const trolley=new THREE.Vector3(),hook=new THREE.Vector3();
    return t=>{
      point('workshop_carriage',trolley,new THREE.Vector3(-11.1,3.81,-3.7));
      point('workshop_sling_steel',hook,new THREE.Vector3(trolley.x,2.63,-3.7),true);
      lamp.position.copy(trolley);lamp.quaternion.copy(camera.quaternion);lamp.scale.setScalar(.35);opacity(lamp,.7);
      const progress=(t/3)%1,index=Math.min(path.length-1,Math.floor(progress*(path.length-1)));
      scan.geometry.setDrawRange(Math.max(0,Math.floor(progress*48)-13)*36,Math.min(14,Math.floor(progress*48)+1)*36);
      trace.position.copy(path[index]);trace.quaternion.copy(camera.quaternion);trace.scale.setScalar(.31);opacity(trace,.75);
      ventilation.forEach((puff,i)=>{const p=(t/2.8+(i%3)/3)%1;puff.position.set(-12+(i<3?-1.5-p*.5:1.5+p*.5),3.62+p*.85,-6.7+p*1.2);puff.quaternion.copy(camera.quaternion);puff.scale.setScalar(.28+p*.55);opacity(puff,.32*Math.sin(p*Math.PI));});
      dust.forEach((mote,i)=>{
        const p=(t/2.3+i/6)%1;mote.position.copy(hook).add(new THREE.Vector3(.22*Math.sin(i*2),-.2-p*.7,.22*Math.cos(i*2)));
        mote.quaternion.copy(camera.quaternion);mote.scale.setScalar(.12);opacity(mote,.75*Math.sin(p*Math.PI));
      });
    };
  });
  let selected='',dirty=false;
  function select(key:string) {
    if(key===selected)return;
    const old=cues.get(selected);if(old)old.group.visible=false;
    selected=cues.has(key)?key:'';dirty=true;
  }
  function update(t:number,motion:boolean) {
    const cue=cues.get(selected);
    if(cue){if(cue.group.visible!==motion)dirty=true;cue.group.visible=motion;if(motion)cue.animate(t);}
    const changed=dirty;dirty=false;return Boolean(cue&&motion)||changed;
  }
  function dispose() {
    root.parent?.remove(root);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);materials.add(o.material as THREE.Material);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  return {select,update,dispose,activeCount:()=>[...cues.values()].filter(c=>c.group.visible).length};
}
