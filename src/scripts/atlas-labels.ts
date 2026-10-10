import { Vector3, type OrthographicCamera } from 'three';

export const HOME_ANGLE = 58;
export const HOME_TARGET_Z = -3.2;
const NS = 'http://www.w3.org/2000/svg';
type Rect = {left:number;top:number;right:number;bottom:number};
const intersects = (a:Rect,b:Rect) => a.left<b.right+5 && a.right>b.left-5 && a.top<b.bottom+5 && a.bottom>b.top-5;

export function createAtlasLabels(elements: HTMLAnchorElement[], svg: SVGSVGElement) {
  const nodes = elements.map(element => {
    const point = new Vector3(Number(element.dataset.x),Number(element.dataset.y),Number(element.dataset.z));
    const anchor = point.clone(); anchor.y -= .5;
    const line = document.createElementNS(NS,'line'); svg.append(line);
    return {element,point,anchor,line,width:element.offsetWidth,height:element.offsetHeight};
  });
  // Frame the default overview using the actual tag sizes, including the short
  // laptop viewport and portrait screens. Scale still changes by only 18%.
  function fit(width:number,height:number,cover:number) {
    const c = Math.cos(HOME_ANGLE*Math.PI/180),s = Math.sin(HOME_ANGLE*Math.PI/180);
    const edge = width<760 ? 14 : 76;
    const top = width<760 ? 130 : 56;
    const bottom = 132;
    let result = cover;
    for(const node of nodes) {
      if(!node.element.closest('[data-atlas]')!.classList.contains('is-directory')) {
        node.width=node.element.offsetWidth;node.height=node.element.offsetHeight;
      }
      const w = node.width,h = node.height;
      if(node.point.x) result = Math.min(result,(width/2-edge-w/2)/Math.abs(node.point.x));
      const q = (node.point.z-HOME_TARGET_Z)*c-node.point.y*s;
      if(q<0) result = Math.min(result,(height/2-top-h)/-q);
      if(q>0) result = Math.min(result,(height/2-bottom)/q);
    }
    return Math.max(3,result);
  }
  const p = new Vector3(),a = new Vector3();
  function update(camera:OrthographicCamera,width:number,height:number,obstacles:HTMLElement[]) {
    // The control column uses a centered transform, so its actual bounds are
    // read relative to the canvas rather than its untransformed offsetTop.
    const hostRect = svg.getBoundingClientRect();
    const fixed:Rect[]=obstacles.filter(el=>el.offsetWidth&&el.offsetHeight).map(el=>{
      const r=el.getBoundingClientRect();
      return {left:r.left-hostRect.left,top:r.top-hostRect.top,right:r.right-hostRect.left,bottom:r.bottom-hostRect.top};
    });
    const placed:Rect[] = [];
    const shifts = [0,-24,24,-48,48,-72,72,-96,96,-120,120];
    for(const node of nodes) {
      p.copy(node.point).project(camera); a.copy(node.anchor).project(camera);
      const x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
      const ax=(a.x*.5+.5)*width,ay=(-a.y*.5+.5)*height;
      const w=node.element.offsetWidth,h=node.element.offsetHeight;
      const visible=p.x>-.99&&p.x<.99&&p.y>-.97&&p.y<.97;
      let best={x,y,score:Infinity};
      if(visible) {
        for(const dy of shifts) for(const dx of shifts) {
          const cx=Math.max(w/2+12,Math.min(width-w/2-12,x+dx));
          const cy=Math.max(h+16,Math.min(height-132,y+dy));
          const rect={left:cx-w/2,right:cx+w/2,top:cy-h,bottom:cy};
          const clashes=[...fixed,...placed].filter(b=>intersects(rect,b)).length;
          const score=clashes*1000000+(cx-x)**2+(cy-y)**2;
          if(score<best.score)best={x:cx,y:cy,score};
        }
        placed.push({left:best.x-w/2,right:best.x+w/2,top:best.y-h,bottom:best.y});
      }
      node.element.style.left=best.x+'px';node.element.style.top=best.y+'px';
      node.element.style.opacity=visible?'1':'0';node.element.style.pointerEvents=visible?'auto':'none';
      node.element.tabIndex=visible?0:-1;node.element.setAttribute('aria-hidden',String(!visible));
      node.element.dataset.anchorX=ax.toFixed(2);node.element.dataset.anchorY=ay.toFixed(2);
      node.line.style.display=visible?'':'none';
      node.line.setAttribute('x1',String(ax));node.line.setAttribute('y1',String(ay));
      node.line.setAttribute('x2',String(best.x));
      node.line.setAttribute('y2',String(ay<best.y-h ? best.y-h : best.y));
    }
  }
  return {nodes,fit,update};
}
