import * as THREE from 'three';

/** Small local activity cues; the authored buildings and landscape stay still. */
export function createAtlasEffects(scene:THREE.Scene,camera:THREE.Camera) {
  type Effect={group:THREE.Group;animate:(time:number)=>void;name:string};
  const effects=new Map<string,Effect>();
  const cyan=0x00b9c5,mint=0x83dba9;
  function material(color=cyan,opacity=.8) {
    return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false});
  }
  function dot(group:THREE.Group,size=.06,color=cyan) {
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,12,8),material(color));
    group.add(mesh);return mesh;
  }
  function line(group:THREE.Group,points:THREE.Vector3[],color=cyan,opacity=.65) {
    const shape=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false}));
    group.add(shape);return shape;
  }
  function add(key:string,name:string,build:(group:THREE.Group)=>Effect['animate']) {
    const group=new THREE.Group();group.name='activity-'+key;group.visible=false;
    scene.add(group);effects.set(key,{group,name,animate:build(group)});
  }
  add('friends','signal-reception',group=>{
    const rings=Array.from({length:3},()=> {
      const ring=new THREE.Mesh(new THREE.RingGeometry(.87,.9,48),material(cyan,.5));
      ring.position.set(15,6.05,3);group.add(ring);return ring;
    });
    const beacon=dot(group,.08,mint);beacon.position.set(15,6.27,3);
    return t=>{
      rings.forEach((ring,i)=>{
        const p=(t/2.4+i/3)%1;
        ring.quaternion.copy(camera.quaternion);ring.scale.setScalar(1.25*(1-p)+.12);
        (ring.material as THREE.MeshBasicMaterial).opacity=.65*Math.sin(Math.PI*p);
      });
      beacon.scale.setScalar(.7+.5*Math.max(0,Math.sin(t*7)));
    };
  });
  add('skills','gantry-stitch',group=>{
    const path=Array.from({length:65},(_,i)=>new THREE.Vector3(-14.7+i/64*5.3,4.21,-3.7));
    line(group,path,mint,.4);const tracer=dot(group,.085);
    const sparks=[dot(group,.045),dot(group,.035)];
    return t=>{
      const u=(Math.sin(t*1.7)+1)/2;tracer.position.set(-14.7+u*5.3,4.21,-3.7);
      sparks.forEach((spark,i)=>{spark.position.copy(tracer.position);spark.position.y-=.16*(i+1);spark.scale.setScalar(.5+.5*Math.sin(t*5+i));});
    };
  });
  add('works','drawing-stroke',group=>{
    const points=Array.from({length:75},(_,i)=>{
      const x=-1.8+i/74*3.6;
      return new THREE.Vector3(13+x,1.5+1.74*Math.sqrt(1-(x/2.34)**2)+.09,-10.2+.25*Math.sin(i/74*Math.PI*2));
    });
    const stroke=line(group,points,cyan,.7),pen=dot(group,.07,mint);
    return t=>{
      const p=(t/3.3)%1,index=Math.floor(p*(points.length-1));
      stroke.geometry.setDrawRange(0,index+1);pen.position.copy(points[index]);
      (stroke.material as THREE.LineBasicMaterial).opacity=.8*(1-Math.max(0,(p-.8)*5));
    };
  });
  add('character','identity-orbit',group=>{
    const points=Array.from({length:65},(_,i)=>new THREE.Vector3(2.25+.65*Math.cos(i/64*Math.PI*2),3.05,.9+.65*Math.sin(i/64*Math.PI*2)));
    line(group,points,mint,.45);const glints=[dot(group,.065),dot(group,.04)];
    return t=>glints.forEach((glint,i)=>{const a=t*1.8+i*Math.PI;glint.position.set(2.25+.65*Math.cos(a),3.05,.9+.65*Math.sin(a));});
  });
  add('timeline','clock-sweep',group=>{
    const ring=Array.from({length:65},(_,i)=>new THREE.Vector3(-11+.52*Math.cos(i/64*Math.PI*2),2.96,10.2+.52*Math.sin(i/64*Math.PI*2)));
    line(group,ring,mint,.45);
    const hand=line(group,[new THREE.Vector3(-11,2.98,10.2),new THREE.Vector3(-10.5,2.98,10.2)]);
    const tip=dot(group,.045);
    return t=>{
      const a=t*.9,x=-11+.5*Math.cos(a),z=10.2+.5*Math.sin(a);
      const p=hand.geometry.getAttribute('position') as THREE.BufferAttribute;
      p.setXYZ(1,x,2.98,z);p.needsUpdate=true;tip.position.set(x,2.98,z);
    };
  });
  add('recent','camp-fireflies',group=>{
    const lights=[dot(group,.045,0xdbed8a),dot(group,.04,mint),dot(group,.035,cyan)];
    return t=>lights.forEach((light,i)=>{
      const a=t*1.4+i*Math.PI*2/3;
      light.position.set(3+1.6*Math.cos(a),3.02+.13*Math.sin(t*2+i),13+.7*Math.sin(a));
      (light.material as THREE.MeshBasicMaterial).opacity=.5+.4*Math.sin(t*2+i)**2;
    });
  });
  add('about','seedling-lights',group=>{
    const lights=[dot(group,.045,mint),dot(group,.045,mint),dot(group,.045,mint)];
    return t=>lights.forEach((light,i)=>{
      const p=(t/3+i/3)%1;
      const cx=[0,-3.2,3.2][i],z=[-11.8,-15,-15][i];
      light.position.set(cx-1.05+p*2.1,.92,z);
      (light.material as THREE.MeshBasicMaterial).opacity=.75*Math.sin(Math.PI*p);
    });
  });
  let selected='',start=0;
  function select(key:string) {
    if(selected===key)return;
    const previous=effects.get(selected);if(previous)previous.group.visible=false;
    selected=effects.has(key)?key:'';start=performance.now()/1000;
  }
  function update(now:number,motion:boolean) {
    const effect=effects.get(selected);if(!effect)return false;
    effect.group.visible=motion;
    if(motion)effect.animate(Math.max(0,now-start));
    return motion;
  }
  return {select,update,name:()=>effects.get(selected)?.name??''};
}
