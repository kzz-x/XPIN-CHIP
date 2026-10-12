import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import './style.css';
import { profiles, type BlockData } from './chips';
import mediatekBadge from './assets/mediatek-9600.png?inline';
import snapdragonBadge from './assets/snapdragon-gen6.jpg?inline';

type CameraPreset = { position:number[]; target:number[] };
type Step = {name:string;focus:string|null;explode:number};
type BlockRuntime = {data:BlockData;group:THREE.Group;glass:THREE.Mesh;mat:THREE.MeshPhysicalMaterial;edge:THREE.LineLoop;label:THREE.Mesh;flow:THREE.Points;flowPaths:{x:number;z:number;len:number;axis:number;phase:number}[]};

const byId = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const chip = {width:10.4,depth:10.4};
let profile=profiles[0];
let layout = profile.blocks;
const cameraPresets:Record<string,CameraPreset>={overview:{position:[14,18,21],target:[0,1,-3]},shell:{position:[11.5,12,14],target:[0,.2,0]}};
let steps:Step[]=[];
let glassOpacity=.64,glassRoughness=.045,flowStrength=.18,flowSpeed=.35,flowTime=0;
let isolated=false;

const viewport = byId<HTMLDivElement>('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#080b12');
scene.fog = new THREE.FogExp2('#080b12', 0.009);
const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 140);
camera.position.fromArray(cameraPresets.overview.position);
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.prepend(renderer.domElement);

// Large softboxes are reflected in PBR surfaces, rather than a flat ambient wash.
const lightStudio=new THREE.Scene();lightStudio.background=new THREE.Color('#10141b');
const boxGeo=new THREE.PlaneGeometry(1,1);
function softbox(x:number,y:number,z:number,w:number,h:number,color:string,power:number):void{
  const p=new THREE.Mesh(boxGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}));
  p.position.set(x,y,z);p.scale.set(w,h,1);p.lookAt(0,0,0);lightStudio.add(p);
}
softbox(-5,8,3,7,2.2,'#fff0dd',4);softbox(7,5,-5,1.3,10,'#c7dbff',4);
softbox(0,9,-7,10,.9,'#ffffff',5);softbox(4,3,8,3,4,'#e4eaff',1.6);
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentTarget=pmrem.fromScene(lightStudio,.025);
scene.environment = environmentTarget.texture;
scene.environmentIntensity=1.05;
lightStudio.traverse(o=>{if(o instanceof THREE.Mesh)o.material.dispose();});boxGeo.dispose();
pmrem.dispose();
const hemi = new THREE.HemisphereLight('#d6e5fa', '#172236', .45);scene.add(hemi);
const key = new THREE.DirectionalLight('#fff1e8',3.3);
key.position.set(-6,12,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-16;key.shadow.camera.right=16;key.shadow.camera.top=16;key.shadow.camera.bottom=-16;
key.shadow.bias=-0.0001;key.shadow.normalBias=.025;key.shadow.radius=4;scene.add(key);
const warm = new THREE.PointLight('#ffe4ba',45,32,2);warm.position.set(-9,5,-3);scene.add(warm);
const cool = new THREE.PointLight('#b5caff',55,32,2);cool.position.set(7,4,2);scene.add(cool);
const rimLight=new THREE.DirectionalLight('#d7e4ff',2.2);rimLight.position.set(0,4,-8);scene.add(rimLight);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.055;
controls.maxPolarAngle=Math.PI * 0.48;controls.minDistance=4.0;controls.maxDistance=100;
controls.target.fromArray(cameraPresets.overview.target);controls.update();
const goalPosition=camera.position.clone(), goalTarget=controls.target.clone();
const requestedPosition=camera.position.clone(), requestedTarget=controls.target.clone();
let manualCamera=false;
controls.addEventListener('start',()=>{manualCamera=true;stopPlayback();});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.MeshStandardMaterial({color:'#101722',metalness:.12,roughness:.58,envMapIntensity:.25}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.305;floor.receiveShadow=true;scene.add(floor);
const grid = new THREE.GridHelper(70,70,'#263c4d','#1d2c3d');
grid.position.y=-.303;grid.visible=false;
(grid.material as THREE.Material).transparent=true;
(grid.material as THREE.Material).opacity=0.2;
scene.add(grid);

function roundedShape(w:number,d:number,r:number):THREE.Shape{
  const s=new THREE.Shape();const x=-w/2,z=-d/2;
  s.moveTo(x+r,z);s.lineTo(x+w-r,z);s.quadraticCurveTo(x+w,z,x+w,z+r);
  s.lineTo(x+w,z+d-r);s.quadraticCurveTo(x+w,z+d,x+w-r,z+d);
  s.lineTo(x+r,z+d);s.quadraticCurveTo(x,z+d,x,z+d-r);
  s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);return s;
}
function roundedSolid(w:number,d:number,h:number,r:number,mat:THREE.Material,bevel=0.045):THREE.Mesh{
  const geo=new THREE.ExtrudeGeometry(roundedShape(w,d,r),{depth:h,steps:1,curveSegments:32,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:6});
  geo.rotateX(-Math.PI/2);smoothBevel(geo);const mesh=new THREE.Mesh(geo,mat);
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function outline(w:number,d:number,r:number,color:string):THREE.LineLoop{
  const pts=roundedShape(w,d,r).getPoints(32).map(p=>new THREE.Vector3(p.x,0,-p.y));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity:0.75}));
}
// Smooth only shared side/bevel vertices. Keep the top face geometrically flat.
function smoothBevel(geo:THREE.BufferGeometry):void{
  const p=geo.getAttribute('position'),n=geo.getAttribute('normal');
  const sums=new Map<string,THREE.Vector3>();
  const keyAt=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e5)).join(',');
  for(let i=0;i<p.count;i++){if(Math.abs(n.getY(i))>.9999)continue;const k=keyAt(i);const s=sums.get(k)||new THREE.Vector3();s.add(new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)));sums.set(k,s);}
  for(let i=0;i<p.count;i++){if(Math.abs(n.getY(i))>.9999)continue;const s=sums.get(keyAt(i))!.clone().normalize();n.setXYZ(i,s.x,s.y,s.z);}n.needsUpdate=true;
}
function roundedPlane(w:number,d:number,r:number,mat:THREE.Material,y:number):THREE.Mesh{
  const g=new THREE.ShapeGeometry(roundedShape(w,d,r),32);
  const p=g.getAttribute('position');const uv=g.getAttribute('uv');
  for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/w+.5,p.getY(i)/d+.5);
  g.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(g,mat);mesh.position.y=y;return mesh;
}
function seededRand(seed:number):()=>number{
  let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
}
function microTexture(seed:number,color:string):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=768;c.height=512;
  const ctx=c.getContext('2d')!;const r=seededRand(seed);
  ctx.fillStyle='#101b26';ctx.fillRect(0,0,c.width,c.height);
  // Hierarchical circuit islands, fine buses and contact pads: schematic, not physical floorplan.
  for(let row=0;row<5;row++)for(let col=0;col<7;col++){
    const x=col*108+8,y=row*100+8;ctx.fillStyle=(row+col)%2?'#182330':'#14202b';ctx.fillRect(x,y,96,87);
    ctx.strokeStyle='rgba(185,199,212,.26)';ctx.lineWidth=.8;ctx.strokeRect(x,y,96,87);
    ctx.strokeStyle=color;ctx.globalAlpha=.23;
    for(let j=0;j<8;j++){ctx.beginPath();ctx.moveTo(x+6,y+7+j*9);ctx.lineTo(x+86,y+7+j*9);ctx.stroke();}
    ctx.globalAlpha=1;
  }
  ctx.strokeStyle=color;ctx.globalAlpha=.46;
  for(let i=0;i<145;i++){
    const x=Math.floor(r()*64)*12, y=Math.floor(r()*42)*12;
    const len=(2+Math.floor(r()*11))*12;
    ctx.lineWidth=r()>0.6?2:1;ctx.beginPath();ctx.moveTo(x,y);
    if(r()>.5){ctx.lineTo(Math.min(765,x+len),y);ctx.lineTo(Math.min(765,x+len),y+12);}else{ctx.lineTo(x,Math.min(509,y+len));ctx.lineTo(x+12,Math.min(509,y+len));}
    ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.fillStyle='rgba(205,223,236,.13)';
  for(let i=0;i<110;i++){ctx.fillRect(r()*768,r()*512,2+r()*5,2+r()*5);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return tex;
}
function labelTexture(main:string,sub:string):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=1024;c.height=330;
  const x=c.getContext('2d')!;
  x.fillStyle='#f3f8ff';x.textAlign='left';x.textBaseline='middle';
  x.shadowColor='#000';x.shadowBlur=8;
  x.font='600 110px Arial,"Microsoft YaHei",sans-serif';x.fillText(main,40,125,945);
  x.font='500 44px Arial,"Microsoft YaHei",sans-serif';x.fillStyle='#c5d8e9';x.fillText(sub,44,249,945);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function plane(w:number,d:number,mat:THREE.Material,y:number):THREE.Mesh{
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);p.rotation.x=-Math.PI/2;p.position.y=y;return p;
}

const chipRoot=new THREE.Group();scene.add(chipRoot);
const baseMat=new THREE.MeshPhysicalMaterial({color:'#273341',metalness:.88,roughness:.19,clearcoat:.9});
const substrate=roundedSolid(chip.width,chip.depth,.20,.31,baseMat);
substrate.position.y=-.26;chipRoot.add(substrate);
const edgeMat=new THREE.MeshStandardMaterial({color:'#a8b0bd',metalness:1,roughness:.16});
const lowerRim=roundedSolid(chip.width-.16,chip.depth-.16,.042,.23,edgeMat,.02);
lowerRim.position.y=-.055;chipRoot.add(lowerRim);
const dieMat=new THREE.MeshPhysicalMaterial({color:'#141d28',metalness:.45,roughness:.39});
const dieBase=roundedSolid(chip.width-.42,chip.depth-.4,.10,.18,dieMat,.015);
dieBase.position.y=0.015;chipRoot.add(dieBase);

const runtimes:BlockRuntime[]=[];
const architecture=new THREE.Group();chipRoot.add(architecture);
function buildArchitecture():void{
  disposeGroup(architecture);runtimes.length=0;
for(let i=0;i<layout.length;i++){
  const b=layout[i], group=new THREE.Group();group.position.set(b.x,0,b.z);architecture.add(group);
  const dark=new THREE.MeshStandardMaterial({color:'#0c1524',metalness:.64,roughness:.34});
  const radius=Math.min(.18,b.width*.24,b.depth*.24);
  const foundation=roundedSolid(b.width,b.depth,.09,radius,dark,.01);foundation.position.y=.13;group.add(foundation);
  const circuitMap=microTexture(329+i*97,b.color);
  const boardPattern=roundedPlane(b.width-.10,b.depth-.10,Math.max(.025,radius-.05),new THREE.MeshStandardMaterial({map:circuitMap,emissiveMap:circuitMap,emissive:'#ffffff',emissiveIntensity:.55,metalness:.32,roughness:.32}),.239);
  group.add(boardPattern);
  const mat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(b.color).lerp(new THREE.Color('#ffffff'),.4),
    metalness:0,roughness:glassRoughness,transparent:true,
    opacity:glassOpacity,transmission:.96,specularIntensity:.65,envMapIntensity:.65,
    ior:1.46,thickness:.29,attenuationColor:b.color,attenuationDistance:2.4,clearcoat:.75,clearcoatRoughness:.025,depthWrite:false});
  const glass=roundedSolid(b.width-.09,b.depth-.09,b.thickness,Math.max(.03,radius-.025),mat,.028);glass.position.y=.245;glass.userData.blockId=b.id;group.add(glass);
  const edge=outline(b.width-.08,b.depth-.08,radius,b.color);edge.position.y=.245+b.thickness+.029;group.add(edge);
  if(b.tiles)for(const t of b.tiles){
    const tile=roundedSolid(t.width,t.depth,.025,.06,new THREE.MeshPhysicalMaterial({color:'#293645',metalness:.67,roughness:.26}),.012);tile.position.set(t.x,.253,t.z);group.add(tile);
    const l=plane(t.width*.91,t.width*.28,new THREE.MeshBasicMaterial({map:labelTexture(t.label,t.sub),transparent:true,depthWrite:false}),.245+b.thickness+.045);l.position.set(t.x,.245+b.thickness+.045,t.z);group.add(l);
  }
  const tex=labelTexture(b.label,b.type);const ratio=Math.min(b.width*.80,3.2);
  const label=plane(ratio,ratio*.32,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}),.245+b.thickness+.092);
  label.position.x=-b.width*.04;group.add(label);
  if(b.depth>b.width*3){label.geometry.dispose();label.geometry=new THREE.PlaneGeometry(Math.min(b.depth*.68,3.6),.62);label.rotation.z=-Math.PI/2;label.position.x=0;}
  if(b.tiles)label.position.z=-b.depth*.37;
  const flowPaths=Array.from({length:16},(_,j)=>({x:(j%4-1.5)*(b.width-.35)/4,z:(Math.floor(j/4)-1.5)*(b.depth-.35)/4,len:Math.min(.65,Math.max(.1,b.width*.15)),axis:j%2,phase:j/16}));
  const flowGeo=new THREE.BufferGeometry();flowGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(16*3),3));
  const flow=new THREE.Points(flowGeo,new THREE.PointsMaterial({color:b.color,size:.022,transparent:true,opacity:flowStrength*.55,depthWrite:false}));group.add(flow);
  runtimes.push({data:b,group,glass,mat,edge,label,flow,flowPaths});
}
}
function disposeGroup(g:THREE.Group):void{
  const textures=new Set<THREE.Texture>();
  g.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);m.dispose();}}});
  textures.forEach(t=>t.dispose());g.clear();
}
buildArchitecture();
const font=new FontLoader().parse(fontJson);
const cover=new THREE.Group();chipRoot.add(cover);
const shellMaterial=new THREE.MeshPhysicalMaterial({color:profile.color,metalness:.87,
  roughness:.19,clearcoat:1,clearcoatRoughness:.065});
// Hollow skirt hides the die at zero explode, without intersecting its glass blocks.
const skirtShape=roundedShape(10.4,10.4,.34);
skirtShape.holes.push(new THREE.Path(roundedShape(9.72,9.72,.24).getPoints(32).reverse()));
const skirtGeo=new THREE.ExtrudeGeometry(skirtShape,{depth:.71,steps:1,curveSegments:32,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:6});
skirtGeo.rotateX(-Math.PI/2);smoothBevel(skirtGeo);
const skirt=new THREE.Mesh(skirtGeo,shellMaterial);skirt.position.y=.012;skirt.castShadow=true;skirt.receiveShadow=true;cover.add(skirt);
const casing=roundedSolid(chip.width,chip.depth,.17,.34,shellMaterial,.035);casing.position.y=.71;cover.add(casing);
const topMat=new THREE.MeshPhysicalMaterial({color:'#121720',metalness:.72,roughness:.22,clearcoat:1,clearcoatRoughness:.06});
const top=roundedSolid(chip.width-.40,chip.depth-.40,.025,.26,topMat,.016);top.position.y=.90;cover.add(top);
const insetFrame=outline(chip.width-.40,chip.depth-.40,.26,profile.accent);insetFrame.position.y=.945;cover.add(insetFrame);
const badgeMat=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:.48,roughness:.26,clearcoat:1,clearcoatRoughness:.07,polygonOffset:true,polygonOffsetFactor:-1});
const textureOverlay=roundedPlane(9.93,9.93,.255,badgeMat,.944);cover.add(textureOverlay);
const identityGroup=new THREE.Group();cover.add(identityGroup);
type IdentityState={mode:string;brand:string;model:string;color:string;upload:string|null};
const identities=new Map<string,IdentityState>();
function identity():IdentityState{
  if(!identities.has(profile.id))identities.set(profile.id,{mode:'reference',brand:profile.brand,model:profile.model,color:profile.color,upload:null});
  return identities.get(profile.id)!;
}
let textureRevision=0;
function updateBadge():void{
  const revision=++textureRevision, state=identity();
  const prev=badgeMat.map;badgeMat.map=null;prev?.dispose();badgeMat.bumpMap?.dispose();badgeMat.bumpMap=null;badgeMat.needsUpdate=true;
  if(state.upload){new THREE.TextureLoader().load(state.upload,t=>{if(revision!==textureRevision){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();badgeMat.map=t;badgeMat.needsUpdate=true;});return;}
  if(profile.badge==='9500'){
    const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d')!;
    const bg=ctx.createLinearGradient(0,0,1024,1024);bg.addColorStop(0,'#171a21');bg.addColorStop(.7,'#07090e');bg.addColorStop(1,'#1c2440');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,1024);
    ctx.fillStyle='#29292d';ctx.beginPath();ctx.moveTo(60,770);ctx.lineTo(430,170);ctx.lineTo(630,170);ctx.lineTo(320,770);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(430,770);ctx.lineTo(790,170);ctx.lineTo(995,170);ctx.lineTo(655,770);ctx.closePath();ctx.fill();
    const gold=ctx.createLinearGradient(0,0,1024,120);gold.addColorStop(0,'#e3ca88');gold.addColorStop(1,'#a9864f');ctx.fillStyle=gold;
    ctx.font='italic 800 108px Arial';ctx.fillText('MEDIATEK',60,495,920);
    ctx.font='500 52px "Microsoft YaHei",sans-serif';ctx.textAlign='right';ctx.fillText('天 玑',925,790);
    ctx.font='500 74px Arial';ctx.fillText('9500',925,900);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;badgeMat.map=t;badgeMat.needsUpdate=true;return;
  }
  const isSnap=profile.family==='snapdragon',isM=profile.badge==='m';
  new THREE.TextureLoader().load(isSnap?snapdragonBadge:mediatekBadge,t=>{
    if(revision!==textureRevision){t.dispose();return;}
    t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();
    if(!isSnap){t.repeat.set(388/1080,388/538);t.offset.set((isM?615:77)/1080,(538-469)/538);}
    badgeMat.map=t;
    const bump=t.clone();bump.colorSpace=THREE.NoColorSpace;badgeMat.bumpMap=bump;badgeMat.bumpScale=.025;
    badgeMat.needsUpdate=true;
  });
}
function raisedText(value:string,size:number,z:number,color:string,depth:number):THREE.Mesh{
  const geo=new TextGeometry(value,{font,size,depth,curveSegments:16,bevelEnabled:true,
    bevelSize:.007,bevelThickness:.006,bevelSegments:4});
  geo.computeBoundingBox();
  const box=geo.boundingBox!;geo.translate(-(box.max.x+box.min.x)/2,-(box.max.y+box.min.y)/2,0);
  geo.rotateX(-Math.PI/2);
  const mat=new THREE.MeshPhysicalMaterial({color,metalness:.92,roughness:.18,clearcoat:1,clearcoatRoughness:.12});
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(0,.958,z);mesh.castShadow=true;
  const width=box.max.x-box.min.x;if(width>8)mesh.scale.setScalar(8/width);return mesh;
}
function customText(value:string,size:number,z:number):THREE.Mesh{
  if(/^[\x20-\x7E]*$/.test(value))return raisedText(value,size,z,profile.accent,.024);
  // CJK uses canvas glyphs because the embedded Latin font has no Chinese outlines.
  const c=document.createElement('canvas');c.width=2048;c.height=512;const x=c.getContext('2d')!;
  x.font='600 300px "Microsoft YaHei",sans-serif';c.width=Math.min(4096,Math.ceil(x.measureText(value).width)+160);
  x.font='600 300px "Microsoft YaHei",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle=profile.accent;x.fillText(value,c.width/2,256,c.width-120);
  const w=Math.min(8,size*value.length*1.1);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const p=plane(w,w*c.height/c.width,new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}),.958);p.position.z=z;return p;
}
function updateIdentity():void{
  disposeGroup(identityGroup);const s=identity();
  shellMaterial.color.set(s.color);byId<HTMLInputElement>('shellColor').value=s.color;
  byId<HTMLSelectElement>('identitySelect').value=s.mode;
  byId<HTMLInputElement>('brandInput').value=s.brand;byId<HTMLInputElement>('modelInput').value=s.model;
  textureOverlay.visible=s.mode==='reference';
  textureOverlay.geometry.dispose();textureOverlay.geometry=roundedPlane(9.93,9.93,profile.family==='snapdragon'&&!s.upload?1.30:.255,badgeMat,.944).geometry;
  insetFrame.visible=s.mode!=='none';
  (insetFrame.material as THREE.LineBasicMaterial).color.set(profile.accent);
  topMat.color.set(profile.extreme?profile.accent:profile.family==='snapdragon'?'#41080c':'#121720');
  topMat.metalness=profile.extreme?.95:.72;
  textureOverlay.scale.setScalar(profile.extreme?.87:1);
  if(s.mode==='custom'){
    if(s.brand.trim())identityGroup.add(customText(s.brand,.95,-.75));
    if(s.model.trim())identityGroup.add(customText(s.model,.33,1.6));
  }else if(s.mode==='reference'&&profile.extreme){
    const mark=raisedText('EXTREME',.20,4.83,profile.accent,.015);identityGroup.add(mark);
  }
}

let selected:string|null=null;
let explode=0, targetExplode=explode;
let shellVisible=true, internalsVisible=true;
let stepIndex=0, playTimer:number|null=null;
const defaultCamera=cameraPresets.overview;
function setCamera(pos:number[],target:number[],fitAspect=true):void{
  manualCamera=false;requestedPosition.fromArray(pos);requestedTarget.fromArray(target);
  const factor=Math.max(1,1.35/camera.aspect);
  if(!fitAspect)requestedPosition.sub(requestedTarget).multiplyScalar(1/factor).add(requestedTarget);
  goalTarget.copy(requestedTarget);
  const offset=requestedPosition.clone().sub(goalTarget).multiplyScalar(factor);offset.clampLength(controls.minDistance+.01,controls.maxDistance-.01);goalPosition.copy(goalTarget).add(offset);
}
function focus(id:string|null,syncStage=true):void{
  selected=id;
  runtimes.forEach(b=>{
    (b.edge.material as THREE.LineBasicMaterial).color.set(b.data.id===id?'#ffffff':b.data.color);
    (b.edge.material as THREE.LineBasicMaterial).opacity=b.data.id===id?.85:.28;
    b.edge.scale.setScalar(b.data.id===id?1.015:1);
  });
  document.querySelectorAll<HTMLButtonElement>('.block-buttons button').forEach(el=>el.classList.toggle('active',el.dataset.block===id));
  if(id){
    const b=runtimes.find(x=>x.data.id===id)!.data;
    const distance=Math.max(b.width,b.depth*.82,2.4);
    setCamera([b.x+distance*.24,5+distance*1.30,b.z+distance*1.10],[b.x,.5,b.z]);
    targetExplode=Math.max(targetExplode,.82);
    byId<HTMLElement>('selectedTitle').textContent=b.label+' · '+b.type;
    byId<HTMLElement>('selectedDesc').textContent=b.description;
  }else{
    setCamera(defaultCamera.position,defaultCamera.target);
    byId<HTMLElement>('selectedTitle').textContent=profile.name;
    byId<HTMLElement>('selectedDesc').textContent='选择模块查看特写。内部采用玻璃与电路结构示意，未使用实拍素材；微电路不代表真实物理 die 版图。';
  }
  byId<HTMLInputElement>('explodeInput').value=String(Math.round(targetExplode*100));
  byId<HTMLOutputElement>('explodeValue').value=Math.round(targetExplode*100)+'%';
  if(syncStage)syncManualStage();
}
function syncManualStage():void{
  const index=steps.findIndex(s=>s.focus===selected&&Math.abs(s.explode-targetExplode)<.001);
  if(index>=0){stepIndex=index;byId<HTMLElement>('stepName').textContent=steps[index].name;byId<HTMLInputElement>('stepRange').value=String(index);byId<HTMLElement>('stepCounter').textContent=String(index+1).padStart(2,'0')+' / '+String(steps.length).padStart(2,'0');}
  else{byId<HTMLElement>('stepName').textContent=selected?(runtimes.find(r=>r.data.id===selected)?.data.label||selected)+' / 手动特写':'自由开合 / '+Math.round(targetExplode*100)+'%';byId<HTMLElement>('stepCounter').textContent='手动';}
}
function setExplode(value:number):void{
  targetExplode=THREE.MathUtils.clamp(value,0,1);
  byId<HTMLInputElement>('explodeInput').value=String(Math.round(targetExplode*100));
  byId<HTMLOutputElement>('explodeValue').value=Math.round(targetExplode*100)+'%';
}
function showAll():void{
  isolated=false;byId<HTMLInputElement>('isolateToggle').checked=false;
  shellVisible=true;internalsVisible=true;byId<HTMLInputElement>('shellToggle').checked=true;byId<HTMLInputElement>('coreToggle').checked=true;
}
function goStep(index:number):void{
  showAll();
  stepIndex=(index+steps.length)%steps.length;const s=steps[stepIndex];
  setExplode(s.explode);focus(s.focus,false);if(s.focus===null&&s.explode===0)setCamera(cameraPresets.shell.position,cameraPresets.shell.target);
  byId<HTMLElement>('stepName').textContent=s.name;
  byId<HTMLInputElement>('stepRange').value=String(stepIndex);
  byId<HTMLElement>('stepCounter').textContent=String(stepIndex+1).padStart(2,'0')+' / '+String(steps.length).padStart(2,'0');
}
function stopPlayback():void{if(playTimer!==null){window.clearInterval(playTimer);playTimer=null;}byId<HTMLButtonElement>('playBtn').textContent='▶';}
function togglePlayback():void{
  if(playTimer!==null){stopPlayback();return;}
  byId<HTMLButtonElement>('playBtn').textContent='Ⅱ';
  playTimer=window.setInterval(()=>goStep(stepIndex+1),4500);
}
function buildButtons():void{
byId<HTMLElement>('blockButtons').replaceChildren();
for(const b of layout){
  const el=document.createElement('button');el.dataset.block=b.id;el.innerHTML='<span class="block-indicator"></span><span>'+b.label+'</span><small>'+b.type+'</small>';
  el.style.setProperty('--accent',b.color);
  el.addEventListener('click',()=>{stopPlayback();focus(b.id);});byId<HTMLElement>('blockButtons').append(el);
}
}
function switchProfile(id:string):void{
  const next=profiles.find(p=>p.id===id);if(!next)return;
  stopPlayback();profile=next;layout=profile.blocks;buildArchitecture();buildButtons();showAll();
  steps=[{name:'闭合 / 封装',focus:null,explode:0},{name:'展开 / 架构',focus:null,explode:.82},...layout.filter(b=>['cpu','gpu','npu','isp','memory'].includes(b.id)).map(b=>({name:b.label+' / 特写',focus:b.id,explode:.82})),{name:'复原 / 封装',focus:null,explode:0}];
  byId<HTMLInputElement>('stepRange').max=String(steps.length-1);
  document.querySelector('.ticks')!.replaceChildren(...steps.map(s=>{const el=document.createElement('span');el.textContent=s.name.split(' / ')[0];return el;}));
  byId<HTMLElement>('heroTitle').textContent=profile.name;
  byId<HTMLElement>('profileNote').textContent=profile.note;
  byId<HTMLElement>('heroNote').textContent='正方形封装 · 玻璃架构 · 精密金属';
  byId<HTMLElement>('sourceLinks').replaceChildren();
  profile.sources.forEach((url,i)=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='官方资料'+(i?String(i+1):'')+' ↗';byId<HTMLElement>('sourceLinks').append(a);});
  updateBadge();updateIdentity();goStep(0);
}
byId<HTMLSelectElement>('chipSelect').replaceChildren();
profiles.forEach(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.name;byId<HTMLSelectElement>('chipSelect').append(option);});
byId<HTMLSelectElement>('chipSelect').addEventListener('change',ev=>switchProfile((ev.target as HTMLSelectElement).value));
byId<HTMLButtonElement>('overviewBtn').addEventListener('click',()=>{stopPlayback();showAll();setExplode(.82);focus(null);});
byId<HTMLButtonElement>('shellViewBtn').addEventListener('click',()=>{stopPlayback();showAll();setExplode(0);focus(null);setCamera(cameraPresets.shell.position,cameraPresets.shell.target);});
byId<HTMLButtonElement>('topViewBtn').addEventListener('click',()=>{stopPlayback();showAll();setExplode(.82);focus(null);setCamera([0,23,.01],[0,.3,0]);});
byId<HTMLButtonElement>('resetBtn').addEventListener('click',()=>{stopPlayback();focus(null);});
byId<HTMLInputElement>('explodeInput').addEventListener('input',ev=>{stopPlayback();setExplode(Number((ev.target as HTMLInputElement).value)/100);syncManualStage();});
byId<HTMLInputElement>('shellToggle').addEventListener('change',ev=>shellVisible=(ev.target as HTMLInputElement).checked);
byId<HTMLInputElement>('coreToggle').addEventListener('change',ev=>internalsVisible=(ev.target as HTMLInputElement).checked);
byId<HTMLInputElement>('glassInput').addEventListener('input',ev=>{
  const n=Number((ev.target as HTMLInputElement).value)/100;
  glassOpacity=n;runtimes.forEach(b=>b.mat.opacity=n);byId<HTMLOutputElement>('glassValue').value=Math.round(n*100)+'%';
});
byId<HTMLInputElement>('shellColor').addEventListener('input',ev=>{identity().color=(ev.target as HTMLInputElement).value;shellMaterial.color.set(identity().color);});
byId<HTMLInputElement>('roughnessInput').addEventListener('input',ev=>{glassRoughness=Number((ev.target as HTMLInputElement).value)/100;runtimes.forEach(b=>b.mat.roughness=glassRoughness);byId<HTMLOutputElement>('roughnessValue').value=Math.round(glassRoughness*100)+'%';});
byId<HTMLInputElement>('flowInput').addEventListener('input',ev=>{flowStrength=Number((ev.target as HTMLInputElement).value)/100;byId<HTMLOutputElement>('flowValue').value=Math.round(flowStrength*100)+'%';});
byId<HTMLInputElement>('speedInput').addEventListener('input',ev=>{flowSpeed=Number((ev.target as HTMLInputElement).value)/100;byId<HTMLOutputElement>('speedValue').value=flowSpeed.toFixed(2)+'×';});
byId<HTMLInputElement>('exposureInput').addEventListener('input',ev=>{renderer.toneMappingExposure=Number((ev.target as HTMLInputElement).value)/100;byId<HTMLOutputElement>('exposureValue').value=renderer.toneMappingExposure.toFixed(2);});
byId<HTMLInputElement>('gridToggle').addEventListener('change',ev=>grid.visible=(ev.target as HTMLInputElement).checked);
byId<HTMLInputElement>('isolateToggle').addEventListener('change',ev=>isolated=(ev.target as HTMLInputElement).checked);
function applyLighting(mode:string):void{
  const red=mode==='red',neutral=mode==='neutral';
  const bg=red?'#370207':neutral?'#0d1521':'#080b12';scene.background=new THREE.Color(bg);(scene.fog as THREE.FogExp2).color.set(bg);
  (floor.material as THREE.MeshStandardMaterial).color.set(red?'#59040a':neutral?'#192331':'#101722');
  key.color.set(red?'#ffdbca':neutral?'#eef5ff':'#fff1e8');warm.color.set(red?'#ff2b20':neutral?'#ccd8ff':'#ffe4ba');
  warm.intensity=red?160:45;cool.color.set(red?'#ff7970':'#b5caff');cool.intensity=red?100:55;
}
byId<HTMLSelectElement>('lightingSelect').addEventListener('change',ev=>applyLighting((ev.target as HTMLSelectElement).value));
byId<HTMLSelectElement>('identitySelect').addEventListener('change',ev=>{identity().mode=(ev.target as HTMLSelectElement).value;updateIdentity();});
for(const id of ['brandInput','modelInput'])byId<HTMLInputElement>(id).addEventListener('input',()=>{
  const s=identity();s.brand=byId<HTMLInputElement>('brandInput').value;s.model=byId<HTMLInputElement>('modelInput').value;s.mode='custom';updateIdentity();
});
byId<HTMLInputElement>('textureInput').addEventListener('change',ev=>{
  const file=(ev.target as HTMLInputElement).files?.[0];if(!file)return;
  if(file.size>16*1024*1024){window.alert('请选择 16MB 以内的顶盖图片。');return;}
  const state=identity(),reader=new FileReader();reader.onload=()=>{state.upload=String(reader.result);state.mode='reference';if(state===identity()){updateBadge();updateIdentity();}};reader.readAsDataURL(file);
});
byId<HTMLButtonElement>('clearTextureBtn').addEventListener('click',()=>{
  const s=identity();s.upload=null;s.mode='reference';s.brand=profile.brand;s.model=profile.model;
  byId<HTMLInputElement>('textureInput').value='';updateBadge();updateIdentity();
});
byId<HTMLButtonElement>('prevBtn').addEventListener('click',()=>{stopPlayback();goStep(stepIndex-1);});
byId<HTMLButtonElement>('nextBtn').addEventListener('click',()=>{stopPlayback();goStep(stepIndex+1);});
byId<HTMLButtonElement>('playBtn').addEventListener('click',togglePlayback);
byId<HTMLInputElement>('stepRange').addEventListener('input',ev=>{stopPlayback();goStep(Number((ev.target as HTMLInputElement).value));});
function toggleClean():void{document.body.classList.toggle('clean-mode');}
byId<HTMLButtonElement>('cleanBtn').addEventListener('click',toggleClean);
byId<HTMLButtonElement>('restoreUiBtn').addEventListener('click',toggleClean);
function downloadBlob(blob:Blob,filename:string):void{
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
byId<HTMLButtonElement>('savePngBtn').addEventListener('click',()=>{
  renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)downloadBlob(blob,profile.id+'.png');},'image/png');
});
const canSaveInline=!document.querySelector('script[type="module"][src]');
byId<HTMLButtonElement>('saveHtmlBtn').disabled=!canSaveInline;
if(!canSaveInline)byId<HTMLButtonElement>('saveHtmlBtn').title='在离线单 HTML 中打开后可保存';
byId<HTMLButtonElement>('saveHtmlBtn').addEventListener('click',()=>{
  const settings={version:1,profile:profile.id,identities:Array.from(identities.entries()),glassOpacity,glassRoughness,flowStrength,flowSpeed,
    exposure:renderer.toneMappingExposure,lighting:byId<HTMLSelectElement>('lightingSelect').value,explode:targetExplode,selected,
    shellVisible,internalsVisible,isolated,grid:grid.visible,camera:camera.position.toArray(),target:controls.target.toArray()};
  const clone=document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('#viewport canvas,#sceneAudit,#embeddedSettings').forEach(el=>el.remove());
  const config=document.createElement('script');config.id='embeddedSettings';config.type='application/json';config.textContent=JSON.stringify(settings).replace(/</g,'\\u003c');
  clone.querySelector('head')!.append(config);
  downloadBlob(new Blob(['<!doctype html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'}),'XPIN-CHIP-'+profile.id+'.html');
});
window.addEventListener('keydown',ev=>{
  if((ev.target as HTMLElement).matches('input,textarea,select'))return;
  if(ev.code==='KeyH')toggleClean();
  if(ev.code==='KeyR'){stopPlayback();goStep(0);}
  if(ev.code==='Space'){ev.preventDefault();togglePlayback();}
  if(ev.code==='ArrowRight'){stopPlayback();goStep(stepIndex+1);}
  if(ev.code==='ArrowLeft'){stopPlayback();goStep(stepIndex-1);}
});
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
let downX=0,downY=0;
renderer.domElement.addEventListener('pointerdown',ev=>{downX=ev.clientX;downY=ev.clientY;});
renderer.domElement.addEventListener('pointerup',ev=>{
  if(Math.hypot(ev.clientX-downX,ev.clientY-downY)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((ev.clientX-rect.left)/rect.width*2-1,-(ev.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const candidates:THREE.Object3D[]=runtimes.filter(b=>b.group.visible).map(b=>b.glass);
  if(cover.visible)candidates.push(casing,skirt,top,textureOverlay);
  const found=raycaster.intersectObjects(candidates,false);
  if(found.length&&found[0].object.userData.blockId){stopPlayback();const id=found[0].object.userData.blockId as string;focus(id);}
});
renderer.domElement.addEventListener('dblclick',()=>{stopPlayback();focus(null);});

function resizeViewport():void{
  const {width,height}=viewport.getBoundingClientRect();
  if(width<=0||height<=0)return;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  if(!manualCamera)setCamera(requestedPosition.toArray(),requestedTarget.toArray());
}
const resizeObserver=new ResizeObserver(resizeViewport);resizeObserver.observe(viewport);resizeViewport();
const clock=new THREE.Clock();
const auditOutput=document.createElement('output');auditOutput.id='sceneAudit';auditOutput.hidden=true;document.body.append(auditOutput);
let auditElapsed=0;
function render():void{
  const dt=Math.min(clock.getDelta(),1),alpha=1-Math.exp(-dt*5.0);
  flowTime+=dt*flowSpeed;
  explode=THREE.MathUtils.lerp(explode,targetExplode,alpha);
  if(Math.abs(explode-targetExplode)<.0001)explode=targetExplode;
  cover.visible=shellVisible;
  // Lift vertically until the entire skirt clears the die, then retreat.
  // Reversing this path seats the cover from above rather than sliding through blocks.
  cover.position.set(0,explode*3.8,-13.5*Math.max(0,(explode-.18)/.82));
  for(let i=0;i<runtimes.length;i++){
    const r=runtimes[i],b=r.data;
    r.group.visible=internalsVisible&&(!isolated||!selected||b.id===selected);
    const direction=new THREE.Vector2(b.x,b.z).normalize();
    r.group.position.set(b.x+direction.x*explode*.10,explode*(.08+.04*(i%3)),b.z+direction.y*explode*.10);
    const positions=r.flow.geometry.getAttribute('position');
    for(let j=0;j<r.flowPaths.length;j++){
      const p=r.flowPaths[j],travel=((flowTime*.45+p.phase)%1-.5)*p.len;
      positions.setXYZ(j,p.x+(p.axis===0?travel:0),.246+b.thickness*.35,p.z+(p.axis===1?travel:0));
    }
    positions.needsUpdate=true;r.flow.visible=flowStrength>0;(r.flow.material as THREE.PointsMaterial).opacity=flowStrength*.60;
  }
  if(!manualCamera){
    camera.position.lerp(goalPosition,alpha);
    controls.target.lerp(goalTarget,alpha);
  }
  controls.update();
  renderer.render(scene,camera);
  auditElapsed+=dt;
  if(auditElapsed>.4){
    auditElapsed=0;scene.updateMatrixWorld(true);
    const lidBounds=new THREE.Box3().setFromObject(skirt),baseBounds=new THREE.Box3().setFromObject(lowerRim);
    const glassTop=Math.max(...runtimes.map(r=>new THREE.Box3().setFromObject(r.glass).max.y));
    const roofBottom=new THREE.Box3().setFromObject(casing).min.y;
    const focused=runtimes.find(r=>r.data.id===selected);
    let focusFraming:null|{inside:boolean;ndc:number[][]}=null;
    if(focused){const box=new THREE.Box3().setFromObject(focused.glass);const points:number[][]=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(camera).toArray());focusFraming={inside:points.every(p=>Math.abs(p[0])<.96&&Math.abs(p[1])<.96&&p[2]>-1&&p[2]<1),ndc:points};}
    auditOutput.dataset.profile=profile.id;auditOutput.dataset.focus=selected||'';auditOutput.dataset.framing=String(focusFraming?.inside||false);
    auditOutput.dataset.settled=String((manualCamera||camera.position.distanceTo(goalPosition)<.01&&controls.target.distanceTo(goalTarget)<.01)&&Math.abs(explode-targetExplode)<.001);
    auditOutput.textContent=JSON.stringify({profile:profile.id,package:[chip.width,chip.depth],explode,targetExplode,selected,visibleBlocks:runtimes.filter(r=>r.group.visible).map(r=>r.data.id),seamGap:lidBounds.min.y-baseBounds.max.y,roofClearance:roofBottom-glassTop,identity:identity().mode,brand:identity().brand,model:identity().model,glassOpacity,glassRoughness,flowStrength,flowSpeed,flowTime,flowSample:Array.from(runtimes[0].flow.geometry.getAttribute('position').array).slice(0,3),badgeLoaded:!!badgeMat.map,focusFraming,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,networkResources:performance.getEntriesByType('resource').map(r=>r.name).filter(url=>/^https?:/.test(url))});
  }
}
renderer.setAnimationLoop(render);
byId<HTMLElement>('renderStatus').textContent='LIVE / PBR STUDIO';
byId<HTMLInputElement>('glassInput').value='64';
byId<HTMLOutputElement>('glassValue').value='64%';
byId<HTMLInputElement>('roughnessInput').value='5';
byId<HTMLOutputElement>('roughnessValue').value='5%';
switchProfile(profile.id);
// The offline file can carry its own editable state, with no browser storage or network.
try{
  const text=document.getElementById('embeddedSettings')?.textContent;
  if(text){
    const saved=JSON.parse(text);
    if(saved.version===1&&profiles.some(p=>p.id===saved.profile)){
      for(const [id,state] of saved.identities||[])if(profiles.some(p=>p.id===id))identities.set(id,{mode:['reference','custom','none'].includes(state.mode)?state.mode:'reference',brand:String(state.brand).slice(0,36),model:String(state.model).slice(0,60),color:/^#[0-9a-f]{6}$/i.test(state.color)?state.color:'#202632',upload:typeof state.upload==='string'&&/^data:image\//.test(state.upload)?state.upload:null});
      glassOpacity=THREE.MathUtils.clamp(Number(saved.glassOpacity)||0,0,1);glassRoughness=THREE.MathUtils.clamp(Number(saved.glassRoughness)||.045,.02,.65);
      flowStrength=THREE.MathUtils.clamp(Number(saved.flowStrength)||0,0,1);flowSpeed=THREE.MathUtils.clamp(Number(saved.flowSpeed)||0,0,1.5);
      switchProfile(saved.profile);byId<HTMLSelectElement>('chipSelect').value=saved.profile;
      for(const [id,value,suffix] of [['glass',glassOpacity,'%'],['roughness',glassRoughness,'%'],['flow',flowStrength,'%'],['speed',flowSpeed,'×']] as const){
        byId<HTMLInputElement>(id+'Input').value=String(value*100);byId<HTMLOutputElement>(id+'Value').value=suffix==='×'?value.toFixed(2)+'×':Math.round(value*100)+'%';
      }
      renderer.toneMappingExposure=THREE.MathUtils.clamp(Number(saved.exposure)||1.1,.6,1.8);byId<HTMLInputElement>('exposureInput').value=String(renderer.toneMappingExposure*100);byId<HTMLOutputElement>('exposureValue').value=renderer.toneMappingExposure.toFixed(2);
      const lighting=['studio','red','neutral'].includes(saved.lighting)?saved.lighting:'studio';byId<HTMLSelectElement>('lightingSelect').value=lighting;applyLighting(lighting);
      if(saved.selected&&layout.some(b=>b.id===saved.selected))focus(saved.selected);
      setExplode(Number(saved.explode)||0);explode=targetExplode;
      syncManualStage();
      shellVisible=!!saved.shellVisible;internalsVisible=!!saved.internalsVisible;isolated=!!saved.isolated;grid.visible=!!saved.grid;
      byId<HTMLInputElement>('shellToggle').checked=shellVisible;byId<HTMLInputElement>('coreToggle').checked=internalsVisible;byId<HTMLInputElement>('isolateToggle').checked=isolated;byId<HTMLInputElement>('gridToggle').checked=grid.visible;
      if(Array.isArray(saved.camera)&&Array.isArray(saved.target)&&[...saved.camera,...saved.target].every(Number.isFinite)){setCamera(saved.camera,saved.target,false);camera.position.fromArray(saved.camera);controls.target.fromArray(saved.target);controls.update();}
    }
  }
}catch{console.warn('保存状态无法读取，已使用默认芯片设置。');}
