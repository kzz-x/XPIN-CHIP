export type Tile = { label:string; sub:string; x:number; z:number; width:number; depth:number };
export type BlockData = { id:string; label:string; type:string; x:number; z:number; width:number; depth:number; thickness:number; color:string; description:string; tiles?:Tile[] };
export type ChipProfile = { id:string; name:string; brand:string; model:string; family:'mediatek'|'snapdragon'; color:string; accent:string; badge:'pro'|'m'|'9500'|'snapdragon'; extreme?:boolean; note:string; sources:string[]; blocks:BlockData[] };
const mtSource='https://www.mediatek.com/products/smartphones/mediatek-dimensity-9600-pro';
const mtMSource='https://www.mediatek.com/press-room/mediatek-dimensity-9600-pro-sets-new-standard-for-flagship-smartphone-chips';
const mt9500='https://www.mediatek.com/products/smartphones/mediatek-dimensity-9500';
const sdSource='https://www.qualcomm.com/news/releases/2026/09/snapdragon-leads-the-agentic-ai-age-with-two-of-the-world-s-fast';
const block=(id:string,label:string,type:string,x:number,z:number,width:number,depth:number,color:string,description:string,tiles?:Tile[]):BlockData=>({id,label,type,x,z,width,depth,thickness:.29,color,description,tiles});
const cores=(old=false):Tile[]=>{
  const tiles:Tile[]=[];
  if(old){
    tiles.push({label:'C1-Ultra',sub:'2MB L2',x:-.98,z:-.64,width:1.05,depth:.74});
    for(let i=0;i<3;i++)tiles.push({label:'C1-Premium',sub:'1MB L2',x:-1.06+i*1.04,z:.24,width:.94,depth:.65});
    for(let i=0;i<4;i++)tiles.push({label:'C1-Pro',sub:'512KB L2',x:-1.17+i*.78,z:1.03,width:.70,depth:.57});
  }else{
    for(let i=0;i<2;i++)tiles.push({label:'C2-Ultra',sub:'2MB L2',x:-.80+i*1.60,z:-.63,width:1.48,depth:.96});
    for(let j=0;j<2;j++)for(let i=0;i<3;i++)tiles.push({label:'C2-Pro',sub:j?'512KB L2':'1MB L2',x:-1.05+i*1.05,z:.40+j*.76,width:.96,depth:.66});
  }
  tiles.push({label:'16MB L3',sub:'SHARED CACHE',x:0,z:1.80,width:3.05,depth:.45});return tiles;
};
function mtBlocks(variant:'pro'|'m'|'9500'):BlockData[]{
  const old=variant==='9500',m=variant==='m';
  return [
    block('cpu','CPU',m?'CPU COMPUTE':old?'Arm C1 · 1+3+4':'Arm C2 · 2+3+3',-2.60,-2.20,3.70,4.60,'#efb964',m?'CPU 区为参考架构示意，未填入未经确认的核心型号。':'全大核 CPU；核心与缓存标签根据官方资料整理。',m?undefined:cores(old)),
    block('gpu','GPU',m?'NEURAL GRAPHICS':old?'Mali-G1 Ultra MC12':'Mali-G2 Ultra NX',1.27,-2.20,3.70,4.60,'#72b9ff','图形并行运算区；沿用参考图的上部右侧层级。'),
    block('npu','NPU',m?'AGENTIC AI':old?'MediaTek NPU 990':'MediaTek NPU 1090',-1.20,.92,6.46,1.24,'#ba91df','生成式与智能体 AI 加速区；电路图案为示意。'),
    block('sensor','SENSOR',m?'ALWAYS-ON':old?'CONTEXT HUB':'SUPER EFFICIENT NPU 2.0',2.76,.92,1.26,1.24,'#8fbfbc','低功耗智能及传感器中枢。'),
    block('isp','ISP',m?'AI IMAGING':old?'Imagiq 1190':'Imagiq 1290',-.53,2.33,7.84,1.20,'#d894bd','影像处理区：保留参考中的横向 ISP 管线。'),
    block('security','SECURITY','HARDWARE TRUST',-3.57,3.80,1.74,1.47,'#9aa6b6','安全隔离与硬件信任根示意。'),
    block('connect','CONNECT','WIRELESS / MODEM',-.99,3.80,3.16,1.47,'#a8bacb','无线连接与蜂窝调制解调区示意。'),
    block('video','VIDEO',m||old?'VIDEO / DISPLAY':'H.266 / DISPLAY',2.11,3.80,2.55,1.47,'#b4b8c4','视频与显示处理管线；位置及微观结构为视觉示意。'),
    block('slc','SLC',m?'SYSTEM CACHE':'10MB SYSTEM CACHE',3.73,0,.48,9.04,'#a1b2c4',m?'系统缓存区域示意，容量未确认。':'10MB 系统级缓存。'),
    block('memory','MEMORY',m?'MEMORY / STORAGE':old?'LPDDR5X / UFS 4.1':'LPDDR6 / UFS 5.0',4.35,0,.56,9.04,'#aacdbf','存储与内存控制列；控制逻辑位于 SoC，外部存储介质不在此 die 内。'),
  ];
}
function sdBlocks(extreme:boolean):BlockData[]{return [
  block('cpu','Oryon CPU','Qualcomm',-.64,-3.12,7.74,2.80,'#e9b594','新一代 Oryon CPU；保留参考中的顶部主计算区。'),
  block('gpu','Adreno GPU','Qualcomm',-.64,-.77,7.74,1.69,'#c993b5','Adreno 图形加速区，电路走线与分区为示意。'),
  block('npu','Hexagon NPU','Qualcomm',-.64,1.09,7.74,1.75,'#c6a0dc',extreme?'超级至尊版 Hexagon AI 加速区；容量与版图未作物理还原。':'Hexagon AI 加速区。'),
  block('isp','Spectra ISP','Qualcomm',-3.16,2.77,2.69,1.35,'#c29cb8','影像信号处理区。'),
  block('security','Security','SECURE DOMAIN',-.42,2.77,2.61,1.35,'#c8b0a0','安全处理域。'),
  block('sensor','Sensing Hub','ALWAYS-ON',2.06,2.77,2.18,1.35,'#bca0b8','始终开启的传感器中枢。'),
  block('modem','X105','5G MODEM-RF',-2.42,4.00,4.17,.93,'#d4ab9a','Qualcomm X105 5G Modem-RF，位置依照所提供的架构图整理。'),
  block('connect','FastConnect 8800','Qualcomm',1.48,4.00,3.40,.93,'#a8bfc6','FastConnect 无线连接模块，名称依照所提供的参考图。'),
  block('memory','Memory',extreme?'LPDDR6 / LPDDR5X':'LPDDR5X',4.04,0,1.36,9.05,'#d5bbb5','内存控制区域；内部图案保留玻璃电路质感。'),
];}
export const profiles:ChipProfile[]=[
  {id:'dimensity-9600-pro',name:'天玑 9600 Pro',brand:'MEDIATEK',model:'DIMENSITY 9600 PRO',family:'mediatek',color:'#202632',accent:'#dabc7b',badge:'pro',note:'参考布局 · 官方型号标签 · 示意微电路',sources:[mtSource],blocks:mtBlocks('pro')},
  {id:'dimensity-9600m',name:'天玑 9600M',brand:'MEDIATEK',model:'DIMENSITY 9600M',family:'mediatek',color:'#222a38',accent:'#dabc7b',badge:'m',note:'参考架构示意；9600M 详细核心规格未确认',sources:[mtMSource],blocks:mtBlocks('m')},
  {id:'dimensity-9500',name:'天玑 9500',brand:'MEDIATEK',model:'DIMENSITY 9500',family:'mediatek',color:'#232a36',accent:'#d6b97d',badge:'9500',note:'官方型号标签 · 参考式示意布局',sources:[mt9500],blocks:mtBlocks('9500')},
  {id:'snapdragon-8-elite-gen6',name:'第六代骁龙 8 至尊版',brand:'Snapdragon',model:'8 ELITE GEN 6',family:'snapdragon',color:'#950e19',accent:'#e4c982',badge:'snapdragon',note:'所提供架构图布局 · 示意微电路',sources:[sdSource],blocks:sdBlocks(false)},
  {id:'snapdragon-8-elite-extreme-gen6',name:'第六代骁龙 8 超级至尊版',brand:'Snapdragon',model:'8 ELITE EXTREME GEN 6',family:'snapdragon',color:'#a00e18',accent:'#edce85',badge:'snapdragon',extreme:true,note:'所提供架构图布局 · 示意微电路',sources:[sdSource],blocks:sdBlocks(true)},
];
