/** Algorithms 021–040: bounded streaming, LOD, visibility and GPU lifetime. */
import {clamp,vec,length,sub,add,mul} from "./math.js";
export function quadtree(bounds,depth,estimate,threshold=1,maxNodes=16384){
 let nodes=0;maxNodes=Math.max(1,Math.min(16384,maxNodes|0));
 const visit=(box,d)=>{if(nodes>=maxNodes)return null;nodes++;
 const node={bounds:box,children:null,error:estimate(box)};
 if(d<=0||node.error<=threshold||nodes>=maxNodes)return node;
 const {x,y,size}=box,h=size/2;
 node.children=[[x,y],[x+h,y],[x,y+h],[x+h,y+h]]
 .map(([a,b])=>visit({x:a,y:b,size:h},d-1)).filter(Boolean);return node;};
 return visit(bounds,Math.min(depth,15));
}
export function octree(bounds,depth,occupied,maxNodes=16384){
 let nodes=0;maxNodes=Math.max(1,Math.min(16384,maxNodes|0));
 const visit=(b,d)=>{if(nodes>=maxNodes)return null;nodes++;
 const count=occupied(b),n={bounds:b,count,children:null};
 if(d<=0||!count||nodes>=maxNodes)return n;const h=b.size/2;
 n.children=[];for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)
 {const child=visit({x:b.x+x*h,y:b.y+y*h,z:b.z+z*h,size:h},d-1);
 if(child)n.children.push(child);}
 return n;};return visit(bounds,Math.min(10,depth));
}
export function geometryClipmap(center,levels=5,base=32){
 const result=[];for(let i=0;i<levels;i++){const step=2**i;
 result.push({level:i,step,origin:{x:Math.floor(center.x/step)*step,z:Math.floor(center.z/step)*step},
 size:base*step,inner:i===0?0:base*step/4});}return result;
}
export function continuousLOD(distance,ranges=[60,180,500,1500]){
 const d=Math.max(0,distance),i=ranges.findIndex(t=>d<t);
 if(i<0)return {level:ranges.length,blend:0};
 const prev=i?ranges[i-1]:0;return {level:i,blend:clamp((d-prev)/(ranges[i]-prev))};
}
export function screenSpaceError(geometricError,distance,fovY,viewportHeight){
 return geometricError*viewportHeight/
 (2*Math.max(.01,distance)*Math.tan(fovY*.5));
}
export function geomorph(coarse,fine,t){
 if(coarse.length!==fine.length)throw RangeError("LOD buffers must match");
 return coarse.map((v,i)=>v+(fine[i]-v)*clamp(t))
}
export function stitchTileSkirt(vertices,boundary,drop=5){
 const verts=vertices.map(p=>({...p})),faces=[];
 for(const i of boundary)verts.push({...vertices[i],y:vertices[i].y-drop});
 for(let k=0;k<boundary.length;k++){const n=(k+1)%boundary.length;
 const a=boundary[k],b=boundary[n],c=vertices.length+k,d=vertices.length+n;
 faces.push([a,b,c],[b,d,c]);}return {vertices:verts,triangles:faces};
}
export function frustumCullSphere(planes,center,radius=0){
 return planes.every(p=>p.n.x*center.x+p.n.y*center.y+p.n.z*center.z+p.d>=-radius);
}
export function occlusionCull(occluders,target){
 return occluders.some(o=>o.depth<target.depth&&
 o.left<=target.left&&o.right>=target.right&&
 o.top<=target.top&&o.bottom>=target.bottom);
}
export function hierarchicalZBuffer(depth,width,height,levels=Infinity){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
 width*height!==depth.length||depth.length>16000000)throw RangeError("Invalid depth map");
 const chain=[{data:new Float32Array(depth),width,height}];
 while(width>1||height>1){if(chain.length>=levels)break;
 const w=Math.ceil(width/2),h=Math.ceil(height/2),next=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let m=-Infinity;
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
 const xx=x*2+dx,yy=y*2+dy;if(xx<width&&yy<height)m=Math.max(m,depth[yy*width+xx]);}
 next[y*w+x]=m;}
 chain.push({data:next,width:w,height:h});depth=next;width=w;height=h;}return chain;
}
export function packInstances(transforms){
 if(transforms.length>100000)throw RangeError("Instance budget exceeded");
 const data=new Float32Array(transforms.length*16);
 for(let i=0;i<transforms.length;i++){
 if(transforms[i].length!==16)throw RangeError("Expected 4x4 transform");
 data.set(transforms[i],i*16);
 }
 return {matrices:data,count:transforms.length,stride:16};
}
export function indirectDrawCommands(groups){
 let offset=0;return groups.map(g=>{const draw={
 indexCount:g.indexCount,instanceCount:g.instances.length,
 firstIndex:g.firstIndex||0,baseVertex:g.baseVertex||0,baseInstance:offset};
 offset+=g.instances.length;return draw;});
}
export function spatialStreamQueue(position,tiles,max=16){
 return tiles.map(tile=>({...tile,
 priority:Math.hypot(tile.x-position.x,tile.z-position.z)}))
 .sort((a,b)=>a.priority-b.priority).slice(0,Math.max(0,Math.floor(max)));
}
export function predictivePrefetch(position,velocity,tiles,{seconds=8,max=16}={}){
 const ahead=add(position,mul(velocity,seconds));
 return spatialStreamQueue(ahead,tiles,max);
}
export function memoryBudget(resources,maxBytes){
 maxBytes=Math.max(0,maxBytes);
 const kept=new Set(resources.map(r=>r.id)),evict=[];
 let bytes=resources.reduce((s,r)=>s+r.bytes,0);
 for(const r of [...resources].sort((a,b)=>(a.priority||0)-(b.priority||0))){
 if(bytes<=maxBytes)break;if(r.pinned)continue;kept.delete(r.id);evict.push(r.id);bytes-=r.bytes;
 }return {kept,evict,bytes,underBudget:bytes<=maxBytes};
}
export function disposeResources(resources){
 const visited=new Set();let count=0;
 for(const object of resources){if(!object||visited.has(object))continue;
 visited.add(object);if(typeof object.dispose==="function"){object.dispose();count++;}}
 return count;
}
export function boundedWorkerPool(jobs,limit,worker){
 const queue=jobs.map((value,index)=>({value,index}));
 const results=new Array(jobs.length);
 let active=0,settled=false,resolve,reject;
 const done=new Promise((res,rej)=>{resolve=res;reject=rej});
 const next=()=>{
  if(settled)return;
  if(!queue.length&&!active){settled=true;resolve(results);return}
  while(active<Math.max(1,limit)&&queue.length){
   const {value,index}=queue.shift();active++;
   Promise.resolve().then(()=>worker(value,index)).then(result=>{
    results[index]=result;active--;next();
   },error=>{if(!settled){settled=true;queue.length=0;reject(error)}});
  }
 };
 next();return done;
}
export function originRebase(worldPoints,origin){
 return worldPoints.map(p=>vec(p.x-origin.x,p.y-origin.y,p.z-origin.z));
}
export function splitDouble(value){
 const high=Math.fround(value);return [high,Math.fround(value-high)];
}
export function prioritizedWork(tasks,budgetMs){
 let spent=0;const selected=[],deferred=[];
 for(const task of [...tasks].sort((a,b)=>b.priority-a.priority)){
 if(spent+task.cost<=budgetMs){selected.push(task);spent+=task.cost}
 else deferred.push(task);
 }return {selected,deferred,spent};
}
export const algorithms=[quadtree,octree,geometryClipmap,continuousLOD,
 screenSpaceError,geomorph,stitchTileSkirt,frustumCullSphere,occlusionCull,
 hierarchicalZBuffer,packInstances,indirectDrawCommands,spatialStreamQueue,
 predictivePrefetch,memoryBudget,disposeResources,boundedWorkerPool,
 originRebase,splitDouble,prioritizedWork];
