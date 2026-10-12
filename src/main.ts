import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import './style.css';

type BlockData = { id:string; label:string; type:string; x:number; z:number; width:number; depth:number; thickness:number; color:string; description:string };
type ChipData = { id:string; name:string; tagline:string; width:number; depth:number; shell:{brand:string;model:string;color:string;accent:string;texture:string|null}; defaults:{explode:number;glassOpacity:number} };
type MaterialData = { glass:{opacity:number;roughness:number;transmission:number;ior:number;thickness:number}; shell:{metalness:number;roughness:number;clearcoat:number}; lighting:{exposure:number;accentWarm:string;accentCool:string} };
type CameraPreset = { position:number[]; target:number[] };
type Step = {name:string;focus:string|null;explode:number};
type Annotation = Record<string,{title:string;body:string}>;
type BlockRuntime = {data:BlockData;group:THREE.Group;glass:THREE.Mesh;mat:THREE.MeshPhysicalMaterial;edge:THREE.LineLoop;label:THREE.Mesh};

const byId = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const baseUrl = import.meta.env.BASE_URL + 'chips/demo/';
async function loadJson<T>(file:string):Promise<T>{
  const response = await fetch(baseUrl + file);
  if(!response.ok) throw new Error(file + ': HTTP ' + response.status);
  return response.json() as Promise<T>;
}
const [chip, layout, annotations, materials, cameraPresets, steps] = await Promise.all([
  loadJson<ChipData>('chip.config.json'),
  loadJson<BlockData[]>('layout.json'),
  loadJson<Annotation>('annotations.json'),
  loadJson<MaterialData>('materials.json'),
  loadJson<Record<string,CameraPreset>>('cameraPresets.json'),
  loadJson<Step[]>('presentation.json')
]);

const viewport = byId<HTMLDivElement>('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#070b11');
scene.fog = new THREE.FogExp2('#070b11', 0.015);
const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 140);
camera.position.fromArray(cameraPresets.overview.position);
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance', preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = materials.lighting.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.prepend(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();
const hemi = new THREE.HemisphereLight('#e2efff', '#1c2535', 2.0);scene.add(hemi);
const key = new THREE.DirectionalLight('#fff1e8',5.0);
key.position.set(-6,12,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-16;key.shadow.camera.right=16;key.shadow.camera.top=16;key.shadow.camera.bottom=-16;
key.shadow.bias=-0.0002;scene.add(key);
const warm = new THREE.PointLight(materials.lighting.accentWarm,85,32,2);warm.position.set(-9,5,-3);scene.add(warm);
const cool = new THREE.PointLight(materials.lighting.accentCool,65,32,2);cool.position.set(7,4,2);scene.add(cool);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.055;
controls.maxPolarAngle=Math.PI * 0.48;controls.minDistance=4.0;controls.maxDistance=34;
controls.target.fromArray(cameraPresets.overview.target);controls.update();
const goalPosition=camera.position.clone(), goalTarget=controls.target.clone();
let manualCamera=false;
controls.addEventListener('start',()=>{manualCamera=true;});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#090d13',metalness:0.13,roughness:0.78}));
floor.rotation.x=-Math.PI/2;floor.position.y=-0.75;floor.receiveShadow=true;scene.add(floor);
const grid = new THREE.GridHelper(70,70,'#263c4d','#1d2c3d');
grid.position.y=-0.744;
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
  const geo=new THREE.ExtrudeGeometry(roundedShape(w,d,r),{depth:h,steps:1,curveSegments:10,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3});
  geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,mat);
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function outline(w:number,d:number,r:number,color:string):THREE.LineLoop{
  const pts=roundedShape(w,d,r).getPoints(10).map(p=>new THREE.Vector3(p.x,0,-p.y));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity:0.75}));
}
function seededRand(seed:number):()=>number{
  let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
}
function microTexture(seed:number,color:string):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=768;c.height=512;
  const ctx=c.getContext('2d')!;const r=seededRand(seed);
  ctx.fillStyle='#0b1520';ctx.fillRect(0,0,c.width,c.height);
  ctx.lineWidth=1;ctx.strokeStyle='rgba(170,210,225,.17)';
  for(let x=0;x<c.width;x+=12){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke();}
  for(let y=0;y<c.height;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke();}
  ctx.strokeStyle=color;ctx.globalAlpha=0.35;
  for(let i=0;i<185;i++){
    const x=Math.floor(r()*64)*12, y=Math.floor(r()*42)*12;
    const len=(2+Math.floor(r()*11))*12;
    ctx.lineWidth=r()>0.6?2:1;ctx.beginPath();ctx.moveTo(x,y);
    if(r()>.5){ctx.lineTo(Math.min(765,x+len),y);}else{ctx.lineTo(x,Math.min(509,y+len));}
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
  x.font='700 142px Arial,sans-serif';x.fillText(main,40,125);
  x.font='500 44px Arial,sans-serif';x.fillStyle='#c5d8e9';x.fillText(sub,44,249);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function plane(w:number,d:number,mat:THREE.Material,y:number):THREE.Mesh{
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);p.rotation.x=-Math.PI/2;p.position.y=y;return p;
}

const chipRoot=new THREE.Group();scene.add(chipRoot);
const baseMat=new THREE.MeshPhysicalMaterial({color:'#2a303c',metalness:.76,roughness:.28,clearcoat:.65});
const substrate=roundedSolid(chip.width,chip.depth,.20,.31,baseMat);
substrate.position.y=-.26;chipRoot.add(substrate);
const edgeMat=new THREE.MeshStandardMaterial({color:'#837f83',metalness:.9,roughness:.21});
const lowerRim=roundedSolid(chip.width-.16,chip.depth-.16,.042,.23,edgeMat,.02);
lowerRim.position.y=-.055;chipRoot.add(lowerRim);
const dieMat=new THREE.MeshPhysicalMaterial({color:'#141d28',metalness:.45,roughness:.39});
const dieBase=roundedSolid(chip.width-.42,chip.depth-.4,.10,.18,dieMat,.015);
dieBase.position.y=0.015;chipRoot.add(dieBase);

const runtimes:BlockRuntime[]=[];
for(let i=0;i<layout.length;i++){
  const b=layout[i], group=new THREE.Group();group.position.set(b.x,0,b.z);chipRoot.add(group);
  const dark=new THREE.MeshStandardMaterial({color:'#0c1524',metalness:.64,roughness:.34});
  const foundation=roundedSolid(b.width,b.depth,.09,.17,dark,.01);foundation.position.y=.13;group.add(foundation);
  const boardPattern=plane(b.width-.10,b.depth-.10,new THREE.MeshBasicMaterial({map:microTexture(329+i*97,b.color),transparent:true,opacity:.9,depthWrite:false}),.245);
  group.add(boardPattern);
  const mat=new THREE.MeshPhysicalMaterial({color:new THREE.Color(b.color).lerp(new THREE.Color('#a4bbc9'),.43),
    metalness:.03,roughness:materials.glass.roughness,transparent:true,
    opacity:materials.glass.opacity,transmission:materials.glass.transmission,
    ior:materials.glass.ior,thickness:materials.glass.thickness,clearcoat:1,clearcoatRoughness:.07,depthWrite:false});
  const glass=roundedSolid(b.width-.09,b.depth-.09,b.thickness,.17,mat,.045);glass.position.y=.245;glass.userData.blockId=b.id;group.add(glass);
  const edge=outline(b.width-.04,b.depth-.04,.18,b.color);edge.position.y=.245+b.thickness+.065;group.add(edge);
  const tex=labelTexture(b.label,b.type);const ratio=Math.min(b.width*.77,2.5);
  const label=plane(ratio,ratio*.32,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}),.245+b.thickness+.092);
  label.position.x=-b.width*.04;group.add(label);
  runtimes.push({data:b,group,glass,mat,edge,label});
}
const allGlass=runtimes.map(b=>b.glass);
const font=new FontLoader().parse(fontJson as unknown as object);
const cover=new THREE.Group();chipRoot.add(cover);
const shellMaterial=new THREE.MeshPhysicalMaterial({color:chip.shell.color,metalness:materials.shell.metalness,
  roughness:materials.shell.roughness,clearcoat:materials.shell.clearcoat,clearcoatRoughness:.16});
const casing=roundedSolid(chip.width+.14,chip.depth+.14,.23,.42,shellMaterial,.085);cover.add(casing);
const topMat=new THREE.MeshPhysicalMaterial({color:'#1d090b',metalness:.6,roughness:.22,clearcoat:.9,clearcoatRoughness:.1});
const top=roundedSolid(chip.width-.38,chip.depth-.4,.04,.32,topMat,.025);top.position.y=.28;cover.add(top);
const insetFrame=outline(chip.width-.34,chip.depth-.37,.32,chip.shell.accent);insetFrame.position.y=.355;cover.add(insetFrame);
const textureOverlay=plane(chip.width-.56,chip.depth-.6,
  new THREE.MeshBasicMaterial({transparent:true,opacity:.96,side:THREE.DoubleSide,depthWrite:false}),.369);
textureOverlay.visible=false;cover.add(textureOverlay);
function raisedText(value:string,size:number,z:number,color:string,depth:number):THREE.Mesh{
  const geo=new TextGeometry(value,{font,size,depth,curveSegments:7,bevelEnabled:true,
    bevelSize:.007,bevelThickness:.006,bevelSegments:2});
  geo.computeBoundingBox();
  const box=geo.boundingBox!;geo.translate(-(box.max.x+box.min.x)/2,-(box.max.y+box.min.y)/2,0);
  geo.rotateX(-Math.PI/2);
  const mat=new THREE.MeshPhysicalMaterial({color,metalness:.92,roughness:.18,clearcoat:1,clearcoatRoughness:.12});
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(0,.389,z);mesh.castShadow=true;return mesh;
}
const wordmark=raisedText(chip.shell.brand,1.22,-.62,chip.shell.accent,.085);cover.add(wordmark);
const modelmark=raisedText(chip.shell.model,.22,1.58,'#e3beb0',.024);cover.add(modelmark);
const slash=roundedSolid(5.1,.055,.02,.01,new THREE.MeshStandardMaterial({color:chip.shell.accent,metalness:.9,roughness:.23}),.003);
slash.position.set(0,.367,.71);cover.add(slash);

let selected:string|null=null;
let explode=chip.defaults.explode, targetExplode=explode;
let shellVisible=true, internalsVisible=true;
let stepIndex=0, playTimer:number|null=null;
const defaultCamera=cameraPresets.overview;
function setCamera(pos:number[],target:number[]):void{
  manualCamera=false;goalPosition.fromArray(pos);goalTarget.fromArray(target);
}
function focus(id:string|null):void{
  selected=id;
  runtimes.forEach(b=>{
    (b.edge.material as THREE.LineBasicMaterial).color.set(b.data.id===id?'#ffffff':b.data.color);
    (b.edge.material as THREE.LineBasicMaterial).opacity=b.data.id===id?1:.65;
    b.edge.scale.setScalar(b.data.id===id?1.015:1);
  });
  document.querySelectorAll<HTMLButtonElement>('.block-buttons button').forEach(el=>el.classList.toggle('active',el.dataset.block===id));
  if(id){
    const b=runtimes.find(x=>x.data.id===id)!.data;
    const s=Math.max(b.width,b.depth);
    setCamera([b.x+s*.77,3.5+s*.82,b.z+2.4+s*.77],[b.x,.34,b.z]);
    targetExplode=Math.max(targetExplode,.66);
    byId<HTMLElement>('selectedTitle').textContent=annotations[id]?.title||b.label;
    byId<HTMLElement>('selectedDesc').textContent=annotations[id]?.body||b.description;
  }else{
    setCamera(defaultCamera.position,defaultCamera.target);
    byId<HTMLElement>('selectedTitle').textContent=chip.name;
    byId<HTMLElement>('selectedDesc').textContent='选择任意架构模块，镜头将顺滑推进特写。此示例的微电路属于视觉化纹理，非真实物理 die 版图。';
  }
  byId<HTMLInputElement>('explodeInput').value=String(Math.round(targetExplode*100));
  byId<HTMLOutputElement>('explodeValue').value=Math.round(targetExplode*100)+'%';
}
function setExplode(value:number):void{
  targetExplode=THREE.MathUtils.clamp(value,0,1);
  byId<HTMLInputElement>('explodeInput').value=String(Math.round(targetExplode*100));
  byId<HTMLOutputElement>('explodeValue').value=Math.round(targetExplode*100)+'%';
}
function goStep(index:number):void{
  stepIndex=(index+steps.length)%steps.length;const s=steps[stepIndex];
  setExplode(s.explode);focus(s.focus);if(s.focus===null&&s.explode===0)setCamera(cameraPresets.shell.position,cameraPresets.shell.target);
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
for(const b of layout){
  const el=document.createElement('button');el.dataset.block=b.id;el.innerHTML='<span class="block-indicator"></span><span>'+b.label+'</span><small>'+b.type+'</small>';
  el.style.setProperty('--accent',b.color);
  el.addEventListener('click',()=>focus(b.id));byId<HTMLElement>('blockButtons').append(el);
}
byId<HTMLButtonElement>('overviewBtn').addEventListener('click',()=>{stopPlayback();setExplode(.82);focus(null);});
byId<HTMLButtonElement>('shellViewBtn').addEventListener('click',()=>{stopPlayback();setExplode(0);focus(null);setCamera(cameraPresets.shell.position,cameraPresets.shell.target);});
byId<HTMLInputElement>('explodeInput').addEventListener('input',ev=>setExplode(Number((ev.target as HTMLInputElement).value)/100));
byId<HTMLInputElement>('shellToggle').addEventListener('change',ev=>shellVisible=(ev.target as HTMLInputElement).checked);
byId<HTMLInputElement>('coreToggle').addEventListener('change',ev=>internalsVisible=(ev.target as HTMLInputElement).checked);
byId<HTMLInputElement>('glassInput').addEventListener('input',ev=>{
  const n=Number((ev.target as HTMLInputElement).value)/100;
  runtimes.forEach(b=>b.mat.opacity=n);byId<HTMLOutputElement>('glassValue').value=Math.round(n*100)+'%';
});
byId<HTMLInputElement>('shellColor').addEventListener('input',ev=>shellMaterial.color.set((ev.target as HTMLInputElement).value));
let currentTextureUrl:string|null=null;
byId<HTMLInputElement>('textureInput').addEventListener('change',ev=>{
  const file=(ev.target as HTMLInputElement).files?.[0];if(!file)return;
  if(currentTextureUrl)URL.revokeObjectURL(currentTextureUrl);
  currentTextureUrl=URL.createObjectURL(file);
  new THREE.TextureLoader().load(currentTextureUrl,texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    const m=textureOverlay.material as THREE.MeshBasicMaterial;
    m.map=texture;m.needsUpdate=true;textureOverlay.visible=true;
  });
});
byId<HTMLButtonElement>('prevBtn').addEventListener('click',()=>{stopPlayback();goStep(stepIndex-1);});
byId<HTMLButtonElement>('nextBtn').addEventListener('click',()=>{stopPlayback();goStep(stepIndex+1);});
byId<HTMLButtonElement>('playBtn').addEventListener('click',togglePlayback);
byId<HTMLInputElement>('stepRange').addEventListener('input',ev=>{stopPlayback();goStep(Number((ev.target as HTMLInputElement).value));});
function toggleClean():void{document.body.classList.toggle('clean-mode');}
byId<HTMLButtonElement>('cleanBtn').addEventListener('click',toggleClean);
window.addEventListener('keydown',ev=>{
  if((ev.target as HTMLElement).matches('input,textarea'))return;
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
  const found=raycaster.intersectObjects(allGlass,false);
  if(found.length){const id=found[0].object.userData.blockId as string;focus(id);}
});
renderer.domElement.addEventListener('dblclick',()=>focus(null));

const resizeObserver=new ResizeObserver(()=>{
  const {width,height}=viewport.getBoundingClientRect();
  if(width<=0||height<=0)return;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
});resizeObserver.observe(viewport);
const clock=new THREE.Clock();
function render():void{
  const dt=Math.min(clock.getDelta(),.05),alpha=1-Math.exp(-dt*5.0);
  explode=THREE.MathUtils.lerp(explode,targetExplode,alpha);
  cover.visible=shellVisible;
  cover.position.set(-explode*1.0,.54+explode*3.5,-explode*4.75);
  for(let i=0;i<runtimes.length;i++){
    const r=runtimes[i],b=r.data;
    r.group.visible=internalsVisible;
    const direction=new THREE.Vector2(b.x,b.z).normalize();
    r.group.position.set(b.x+direction.x*explode*.10,explode*(.08+.04*(i%3)),b.z+direction.y*explode*.10);
  }
  if(!manualCamera){
    camera.position.lerp(goalPosition,alpha);
    controls.target.lerp(goalTarget,alpha);
  }
  controls.update();
  renderer.render(scene,camera);
}
renderer.setAnimationLoop(render);
byId<HTMLElement>('renderStatus').textContent='RENDERING / 60 FPS TARGET';
byId<HTMLInputElement>('glassInput').value=String(Math.round(chip.defaults.glassOpacity*100));
byId<HTMLOutputElement>('glassValue').value=Math.round(chip.defaults.glassOpacity*100)+'%';
byId<HTMLInputElement>('shellColor').value=chip.shell.color;
goStep(0);
