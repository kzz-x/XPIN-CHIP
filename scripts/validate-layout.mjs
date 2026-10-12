import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/chips.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {profiles}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const failures=[],report=[];
for(const p of profiles){
  let minimumGap=Infinity;
  for(let f=0;f<=100;f++){
    const e=f/100;
    const blocks=p.blocks.map(b=>{const len=Math.hypot(b.x,b.z)||1;return {...b,x:b.x+b.x/len*e*.1,z:b.z+b.z/len*e*.1};});
    for(const b of blocks)if(Math.abs(b.x)+b.width/2+.01>4.84||Math.abs(b.z)+b.depth/2+.01>4.84)failures.push(`${p.id} ${b.id}: package clearance at ${e}`);
    for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){
      const a=blocks[i],b=blocks[j];
      const gap=Math.max(Math.abs(a.x-b.x)-(a.width+b.width)/2-.02,Math.abs(a.z-b.z)-(a.depth+b.depth)/2-.02);
      minimumGap=Math.min(minimumGap,gap);
      if(gap<0)failures.push(`${p.id}: ${a.id} / ${b.id} overlap at ${e}`);
    }
  }
  report.push({profile:p.id,blocks:p.blocks.length,samples:101,minimumBlockGap:Number(minimumGap.toFixed(6))});
}
const html=fs.readFileSync(new URL('../XPIN-CHIP-Standalone.html',import.meta.url),'utf8');
const externalTags=html.match(/<(?:script|link|img)\b[^>]*(?:src|href)="(?!data:)[^\"]+"/g)||[];
if(externalTags.length)failures.push('Standalone has external tags: '+externalTags.join('\n'));
const result={profiles:report,squarePackage:[10.4,10.4],htmlBytes:Buffer.byteLength(html),externalAssetTags:externalTags.length,failures};
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0&&process.argv[outputIndex+1])fs.writeFileSync(process.argv[outputIndex+1],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;
