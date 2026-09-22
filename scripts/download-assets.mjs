/** Fetch and independently verify pinned CC0 assets during CI. Not a runtime CDN. */
import {KENNEY_FILES,KENNEY_COMMIT,POLY_HAVEN_MATERIALS}
 from "../src/asset-manifest.js";
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile,stat} from "node:fs/promises";
import {dirname,resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const out=resolve(root,"assets");
const base="https://raw.githubusercontent.com/shorepine/kenney/";
const hardFailures=[];
let loaded=0,bytes=0,skipped=0,poly=0;
async function download(url,path,sha=null,optional=false){
 const dest=resolve(out,path);
 if(!dest.startsWith(out+"/"))throw Error("Unsafe path");
 const expected=sha;
 function validate(buffer){
  if(buffer.byteLength<300)throw Error("Unexpectedly small response");
  if(path.endsWith(".glb")&&
     buffer.toString("ascii",0,4)!=="glTF")
     throw Error("Expected glTF binary");
  if(path.endsWith(".png")&&
     buffer.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")
     throw Error("Expected PNG");
  if(expected){
   const hash=createHash("sha1")
    .update(Buffer.from("blob "+buffer.length+"\0"))
    .update(buffer).digest("hex");
   if(hash!==expected)throw Error("Git blob checksum mismatch: "+path);
  }
 }
 try{
  try{
   const old=await readFile(dest);validate(old);
   skipped++;return;
  }catch{}
  let error;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const signal=AbortSignal.timeout(30000);
    const reply=await fetch(url,{signal,headers:{
     "User-Agent":"Flight-Simulator-Open-CC0-Asset-Build"}});
    if(!reply.ok)throw Error("HTTP "+reply.status+" "+url);
    const buffer=Buffer.from(await reply.arrayBuffer());
    validate(buffer);
    await mkdir(dirname(dest),{recursive:true});
    await writeFile(dest,buffer);
    loaded++;bytes+=buffer.length;
    return;
   }catch(e){error=e;await new Promise(r=>setTimeout(r,500*(attempt+1)))}
  }
  throw error;
 }catch(error){
  if(optional){console.warn("Optional PBR material unavailable:",path,error.message);return;}
  hardFailures.push(path+": "+error.message);
 }
}
for(let i=0;i<KENNEY_FILES.length;i+=6){
 await Promise.all(KENNEY_FILES.slice(i,i+6).map(file=>
  download(base+KENNEY_COMMIT+"/"+file.path,
   "kenney/"+file.path.slice(3),file.sha)));
}
if(hardFailures.length){
 console.error("CC0 source or SHA mismatch:",hardFailures.join("\n"));
 process.exit(1);
}
for(const id of POLY_HAVEN_MATERIALS){
 for(const kind of ["diff",...(id==="aerial_asphalt_01"?
   ["nor_gl"]:[])]){
  const file=id+"_"+kind+"_1k.png";
  await download(
   "https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/"+
   id+"/"+file,"pbr/"+file,null,true);
 }
}
const report={
 source:"Kenney Nature/City/Space packs (CC0); Poly Haven CC0 PBR",
 pinnedCommit:KENNEY_COMMIT,
 kenneyFiles:KENNEY_FILES.length,downloaded:loaded,
 reused:skipped,downloadedBytes:bytes,
 location:"assets/kenney/ and assets/pbr/"
};
await writeFile(resolve(out,"asset-report.json"),
 JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
