"""Deterministic, detailed architectural miniature. Blender 5.2.

Run: blender --background --factory-startup --python art/build_atlas.py
Coordinate contract: authored XY ground / Z up -> GLB X,-Y ground / Y up.
All foliage, roads, roofs, river banks and equipment are authored geometry.
"""
import bpy, bmesh, math, random, json, sys
from pathlib import Path
from collections import defaultdict
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models'
PRIVATE = ROOT.parent / 'workbench-private' / 'atlas-art'
OUT.mkdir(parents=True, exist_ok=True)
PRIVATE.mkdir(parents=True, exist_ok=True)
random.seed(522)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
BUCKETS = defaultdict(lambda: [[], []])
MATS = {}
CACHE = {}
ZONE = 'landscape'

def material(name, hexcolor, rough=.65, metal=0, emission=0):
    c = tuple(int(hexcolor[i:i+2],16)/255 for i in (0,2,4))
    m = bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    # Convert design sRGB colors to linear for consistent GLB/browser rendering.
    linear=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
    p.inputs['Base Color'].default_value=(*linear,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*linear,1)
        p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*linear,1); MATS[name]=m

for args in [
 ('porcelain','F4F3E7',.48),('stone','D8DBCA',.82),('edge','AAB8AD',.67),
 ('steel','849B96',.36,.6),('dark','314B49',.52,.2),('glass','67B8BB',.2,.38),
 ('glass_dark','2B6D72',.25,.4),('sun','E3DB72',.48),('yellow','D6BD49',.48),
 ('mint','74C9B0',.56),('clay','B97C60',.8),('wood','AE956B',.85),
 ('bark','6A7960',.94),('water','499F9F',.25,.15),('water_light','6BBDB1',.32),
 ('road','BDC2AD',.85),('line','F4ECC7',.83),('flower','EBC69C',.72),
 ('signal','DFFF48',.4,0,.2),('light','BCF5DA',.38,0,.65),
 ('soil','B7B39A',.94),('sand','DDCFAB',.98)]: material(*args)
for i,c in enumerate(['7FAD7C','9ABC83','B3C895','6B9F82','8BB59C','C3CCA6']): material('leaf'+str(i),c,.95)
for i,c in enumerate(['B8C594','BBC999','BFCCA0','C4CFA7','CBD3B2','A5BD98','A0B694','AEC09A','D5CFB5','DCD3BD','C8C5AC','B8B9A1','A7BCAC','B3C5B5','BECDBC','C4D1C0']): material('land'+str(i),c,.98)

def emit(verts, faces, mat, zone=None):
    v,f=BUCKETS[(zone or ZONE,mat)]; n=len(v); v.extend(verts); f.extend(tuple(n+i for i in face) for face in faces)

def box(p, size, mat='porcelain', bevel=.04, rot=0):
    key=('box',tuple(round(s,4) for s in size),round(bevel,4))
    if key not in CACHE:
        bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1)
        for v in bm.verts: v.co.x*=size[0]; v.co.y*=size[1]; v.co.z*=size[2]
        if bevel: bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(bevel,min(size)*.22),segments=2,affect='EDGES')
        bm.verts.ensure_lookup_table(); bm.verts.index_update(); CACHE[key]=([tuple(v.co) for v in bm.verts], [tuple(v.index for v in f.verts) for f in bm.faces]); bm.free()
    vs,fs=CACHE[key]; co=math.cos(rot); si=math.sin(rot)
    emit([(p[0]+x*co-y*si,p[1]+x*si+y*co,p[2]+z) for x,y,z in vs],fs,mat)

def lathe(p, profile, mat, segments=24, axis=None):
    vs=[]; fs=[]
    q=Vector((0,0,1)).rotation_difference(Vector(axis).normalized()) if axis else None
    for r,z in profile:
        for i in range(segments):
            a=i*math.tau/segments; v=Vector((r*math.cos(a),r*math.sin(a),z))
            if q: v=q@v
            vs.append(tuple(Vector(p)+v))
    for j in range(len(profile)-1):
        for i in range(segments): fs.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    fs.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))]); emit(vs,fs,mat)

def rod(a,b,r,mat='steel',segments=12):
    d=Vector(b)-Vector(a); lathe(a,[(r,0),(r,d.length)],mat,segments,d)

def sphere(p,size,mat,seed=0):
    key=('sphere',)
    if key not in CACHE:
        bm=bmesh.new(); bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=8,radius=1)
        bm.verts.ensure_lookup_table(); bm.verts.index_update(); CACHE[key]=([tuple(v.co) for v in bm.verts],[tuple(v.index for v in f.verts) for f in bm.faces]); bm.free()
    vs,fs=CACHE[key]
    emit([(p[0]+x*size[0]*(1+.09*math.sin(z*7+seed)),p[1]+y*size[1]*(1+.08*math.cos(x*6+seed)),p[2]+z*size[2]) for x,y,z in vs],fs,mat)

def tube(points,r,mat,segments=8):
    vs=[]; fs=[]
    for j,p in enumerate(points):
        direction=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        q=Vector((0,0,1)).rotation_difference(direction.normalized())
        for k in range(segments):
            a=math.tau*k/segments; vs.append(tuple(Vector(p)+q@Vector((r*math.cos(a),r*math.sin(a),0))))
    for j in range(len(points)-1):
        for k in range(segments): fs.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
    emit(vs,fs,mat)

def river_x(y): return 9.0+2.0*math.sin(y*.22)+.5*math.sin(y*.54)
def river_width(y): return 1.35+.35*math.sin(y*.31)
def height(x,y):
    ridge=2.5*math.exp(-((x+14)**2/26+(y-12)**2/50))
    hill=1.3*math.exp(-((x+13)**2/24+(y+13)**2/30))
    h=.5+ridge+hill+.14*math.sin(x*.5)*math.cos(y*.4)+.06*math.sin(x*1.6+y*.8)
    d=abs(x-river_x(y)); w=river_width(y)
    if d<w: return .12
    if d<w+.65: h=.18+(h-.18)*(d-w)/.65
    # Roads and building sites have engineered level pads.
    for px,py,sx,sy,target in [(0,0,7.5,6.8,.42),(12.8,10.2,3.4,3.2,.55),(-12,6.2,4.1,3.4,.55),(-11,-10.2,4.1,3.7,.55),(3,-13,3.4,2.5,.55),(15,-3,2.8,2.8,.55)]:
        distance=max(abs(x-px)-sx,abs(y-py)-sy)
        if distance<0: h=target
        elif distance<1.1:
            t=distance/1.1; t=t*t*(3-2*t); h=target*(1-t)+h*t
    return h

def terrain():
    global ZONE
    ZONE='terrain'
    step=3.2; half=step/2-.035; n=16
    for gx in range(-6,7):
        for gy in range(-6,7):
            if abs(gx)+abs(gy)>10 or (abs(gx)==6 and abs(gy)>3): continue
            cx=gx*step; cy=gy*step; vs=[]; fs=[]
            for j in range(n+1):
                for i in range(n+1):
                    x=cx-half+2*half*i/n; y=cy-half+2*half*j/n; vs.append((x,y,height(x,y)))
            base=8 if gx<0 and gy<0 else (12 if gx>1 and gy<0 else (4 if gx<-2 and gy>0 else 0))
            for j in range(n):
                for i in range(n):
                    k=j*(n+1)+i; x=vs[k][0]; y=vs[k][1]
                    mi=base+int((math.sin(x*.7)+math.cos(y*.6)+2)*.8)%4
                    emit([vs[k],vs[k+1],vs[k+n+2],vs[k+n+1]],[(0,1,2,3)],'land'+str(mi))
            rim=[j*(n+1) for j in range(n+1)]+[n*(n+1)+i for i in range(1,n+1)]+[j*(n+1)+n for j in range(n-1,-1,-1)]+[i for i in range(n-1,0,-1)]
            rv=[vs[k] for k in rim]; count=len(rv); rv += [(x,y,-.12) for x,y,z in rv]
            emit(rv,[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]+[tuple(range(count,2*count))],'edge')
            if abs(gx)<=2 and abs(gy)<=1:
                for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]: box((cx+sx*(half-.12),cy+sy*(half-.12),height(cx,cy)+.015),(.08,.08,.018),'line',.008)
    # A continuous meandering water ribbon, deliberately above its carved bed.
    vs=[]
    for i in range(301):
        y=-20.7+i*41.4/300; x=river_x(y); w=river_width(y)
        vs.extend([(x-w,y,.205),(x+w,y,.205)])
    emit(vs,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(300)],'water')
    for sign in [-1,1]:
        points=[]
        for i in range(151):
            y=-20.65+i*41.3/150; points.append((river_x(y)+sign*(river_width(y)-.06),y,.22))
        tube(points,.022,'water_light',6)
    # Carefully graded access roads connect the miniature destinations.
    routes=[[(0,0),(-8,0),(-12,3),(-12,6)],[(0,0),(0,8),(5,11),(13,10)],[(0,0),(-5,-7),(-11,-10)],[(0,0),(0,-8),(3,-13)],[(0,0),(7,-3),(15,-3)]]
    for route in routes:
        points=[]
        for a,b in zip(route,route[1:]):
            for i in range(20):
                t=i/20; x=a[0]*(1-t)+b[0]*t; y=a[1]*(1-t)+b[1]*t; points.append((x,y,max(.48,height(x,y))+.035))
        end=route[-1]; points.append((end[0],end[1],max(.48,height(*end))+.035));vs=[]
        for i,p in enumerate(points):
            d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            if d.length<.001: d=Vector((1,0,0))
            perp=Vector((-d.y,d.x,0)).normalized()*.34
            vs.extend([tuple(Vector(p)-perp),tuple(Vector(p)+perp)])
        emit(vs,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)],'road')
        for i,p in enumerate(points):
            if i%7==0: box((p[0],p[1],p[2]+.01),(.1,.18,.015),'line',.005)

def stairs(x,y,z,width,count=5,d=.22,h=.11):
    for i in range(count): box((x,y-i*d,z+(count-i)*h/2),(width,d+.025,(count-i)*h),'stone',.025)

def railing(a,b,z):
    length=(Vector(b)-Vector(a)).length; n=max(2,int(length/.45))
    for i in range(n+1):
        t=i/n; x=a[0]*(1-t)+b[0]*t; y=a[1]*(1-t)+b[1]*t
        box((x,y,z+.04),(.13,.13,.08),'dark',.01); rod((x,y,z),(x,y,z+.62),.025)
    for h in [.28,.62]: rod((a[0],a[1],z+h),(b[0],b[1],z+h),.025)

def terrace(x,y,w,d,z):
    box((x,y,z+.12),(w,d,.24),'stone',.06)
    for i in range(int(w/.6)):
        box((x-w/2+.3+i*.6,y,z+.246),(.012,d-.12,.012),'edge',.002)

def roof_ribs(x,y,w,d,z,mat='porcelain'):
    for i in range(int(w/.25)+1): box((x-w/2+i*.25,y,z),(.032,d,.055),mat,.01)

def windows(x,y,w,z,h=.7):
    box((x,y,z),(w,.045,h),'glass_dark',.015)
    for i in range(int(w/.45)+1): box((x-w/2+i*.45,y-.033,z),(.035,.055,h+.06),'porcelain',.01)
    for dz in [-h/2,h/2]: box((x,y-.033,z+dz),(w+.04,.065,.04),'steel',.008)

def solar(x,y,z,w=1,d=.7):
    box((x,y,z),(w+.1,d+.1,.09),'steel',.015)
    box((x,y,z+.05),(w,d,.025),'glass_dark',.005)
    for i in range(1,5): box((x-w/2+w*i/5,y,z+.066),(.012,d,.007),'glass',.001)
    box((x,y,z+.067),(w,.012,.007),'glass',.001)

def lamp(x,y,z):
    box((x,y,z+.05),(.22,.22,.1),'stone',.025)
    rod((x,y,z),(x,y,z+1.05),.045,'dark')
    box((x,y,z+1.07),(.18,.18,.22),'light',.035)
    box((x,y,z+1.22),(.25,.25,.055),'steel',.02)

def tree(x,y,scale=1,seed=0):
    z=height(x,y); rng=random.Random(seed); h=1.5*scale
    rod((x,y,z),(x+.06*scale,y+.03*scale,z+h),.07*scale,'bark')
    for i in range(7):
        a=i*2.4; r=(.32+.18*rng.random())*scale
        end=(x+math.cos(a)*r,y+math.sin(a)*r,z+h*(.65+.05*i))
        rod((x,y,z+h*.5),end,.024*scale,'bark',7)
        sphere((end[0],end[1],end[2]+.2*scale),(.42*scale,.36*scale,.45*scale),'leaf'+str(seed%6),seed+i)
    sphere((x,y,z+h+.28*scale),(.42*scale,.42*scale,.4*scale),'leaf'+str((seed+1)%6),seed)

def plantings():
    global ZONE
    ZONE='botanical'
    reserved=[(0,0,8,7),(-12,6,4,3),(13,10,3,3),(-11,-10,4,3),(3,-13,3,2),(15,-3,3,3)]
    for i in range(430):
        x=random.uniform(-19.5,19.5); y=random.uniform(-19.5,19.5)
        if abs(x/3.2)+abs(y/3.2)>9.7 or abs(x-river_x(y))<river_width(y)+.45: continue
        if any(abs(x-a)<w and abs(y-b)<d for a,b,w,d in reserved): continue
        if abs(x)<.65 or (abs(y+3)<.55 and x>0): continue
        if i%3==0: tree(x,y,random.uniform(.45,1.05),i)
        else:
            z=height(x,y); s=random.uniform(.12,.28)
            sphere((x,y,z+s*.6),(s*1.4,s,s*.75),'leaf'+str(i%6),i)
            if i%5==0:
                for j in range(3): sphere((x+random.uniform(-s,s),y+random.uniform(-s,s),z+s*1.2),(.045,.045,.03),'flower',j)
    # Sedges and fine reeds follow both banks, not scattered in open water.
    for i in range(220):
        y=random.uniform(-19,19); sign=random.choice([-1,1]); x=river_x(y)+sign*(river_width(y)+random.uniform(.25,.7)); z=height(x,y)
        for j in range(3):
            a=j*2.1; h=random.uniform(.2,.5)
            tube([(x,y,z),(x+.04*math.cos(a),y+.04*math.sin(a),z+h*.6),(x+.12*math.cos(a),y+.12*math.sin(a),z+h)],.012,'leaf3',5)
    for i in range(55):
        x=random.uniform(-19,18); y=random.uniform(-18,19)
        if any(abs(x-a)<w and abs(y-b)<d for a,b,w,d in reserved): continue
        if abs(x/3.2)+abs(y/3.2)>9.6: continue
        s=random.uniform(.18,.5); sphere((x,y,height(x,y)+s*.3),(s,s*.6,s*.4),'stone',i)

def pavilion():
    global ZONE; ZONE='pavilion'; z=.42
    terrace(0,0,9.8,8.2,z)
    box((0,.6,z+.8),(5.8,3.8,1.3),'porcelain',.15)
    windows(0,-1.32,4.9,z+.95,.9)
    # Clerestory sawtooth canopy: individual rising roof planes with glazed seams.
    for i in range(4):
        x=-3.2+i*1.6
        vs=[(x,-2.4,z+1.85),(x+1.58,-2.4,z+2.45),(x+1.58,3,z+2.45),(x,3,z+1.85),
            (x,-2.4,z+1.74),(x+1.58,-2.4,z+2.34),(x+1.58,3,z+2.34),(x,3,z+1.74)]
        emit(vs,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(1,5,6,2)],'porcelain')
        box((x+1.55,.3,z+2.03),(.055,5.4,.58),'glass',.015)
        for y in [-1.8,-.5,.8,2.1]: rod((x,y,z+1.87),(x+1.56,y,z+2.44),.018,'steel')
    for x in [-3.15,3.15]:
        canopy_height=1.85+((x+3.2)%1.6)/1.6*.6-.09
        for y in [-2.25,2.5]:
            length=canopy_height-.24
            box((x,y,z+.24+length/2),(.17,.17,length),'steel',.035)
            box((x,y,z+.27),(.32,.32,.06),'dark',.02)
        box((x,.12,z+canopy_height),(.17,5.15,.13),'steel',.025)
    # Curved arrival canopy and real seated stair treads.
    lathe((0,-3.2,z+.25),[(1.45,0),(1.5,.13),(1.42,.26)],'stone',48)
    stairs(0,-4.6,z,2.4,4)
    for x in [-4.2,4.2]:
        box((x,0,z+.48),(.7,3.1,.5),'porcelain',.07)
        for j in range(8): sphere((x,-1.2+j*.35,z+.78),(.24,.23,.21),'leaf2',j)
        lamp(x,-3.1,z+.24)
    for x in [-2.4,-1.2,0,1.2,2.4]:
        solar(x,2,z+2.55,.85,.65)
        for dx in [-.32,.32]:
            for dy in [-.2,.2]:
                px=x+dx; roof_z=z+1.85+((px+3.2)%1.6)/1.6*.6
                rod((px,2+dy,roof_z),(px,2+dy,z+2.505),.025,'steel')
    for x in [-3.8,3.8]:
        railing((x,-2.9),(x,2.9),z+.24)
    # The character's paw emblem on an inset display, not a borrowed game logo.
    box((0,-1.4,z+1.38),(1.25,.055,.68),'dark',.06)
    for x,dz,s in [(-.3,.15,.105),(0,.23,.11),(.3,.15,.105),(0,-.12,.2)]:
        sphere((x,-1.46,z+1.38+dz),(s,.035,s*.9),'signal')
    # Main utility island: louver panels, tanks, pipes, loading details.
    box((3.3,2.7,z+.7),(1.3,1.1,.9),'dark',.08)
    for i in range(9): box((3.3,2.12,z+.45+i*.065),(1.08,.07,.025),'steel',.006)
    for x in [-3.9,-3.2]: lathe((x,2.6,z+.25),[(.27,0),(.3,.08),(.3,.8),(.2,.92)],'porcelain',24)
    tube([(-3.6,2.6,z+1.12),(-3.6,3,z+1.12),(-3,3,z+1.12),(-3,3,z+.5)],.045,'steel')

def workshop():
    global ZONE; ZONE='workshop'; x=-12; y=6.2; z=.55
    terrace(x,y,7.4,5.8,z)
    box((x,y,z+1.05),(5.5,3.5,1.65),'porcelain',.12)
    # Corrugated barrel roof with smooth continuous arch and structural ribs.
    vs=[]; fs=[]; n=32
    for j in range(n+1):
        a=math.pi*j/n; px=x+2.95*math.cos(a); pz=z+1.8+.85*math.sin(a)
        vs.extend([(px,y-2,pz),(px,y+2,pz)])
    emit(vs,[(j*2,j*2+1,j*2+3,j*2+2) for j in range(n)],'steel')
    for iy in range(17):
        points=[(x+2.95*math.cos(math.pi*j/32),y-2+iy*.25,z+1.8+.85*math.sin(math.pi*j/32)+.035) for j in range(33)]
        tube(points,.025,'porcelain')
    windows(x-1.55,y-1.79,1.85,z+1.1,.6)
    box((x+.8,y-1.82,z+.86),(1.5,.08,1.2),'dark',.035)
    for i in range(10): box((x+.8,y-1.88,z+.32+i*.12),(1.47,.035,.025),'steel',.005)
    box((x+.8,y-2.1,z+.35),(2.1,.65,.22),'yellow',.03)
    stairs(x+.8,y-2.5,z+.24,1.8,2)
    # Roof exhausts, tanks, workbench and fabric rolls.
    for ix in [-1.5,1.5]:
        lathe((x+ix,y+.5,z+2.5),[(.22,0),(.22,.45),(.3,.48),(.3,.55)],'dark')
    for i in range(3):
        lathe((x-3,y+.7+i*.6,z+.24),[(.27,0),(.3,.05),(.3,.8),(.27,.85)],'mint')
        tube([(x-3,y+.7+i*.6,z+1.09),(x-2.8,y+.7+i*.6,z+1.22),(x-2.7,y+.7+i*.6,z+1.7)],.04,'steel')
    box((x+3,y,z+1),(1.1,2.4,.1),'wood',.035)
    for iy in [-.9,.9]:
        for ix in [-.4,.4]: rod((x+3+ix,y+iy,z+.24),(x+3+ix,y+iy,z+.95),.04,'dark')
    for i in range(5): rod((x+3.1,y-.9+i*.4,z+1.05),(x+3.1,y-.9+i*.4,z+1.38),.14,['sun','mint','glass','flower','porcelain'][i],20)
    # A supported gantry with beam flanges, cable and hook.
    for ix in [-3,2.8]:
        box((x+ix,y-2.5,z+.28),(.45,.45,.1),'dark',.035)
        box((x+ix,y-2.5,z+1.9),(.13,.16,3.1),'yellow',.025)
    box((x-.1,y-2.5,z+3.46),(6,.18,.28),'yellow',.03)
    for dz in [-.15,.15]: box((x-.1,y-2.5,z+3.46+dz),(6,.34,.045),'dark',.012)
    box((x+.9,y-2.5,z+3.26),(.45,.36,.3),'steel',.035)
    rod((x+.9,y-2.5,z+3.11),(x+.9,y-2.5,z+2.24),.013,'dark',6)
    tube([(x+.9,y-2.5,z+2.24),(x+.9,y-2.5,z+2.05),(x+1.05,y-2.5,z+2.02),(x+1.1,y-2.5,z+2.13)],.035,'steel')
    for ix in [-3.2,3.2]: lamp(x+ix,y-2.7,z+.24)

def gallery():
    global ZONE; ZONE='gallery'; x=13; y=10.2; z=.55
    terrace(x,y,6.4,5.8,z)
    for ix in [-2.7,2.7]:
        for iy in [-2.4,2.4]: box((x+ix,y+iy,.24),(.3,.3,.65),'stone',.03)
    box((x,y,z+.6),(4.6,3.8,.7),'porcelain',.1)
    # Botanical gallery with continuous rounded glazed vault.
    vs=[]; n=32
    for i in range(n+1):
        a=math.pi*i/n; vs.extend([(x+2.3*math.cos(a),y-1.9,z+.95+1.7*math.sin(a)),(x+2.3*math.cos(a),y+1.9,z+.95+1.7*math.sin(a))])
    emit(vs,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(n)],'glass')
    for j in range(9):
        tube([(x+2.34*math.cos(math.pi*i/32),y-1.95+j*.49,z+.95+1.74*math.sin(math.pi*i/32)) for i in range(33)],.035,'porcelain')
    for a in [.2,.7,1.2,1.7,2.2,2.7]: rod((x+2.34*math.cos(a),y-2,z+.95+1.74*math.sin(a)),(x+2.34*math.cos(a),y+2,z+.95+1.74*math.sin(a)),.025,'steel')
    windows(x,y-1.93,3.5,z+1.08,1.4)
    box((x,y-2.02,z+1.05),(.7,.055,1.45),'sun',.035)
    stairs(x,y-3.01,z,2,2)
    for ix in [-2.7,2.7]:
        for iy in [-1.8,-.6,.6,1.8]:
            box((x+ix,y+iy,z+.34),(.4,.8,.25),'stone',.025)
            sphere((x+ix,y+iy,z+.67),(.22,.35,.27),'leaf3')
    for i in range(4):
        box((x-2+i*1.3,y+2.4,z+.52),(.8,.28,.6),'porcelain',.04)
        box((x-2+i*1.3,y+2.24,z+.55),(.64,.025,.42),['mint','sun','glass','flower'][i],.01)
    # Footbridge spans the river and lands exactly on the access road.
    cy=10.5; rx=river_x(cy); w=river_width(cy)
    for i in range(28): box((rx-w-.4+i*(2*w+.8)/27,cy,.8),((2*w+.8)/27+.01,1.05,.09),'wood',.01)
    railing((rx-w-.45,cy-.53),(rx+w+.45,cy-.53),.83)
    railing((rx-w-.45,cy+.53),(rx+w+.45,cy+.53),.83)
    for ix in [-w-.25,w+.25]: box((rx+ix,cy,.48),(.25,1.15,.65),'stone',.03)

def archive():
    global ZONE; ZONE='archive'; x=-11; y=-10.2; z=.55
    terrace(x,y,6.8,6.6,z)
    # Observatory-like archive: circular drum, radial ribs, roof oculus.
    lathe((x,y,z+.24),[(2,0),(2,.12),(1.88,.2),(1.88,1.55),(1.95,1.64)],'porcelain',64)
    lathe((x,y,z+1.6),[(1.91,0),(1.9,.22),(1.64,.45),(1.18,.63),(.6,.73)],'stone',64)
    lathe((x,y,z+2.28),[(.6,0),(.58,.04),(.5,.07)],'glass',48)
    for i in range(24):
        a=i*math.tau/24
        rod((x+1.92*math.cos(a),y+1.92*math.sin(a),z+.48),(x+1.92*math.cos(a),y+1.92*math.sin(a),z+1.95),.035,'steel')
        tube([(x+r*math.cos(a),y+r*math.sin(a),z+h) for r,h in [(1.91,1.64),(1.64,2.05),(1.18,2.23),(.6,2.33)]],.025,'porcelain')
    windows(x,y-1.94,1.3,z+.95,1.2)
    box((x,y-2.12,z+1.45),(2.1,.6,.12),'yellow',.035)
    stairs(x,y-2.32,z+.24,2.2,2)
    for ix in [-2.7,2.7]:
        for iy in [-1.6,0,1.6]:
            box((x+ix,y+iy,z+.72),(.45,1.1,.95),'dark',.035)
            for j in range(8): box((x+ix,y+iy-.56,z+.36+j*.09),(.36,.035,.025),'sun',.005)
    for ix in [-2.8,2.8]: lamp(x+ix,y-2.8,z+.24)
    # Terraced reading garden with slender columns and benches.
    for i in range(7):
        px=x-3.5; py=y-2.7+i*.9
        box((px,py,z+.8),(.15,.15,1.15),'porcelain',.025)
    box((x-3.5,y,z+1.45),(.25,6,.14),'wood',.025)
    for iy in [-1,1]:
        box((x+2.3,y+iy,z+.55),(.5,1.5,.12),'wood',.025)
        for j in [-.5,.5]: box((x+2.3,y+iy+j,z+.37),(.1,.12,.32),'steel',.015)

def camp():
    global ZONE; ZONE='camp'; x=3; y=-13; z=.55
    terrace(x,y,5.6,4,z)
    # Canvas pavilion has a double curved roof supported by real timber frames.
    for iy in [-1.4,1.4]:
        for ix in [-1.7,1.7]: rod((x+ix,y+iy,z+.24),(x+ix,y+iy,z+1.5),.055,'wood')
    vs=[]
    for j in range(21):
        xx=-1.95+3.9*j/20; h=1.5+.9*(1-(abs(xx)/1.95)**.8)
        vs.extend([(x+xx,y-1.7,z+h),(x+xx,y+1.7,z+h)])
    emit(vs,[(j*2,j*2+1,j*2+3,j*2+2) for j in range(20)],'sun')
    rod((x,y-1.9,z+2.4),(x,y+1.9,z+2.4),.05,'wood')
    for iy in [-1.7,1.7]:
        for ix in [-1.9,1.9]: rod((x+ix,y+iy,z+1.5),(x+ix*1.3,y+iy*1.2,z+.24),.01,'dark',5)
    box((x,y,z+.9),(1.8,.7,.08),'wood',.025)
    for ix in [-.7,.7]: rod((x+ix,y,z+.24),(x+ix,y,z+.86),.04,'steel')
    for iy in [-.7,.7]:
        box((x,y+iy,z+.57),(2.2,.25,.1),'wood',.025)
        for ix in [-.8,.8]: rod((x+ix,y+iy,z+.24),(x+ix,y+iy,z+.52),.035,'steel')
    for ix in [-2.1,2.1]: lamp(x+ix,y-1.5,z+.24)
    # Wayfinding board and small luggage crates.
    for ix in [-.65,.65]: rod((x+ix,y+2,z+.24),(x+ix,y+2,z+1.7),.045,'wood')
    box((x,y+2,z+1.35),(1.5,.09,.8),'dark',.035)
    for i in range(4): box((x-.5+i*.33,y+1.94,z+1.4),(.025,.02,.5),'mint',.004)
    for i in range(3):
        box((x+2.7,y-.9+i*.6,z+.49),(.4,.45,.5),'wood',.03)
        box((x+2.7,y-.9+i*.6,z+.75),(.45,.5,.05),'steel',.01)

def communications():
    global ZONE; ZONE='communications'; x=15; y=-3; z=.55
    terrace(x,y,4.8,4.8,z)
    box((x,y,z+.65),(2.8,2.6,.8),'porcelain',.08)
    windows(x,y-1.32,2.2,z+.75,.5)
    roof_ribs(x,y,3.1,2.9,z+1.12)
    # Open tapered lattice tower, four legs with alternating connected braces.
    for ix in [-1,1]:
        for iy in [-1,1]:
            rod((x+ix*.65,y+iy*.65,z+1.1),(x+ix*.3,y+iy*.3,z+4.9),.065,'steel')
    for k in range(5):
        h1=1.15+k*.7; h2=h1+.7; r1=.65-(h1-1.1)*.35/3.8; r2=.65-(h2-1.1)*.35/3.8
        for side in range(4):
            a=side*math.pi/2+math.pi/4; b=a+math.pi/2
            pa=(x+r1*math.sqrt(2)*math.cos(a),y+r1*math.sqrt(2)*math.sin(a),z+h1)
            pb=(x+r1*math.sqrt(2)*math.cos(b),y+r1*math.sqrt(2)*math.sin(b),z+h1)
            pc=(x+r2*math.sqrt(2)*math.cos(b),y+r2*math.sqrt(2)*math.sin(b),z+h2)
            rod(pa,pb,.025); rod(pa,pc,.025)
    rod((x,y,z+4.85),(x,y,z+5.7),.035,'dark')
    sphere((x,y,z+5.72),(.09,.09,.1),'light')
    # Proper concave satellite shell (rim faces the sky), mast and feed.
    lathe((x+.5,y,z+3.5),[(.05,0),(.25,.025),(.5,.12),(.72,.28),(.76,.32)],'porcelain',40,Vector((1,-.2,1)))
    rod((x+.45,y,z+3.7),(x+1.15,y-.12,z+4.4),.035,'steel')
    sphere((x+1.15,y-.12,z+4.4),(.08,.08,.08),'yellow')
    for ix in [-1.5,1.5]: solar(x+ix,y+1.5,z+.6,.85,.85)
    # The western access spans water on a supported bridge rather than pavement.
    cy=-3; rx=river_x(cy); w=river_width(cy)
    for i in range(26): box((rx-w-.45+i*(2*w+.9)/25,cy,.72),((2*w+.9)/25+.01,.78,.09),'wood',.01)
    for sign in [-1,1]: railing((rx-w-.5,cy+sign*.41),(rx+w+.5,cy+sign*.41),.75)
    for sign in [-1,1]: box((rx+sign*(w+.28),cy,.44),(.3,.95,.55),'stone',.03)

def cultivated_details():
    global ZONE; ZONE='cultivated'
    # Precise growing beds, seedling rows and walking aisles give each close-up
    # a horticultural scale. They stop at tile seams, riverbanks and road edges.
    for bx,by in [(0,12),(3.2,15.2),(-3.2,15.2),(16,6.4),(16,16)]:
        for j in range(4):
            cy=by-1+j*.62; z=height(bx,cy)
            box((bx,cy,z+.05),(2.5,.42,.09),'soil',.025)
            for sign in [-1,1]: box((bx,cy+sign*.22,z+.08),(2.6,.025,.14),'wood',.005)
            for i in range(10):
                px=bx-1.05+i*.23
                sphere((px,cy,z+.18),(.085,.12,.12),'leaf'+str((i+j)%4),i+j)
                if (i+j)%3==0: sphere((px,cy-.045,z+.28),(.038,.038,.023),'flower',i)
    # Sandstone outcrops: asymmetric, layered natural profiles, never platonic
    # boulders or floating cubes. Embedded footing is calculated from terrain.
    for i in range(24):
        x=-17+random.uniform(-2,3);y=-14+random.uniform(-3,1.5);z=height(x,y)
        sx=random.uniform(.35,1.0); sy=random.uniform(.3,.75);sz=random.uniform(.22,.75)
        sphere((x,y,z+sz*.24),(sx,sy,sz),'sand',i*1.6)
        if i%3==0: sphere((x+.18,y-.1,z+sz*.65),(sx*.65,sy*.7,sz*.48),'stone',i)
    # Quiet wooden boardwalk with correctly seated piles along the southern bank.
    y=-15.8; x=river_x(y)+river_width(y)+.8; z=max(.58,height(x,y))
    for i in range(28): box((x,y-2.1+i*.15,z),(.85,.14,.075),'wood',.01)
    for iy in [-1.8,0,1.8]:
        for ix in [-.35,.35]: rod((x+ix,y+iy,.13),(x+ix,y+iy,z),.065,'dark')
    railing((x+.43,y-2.1),(x+.43,y+1.95),z+.04)
    for i in range(34):
        yy=random.uniform(-19,-9);xx=river_x(yy)+random.uniform(-.7,.7)
        sphere((xx,yy,.237),(.17,.16,.018),'leaf3',i)
        if i%6==0: sphere((xx,yy,.25),(.045,.045,.03),'flower',i)
    # A small artist's courtyard, with paving, sculptural seats and a pergola.
    bx=16;by=12.8;z=height(bx,by)
    for i in range(4):
        for j in range(4): box((bx-.75+i*.5,by-.75+j*.5,z+.025),(.47,.47,.04),'stone',.008)
    for ix in [-.95,.95]:
        for iy in [-.95,.95]: rod((bx+ix,by+iy,z),(bx+ix,by+iy,z+1.6),.04,'wood')
    for i in range(10): box((bx-.95+i*.21,by,z+1.61),(.06,2.15,.1),'wood',.01)
    for iy in [-.65,.65]:
        box((bx,by+iy,z+.4),(1.35,.3,.1),'porcelain',.03)
        for ix in [-.45,.45]: box((bx+ix,by+iy,z+.18),(.12,.24,.35),'steel',.015)
    # Wind-driven field instruments and a weather vane articulate the horizon.
    for bx,by in [(-4,18),(3,19),(-18,2)]:
        z=height(bx,by);rod((bx,by,z),(bx,by,z+1.9),.035,'steel')
        for i in range(3):
            a=i*math.tau/3; end=(bx+.34*math.cos(a),by+.34*math.sin(a),z+1.8)
            rod((bx,by,z+1.8),end,.015,'steel',6);sphere(end,(.065,.065,.038),'dark',i)
        box((bx,by,z+.12),(.18,.18,.22),'yellow',.02)

def finish():
    objects=[]
    for (zone,mat),(vs,fs) in BUCKETS.items():
        mesh=bpy.data.meshes.new(zone+'_'+mat); mesh.from_pydata(vs,[],fs); mesh.materials.append(MATS[mat]); mesh.update()
        obj=bpy.data.objects.new(zone+'_'+mat,mesh); bpy.context.collection.objects.link(obj)
        # Smooth curves and topography while retaining authored facade breaks.
        for p in mesh.polygons: p.use_smooth=mat.startswith('leaf') or mat in ['water','water_light','bark','sand']
        objects.append(obj)
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    # Camera/lights are evidence helpers; they are excluded from runtime export.
    bpy.ops.object.camera_add(location=(31,-44,38)); camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=55; bpy.context.scene.camera=camera
    for pos,power,size in [((-20,-12,40),7000,24),((10,22,30),4500,20)]:
        bpy.ops.object.light_add(type='AREA',location=pos); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
        light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
    scene.world.color=(.65,.7,.66); scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=1800; scene.render.resolution_y=1500; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
    bpy.ops.wm.save_as_mainfile(filepath=str(PRIVATE/'ronghuang-atlas.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'ronghuang-atlas.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False,export_yup=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    stats={'objects':len(objects),'materials':len(MATS),'vertices':sum(len(o.data.vertices) for o in objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'zones':sorted(set(k[0] for k in BUCKETS)),'seed':522,'stages_completed':['contract_and_references','graybox_and_proportion','primary_secondary_forms','structural_refinement','materials_textures','surface_polish'],'blender':bpy.app.version_string}
    (PRIVATE/'build-metrics.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
    scene.render.filepath=str(PRIVATE/'atlas-hero.png'); bpy.ops.render.render(write_still=True)
    print('ATLAS_BUILD_RESULT '+json.dumps(stats))

terrain(); pavilion(); workshop(); gallery(); archive(); camp(); communications(); plantings(); cultivated_details(); finish()
