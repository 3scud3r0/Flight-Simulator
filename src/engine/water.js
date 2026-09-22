/** Algorithms 093–102: numerical water-surface and optical kernels. */
import {clamp,lerp,vec,norm,dot} from "./math.js";
export function gerstnerWaves(x,z,t,waves){
 let out=vec(x,0,z),dx=0,dz=0;
 for(const w of waves){const d=norm({x:w.dx??0,y:0,z:w.dz??1});
 const k=2*Math.PI/Math.max(.01,w.wavelength),phase=k*(d.x*x+d.z*z)-1*(w.speed||1)*t;
 const amp=Math.max(0,w.amplitude||0),q=clamp(w.steepness??.6,0,1);
 out.x+=q*amp*d.x*Math.cos(phase);out.y+=amp*Math.sin(phase);
 out.z+=q*amp*d.z*Math.cos(phase);
 dx+=amp*k*d.x*Math.cos(phase);dz+=amp*k*d.z*Math.cos(phase);
 }return {position:out,normal:norm({x:-dx,y:1,z:-dz})};
}
function fft1d(real,imag,inverse=false){
 const N=real.length;if(N<1||(N&(N-1)))throw RangeError("FFT length must be power of two");
 let j=0;for(let i=1;i<N;i++){let bit=N>>>1;for(;j&bit;bit>>>=1)j^=bit;j^=bit;
 if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]]}}
 for(let len=2;len<=N;len*=2){const phi=(inverse?2:-2)*Math.PI/len;
 for(let i=0;i<N;i+=len)for(let k=0;k<len/2;k++){
 const theta=k*phi,c=Math.cos(theta),s=Math.sin(theta);
 const ar=real[i+k+len/2]*c-imag[i+k+len/2]*s;
 const ai=real[i+k+len/2]*s+imag[i+k+len/2]*c;
 real[i+k+len/2]=real[i+k]-ar;imag[i+k+len/2]=imag[i+k]-ai;
 real[i+k]+=ar;imag[i+k]+=ai;
 }}
 if(inverse)for(let i=0;i<N;i++){real[i]/=N;imag[i]/=N}
}
export function fftOceanSurface(spectrumReal,spectrumImag,N){
 if(N<2||N>1024||(N&(N-1))||spectrumReal.length!==N*N||
 spectrumImag.length!==N*N)throw RangeError("Spectrum must be a power-of-two 2D grid up to 1024²");
 const real=Float64Array.from(spectrumReal),imag=Float64Array.from(spectrumImag);
 for(let y=0;y<N;y++){
 const r=real.slice(y*N,(y+1)*N),m=imag.slice(y*N,(y+1)*N);
 fft1d(r,m,true);real.set(r,y*N);imag.set(m,y*N)}
 for(let x=0;x<N;x++){const r=new Float64Array(N),m=new Float64Array(N);
 for(let y=0;y<N;y++){r[y]=real[y*N+x];m[y]=imag[y*N+x]}
 fft1d(r,m,true);for(let y=0;y<N;y++){real[y*N+x]=r[y];imag[y*N+x]=m[y]}}
 return real;
}
export function oceanSpectrum(kx,kz,wind,amplitude=.004){
 const k=Math.hypot(kx,kz);if(k<1e-7)return 0;
 const speed=Math.max(.1,Math.hypot(wind.x,wind.z));
 const L=speed*speed/9.81,kw=(kx*wind.x+kz*wind.z)/(k*speed);
 return amplitude*Math.exp(-1/(k*L)**2)/(k**4) *kw*kw*Math.exp(-k*k*.0003);
}
export function fresnelReflection(cosAngle,iorA=1,iorB=1.333){
 if(iorA<=0||iorB<=0)throw RangeError("Refractive indices must be positive");
 const f0=((iorA-iorB)/(iorA+iorB))**2;
 return f0+(1-f0)*(1-clamp(cosAngle))**5;
}
export function waterAbsorption(rgb,depth,coeff=[.16,.07,.025]){
 return rgb.map((v,i)=>v*Math.exp(-Math.max(0,depth)*coeff[i]));
}
export function foamGeneration(slope,curvature,shoreDistance){
 return clamp((slope-.23)*2+(curvature-.28)*.6+
 Math.exp(-Math.max(0,shoreDistance)/9)*.72);
}
export function shoalingWaves(deepAmplitude,deepSpeed,depth){
 const c=Math.sqrt(9.81*Math.max(.05,depth)),factor=Math.sqrt(Math.max(0,deepSpeed)/Math.max(.2,c));
 return {amplitude:deepAmplitude*clamp(factor,.45,2.2),speed:c};
}
export function wakeField(x,z,time,{speed=20,width=12,amplitude=.9}={}){
 const behind=Math.max(0,-z+time*speed),spread=Math.max(.01,width)+.13*behind;
 return amplitude*Math.exp(-1*(x/spread)**2)*Math.sin(behind*.36-time*1.2)*
 clamp(behind/10)*Math.exp(-behind/450);
}
export function riverFlowField(pos,riverPath,speed=2){
 if(riverPath.length<2)return vec();
 let nearest=Infinity,tangent=vec();
 for(let i=0;i<riverPath.length-1;i++){
 const a=riverPath[i],b=riverPath[i+1],dx=b.x-a.x,dz=b.z-a.z;
 const t=clamp(((pos.x-a.x)*dx+(pos.z-a.z)*dz)/(dx*dx+dz*dz||1));
 const px=a.x+t*dx,pz=a.z+t*dz,dist=Math.hypot(pos.x-px,pos.z-pz);
 if(dist<nearest){nearest=dist;tangent=norm({x:dx,y:0,z:dz})}}
 return {x:tangent.x*speed*Math.exp(-nearest/300),y:0,
 z:tangent.z*speed*Math.exp(-nearest/300)};
}
export function sunGlitter(normal,eye,sun,roughness=.16){
 const n=norm(normal),v=norm(eye),s=norm(sun);
 const h=norm({x:v.x+s.x,y:v.y+s.y,z:v.z+s.z});
 return Math.pow(clamp(dot(n,h)),Math.max(2,1/(roughness*roughness)));
}
export const algorithms=[gerstnerWaves,fftOceanSurface,oceanSpectrum,
 fresnelReflection,waterAbsorption,foamGeneration,shoalingWaves,
 wakeField,riverFlowField,sunGlitter];
