/**
 * Engine primitives. Pure and deterministic; browser APIs are only in adapters.
 * World coordinates: x east, y up, z south; distances in metres.
 */
export const EPS=1e-9;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
export const fract=x=>x-Math.floor(x);
export const vec=(x=0,y=0,z=0)=>({x,y,z});
export const add=(a,b)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a,b)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
export const mul=(a,k)=>vec(a.x*k,a.y*k,a.z*k);
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a,b)=>vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const norm=a=>mul(a,1/Math.max(EPS,length(a)));
export const mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
export const hash=(x,y=0,z=0,seed=1)=>{
  let k=Math.imul((x|0)^seed,374761393)+Math.imul(y|0,668265263)+Math.imul(z|0,1274126177);
  k=Math.imul(k^(k>>>13),1274126177);return ((k^(k>>>16))>>>0)/4294967296;
};
export const rng=(seed=1)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296};
export const fade=t=>t*t*t*(t*(t*6-15)+10);
export function noise2(x,y,seed=1){
 const i=Math.floor(x),j=Math.floor(y),u=fade(fract(x)),v=fade(fract(y));
 return lerp(lerp(hash(i,j,0,seed),hash(i+1,j,0,seed),u),
   lerp(hash(i,j+1,0,seed),hash(i+1,j+1,0,seed),u),v)*2-1;
}
export function noise3(x,y,z,seed=1){
 const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z);
 const u=fade(fract(x)),v=fade(fract(y)),w=fade(fract(z));
 const plane=h=>lerp(lerp(hash(i,j,k+h,seed),hash(i+1,j,k+h,seed),u),
  lerp(hash(i,j+1,k+h,seed),hash(i+1,j+1,k+h,seed),u),v);
 return lerp(plane(0),plane(1),w)*2-1;
}
export function grid(width,height,fn){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
 width*height>2e7)throw RangeError("Invalid grid budget");
 const out=new Float32Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)out[y*width+x]=fn(x,y);
 return out;
}
export function sampleGrid(data,w,h,x,y){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||
 data.length!==w*h)throw RangeError("Invalid sample grid dimensions");
 x=clamp(x,0,w-1);y=clamp(y,0,h-1);
 const i=Math.floor(x),j=Math.floor(y),k=Math.min(w-1,i+1),l=Math.min(h-1,j+1);
 return lerp(lerp(data[j*w+i],data[j*w+k],x-i),lerp(data[l*w+i],data[l*w+k],x-i),y-j);
}
export const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
export const distance2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const saturate=(x)=>clamp(x);
export function assertGrid(data,w,h){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||
 !(data instanceof Float32Array)||data.length!==w*h)
 throw TypeError("Expected Float32Array of integer width*height");
}
