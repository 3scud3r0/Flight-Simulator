/** Algorithms 001–020: map-agnostic geology and terrain geometry. */
import {clamp,lerp,smooth,fract,hash,noise2,noise3,rng,grid,assertGrid,vec,norm,dot,cross,sub,mul,add} from "./math.js";
export function perlin2(x,y,seed=1){
 const ix=Math.floor(x),iy=Math.floor(y),u=fract(x),v=fract(y);
 const grad=(a,b,dx,dy)=>{const angle=hash(a,b,0,seed)*Math.PI*2;return Math.cos(angle)*dx+Math.sin(angle)*dy};
 return lerp(lerp(grad(ix,iy,u,v),grad(ix+1,iy,u-1,v),smooth(u)),
 lerp(grad(ix,iy+1,u,v-1),grad(ix+1,iy+1,u-1,v-1),smooth(u)),smooth(v))*1.415;
}
export function simplex2(x,y,seed=1){
 const F=(Math.sqrt(3)-1)/2,G=(3-Math.sqrt(3))/6;
 const i=Math.floor(x+(x+y)*F),j=Math.floor(y+(x+y)*F);
 const t=(i+j)*G,x0=x-1*(i-t),y0=y-1*(j-t);
 const i1=x0>y0?1:0,j1=1-i1;
 const pts=[[x0,y0,0,0],[x0-i1+G,y0-j1+G,i1,j1],[x0-1+2*G,y0-1+2*G,1,1]];
 let sum=0;
 for(const [px,py,dx,dy] of pts){let t=.5-px*px-py*py;if(t>0){
 const ang=hash(i+dx,j+dy,0,seed)*Math.PI*2;t*=t;
 sum+=t*t*(Math.cos(ang)*px+Math.sin(ang)*py);
 }}
 return 70*sum;
}
export function fractalBrownianMotion(x,y,{octaves=6,lacunarity=2,gain=.5,seed=1}={}){
 let sum=0,amp=1,freq=1,norm=0;
 for(let i=0;i<clamp(octaves,1,12);i++){sum+=perlin2(x*freq,y*freq,seed+i*37)*amp;norm+=amp;freq*=lacunarity;amp*=gain}
 return sum/Math.max(norm,1e-9);
}
export function ridgedMultifractal(x,y,{octaves=6,seed=1}={}){
 let sum=0,amp=1,frequency=1,weight=1,normal=0;
 for(let i=0;i<clamp(octaves,1,12);i++){
 let ridge=1-Math.abs(perlin2(x*frequency,y*frequency,seed+i*19));
 ridge=ridge*ridge*weight;weight=clamp(ridge*2);
 sum+=ridge*amp;normal+=amp;frequency*=2;amp*=.55;
 }return sum/normal;
}
export function domainWarp(x,y,seed=1,strength=.75){
 const dx=fractalBrownianMotion(x+.7,y+1.7,{seed});
 const dy=fractalBrownianMotion(x+5.3,y-2.1,{seed:seed+1});
 return {x:x+dx*strength,y:y+dy*strength,value:fractalBrownianMotion(x+dx*strength,y+dy*strength,{seed:seed+2})};
}
export function tectonicUplift(x,y,plates,{collisionWidth=.13}={}){
 let best=null,d1=Infinity,second=null,d2=Infinity;
 for(const p of plates){const d=Math.hypot(x-p.x,y-p.y);if(d<d1){second=best;d2=d1;best=p;d1=d}else if(d<d2){second=p;d2=d}}
 if(!best)return 0;
 const boundary=Math.exp(-1*((d2-d1)/collisionWidth)**2);
 const vx=(best.vx||0)-1*(second?.vx||0),vy=(best.vy||0)-1*(second?.vy||0);
 const delta=second?{x:second.x-best.x,y:second.y-best.y}:{x:0,y:0};
 const collision=Math.max(0,vx*delta.x+vy*delta.y)/(Math.hypot(delta.x,delta.y)||1);
 return (best.elevation||0)+(boundary*collision*(best.strength||1));
}
export function voronoiGeology(x,y,sites){
 return sites.map((s,i)=>({id:i,distance:Math.hypot(x-s.x,y-s.y),material:s.material??0}))
 .sort((a,b)=>a.distance-b.distance).slice(0,2);
}
export function hydraulicErosion(data,w,h,{iterations=200,seed=3,capacity=3,evaporation=.08}={}){
 assertGrid(data,w,h);const H=new Float32Array(data),random=rng(seed);
 for(let n=0;n<Math.min(iterations,20000);n++){
 let x=1+Math.floor(random()*(w-2)),y=1+Math.floor(random()*(h-2)),water=1,sediment=0;
 for(let k=0;k<50;k++){const i=y*w+x;let lowest=i,best=H[i];
 for(const j of [i-1,i+1,i-w,i+w])if(H[j]<best){best=H[j];lowest=j}
 if(lowest===i)break;
 const drop=H[i]-best,target=Math.max(.001,drop*water*capacity);
 if(sediment>target){const d=(sediment-target)*.35;H[i]+=d;sediment-=d}
 else{const d=Math.min(drop*.35,(target-sediment)*.08);H[i]-=d;sediment+=d}
 x=lowest%w;y=Math.floor(lowest/w);water*=1-evaporation;
 if(x<1||x>=w-1||y<1||y>=h-1||water<.01)break;
 }}
 return H;
}
export function thermalErosion(data,w,h,{iterations=8,talus=.9,strength=.3}={}){
 assertGrid(data,w,h);let H=new Float32Array(data);
 for(let k=0;k<iterations;k++){const delta=new Float32Array(H.length);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
 const i=y*w+x;
 for(const j of [i-1,i+1,i-w,i+w]){const excess=H[i]-H[j]-talus;if(excess>0){const flow=excess*strength*.25;delta[i]-=flow;delta[j]+=flow}}
 }H=H.map((z,i)=>z+delta[i])}return H;
}
export function aeolianErosion(data,w,h,{windX=1,windY=0,steps=4,rate=.008}={}){
 assertGrid(data,w,h);let H=new Float32Array(data);
 const dx=Math.sign(windX),dy=Math.sign(windY);
 for(let k=0;k<steps;k++){const d=new Float32Array(H.length);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,j=(y+dy)*w+x+dx;
 const moved=Math.max(0,H[i]-H[j]) * rate;d[i]-=moved;d[j]+=moved}
 H=H.map((v,i)=>v+d[i]);}return H;
}
export function depositSediment(heights,sediment,w,h,rate=.1){
 assertGrid(heights,w,h);assertGrid(sediment,w,h);
 return {height:heights.map((v,i)=>v+sediment[i]*rate),sediment:sediment.map(v=>v*(1-rate))};
}
export function riverFlowDirection(heights,w,h){
 assertGrid(heights,w,h);const flow=new Int32Array(w*h).fill(-1);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
 const i=y*w+x;let best=heights[i];
 for(const j of [i-1,i+1,i-w,i+w,i-w-1,i-w+1,i+w-1,i+w+1])
 if(heights[j]<best){best=heights[j];flow[i]=j}
 }return flow;
}
export function watershedBasins(flow,w,h){
 const outlet=new Int32Array(w*h).fill(-1);
 for(let i=0;i<flow.length;i++){if(outlet[i]>=0)continue;
 let p=i,walk=[],seen=new Set();
 while(p>=0&&!seen.has(p)&&outlet[p]<0){seen.add(p);walk.push(p);p=flow[p]}
 const sink=p<0?walk.at(-1):outlet[p]>=0?outlet[p]:p;
 for(const j of walk)outlet[j]=sink;
 }return outlet;
}
export function glacierProfile(distance,width,{slope=.04,thickness=300,erosion=1}={}){
 const normalized=clamp(Math.abs(distance)/Math.max(width,1));
 return {ice:thickness*Math.pow(1-normalized,1.5),cut:erosion*Math.pow(1-normalized,2)*slope*width};
}
export function volcanicCaldera(x,y,{cx=0,cy=0,radius=2,rim=200,depth=130}={}){
 const d=Math.hypot(x-cx,y-cy)/Math.max(radius,1e-6);
 return rim*Math.exp(-1*((d-1)/.16)**2)-depth*Math.exp(-1*(d/.65)**4);
}
export function caveDensity(x,y,z,{seed=1,scale=.025,threshold=.24}={}){
 const warp=noise3(x*scale,y*scale,z*scale,seed);
 const chambers=noise3(x*scale*.4+2,y*scale*.4,z*scale*.4,seed+2);
 return warp*.65+chambers*.35-threshold;
}
export function marchingCubesTetrahedra(sample,nx,ny,nz,iso=0){
 // Tetrahedral subdivision of cubic cells avoids ambiguous marching-cubes cases.
 const vertices=[],triangles=[];
 const cube=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
 const points=cube.map(p=>({x:x+p[0],y:y+p[1],z:z+p[2]}));const values=points.map(p=>sample(p.x,p.y,p.z));
 for(const cell of tetra){const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],hits=[];
 for(const [a,b] of edges){const ia=cell[a],ib=cell[b],va=values[ia]-iso,vb=values[ib]-iso;
 if((va<0)===(vb<0))continue;const t=clamp(va/(va-vb));
 hits.push(add(points[ia],mul(sub(points[ib],points[ia]),t)));}
 if(hits.length>=3){const start=vertices.length;vertices.push(...hits);
 triangles.push([start,start+1,start+2]);
 if(hits.length===4)triangles.push([start,start+2,start+3]);}
 }}return {vertices,triangles};
}
export function dualContourCell(sample,x,y,z,iso=0){
 // Local QEF surrogate: centroid of the edge intersections, bounded to cell.
 const c=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];
 const p=c.map(v=>vec(x+v[0],y+v[1],z+v[2])),v=p.map(a=>sample(a.x,a.y,a.z)-iso),hits=[];
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){const d=sub(p[j],p[i]);
 if(Math.abs(d.x)+Math.abs(d.y)+Math.abs(d.z)!==1||((v[i]<0)===(v[j]<0)))continue;
 hits.push(add(p[i],mul(d,clamp(v[i]/(v[i]-v[j])))));}
 if(!hits.length)return null;
 return vec(clamp(hits.reduce((s,p)=>s+p.x,0)/hits.length,x,x+1),
 clamp(hits.reduce((s,p)=>s+p.y,0)/hits.length,y,y+1),
 clamp(hits.reduce((s,p)=>s+p.z,0)/hits.length,z,z+1));
}
export function signedDistanceUnion(a,b){return Math.min(a,b)}
export function signedDistanceDifference(a,b){return Math.max(a,-b)}
export function signedDistanceSphere(p,center,radius){return Math.hypot(p.x-center.x,p.y-center.y,p.z-center.z)-radius}
export function biomeWeights({altitude=0,temperature=20,moisture=.5,slope=0}={}){
 const snow=clamp((altitude-2400)/1300+(2-temperature)/12);
 const desert=clamp((.36-moisture)*2)*clamp((temperature-6)/25);
 const rock=clamp((slope-.55)*2.5);const forest=clamp(moisture*.9)*clamp((temperature+8)/28)*(1-snow);
 const grass=clamp(1-snow-desert-rock-forest);
 const weights={snow,desert,rock,forest,grass},total=Object.values(weights).reduce((a,b)=>a+b,0)||1;
 return Object.fromEntries(Object.entries(weights).map(([k,v])=>[k,v/total]));
}
export const algorithms=[perlin2,simplex2,fractalBrownianMotion,ridgedMultifractal,domainWarp,tectonicUplift,voronoiGeology,hydraulicErosion,thermalErosion,aeolianErosion,depositSediment,riverFlowDirection,watershedBasins,glacierProfile,volcanicCaldera,caveDensity,marchingCubesTetrahedra,dualContourCell,signedDistanceSphere,biomeWeights];
