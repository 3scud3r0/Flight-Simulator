/** Registry of 180 executable, map-independent algorithm cores.
 * These are CPU-side/scene-independent cores, NOT a complete AAA renderer.
 * Shader/GPU/driver integration and visual validation are separate milestones.
 */
import {algorithms as group0} from "./generation.js";
import {algorithms as group1} from "./streaming.js";
import {algorithms as group2} from "./materials.js";
import {algorithms as group3} from "./lighting.js";
import {algorithms as group4} from "./weather.js";
import {algorithms as group5} from "./water.js";
import {algorithms as group6} from "./dynamics.js";
import {algorithms as group7} from "./airframes.js";
import {algorithms as group8} from "./infrastructure.js";
import {algorithms as group9} from "./experience.js";
import {algorithms as group10} from "./performance.js";
export * as MathCore from "./math.js";
export * as Generation from "./generation.js";
export * as Streaming from "./streaming.js";
export * as Materials from "./materials.js";
export * as Lighting from "./lighting.js";
export * as Weather from "./weather.js";
export * as Water from "./water.js";
export * as Dynamics from "./dynamics.js";
export * as Airframes from "./airframes.js";
export * as Infrastructure from "./infrastructure.js";
export * as Experience from "./experience.js";
export * as Performance from "./performance.js";
export const algorithmGroups=Object.freeze([
  {name:"generation",title:"Geologia e geração",start:1,end:20,stage:"núcleo numérico",algorithms:group0},
  {name:"streaming",title:"Terreno e streaming",start:21,end:40,stage:"planejamento/estrutura",algorithms:group1},
  {name:"materials",title:"Materiais e superfícies",start:41,end:55,stage:"núcleo de material",algorithms:group2},
  {name:"lighting",title:"Iluminação e atmosfera",start:56,end:74,stage:"núcleo de iluminação",algorithms:group3},
  {name:"weather",title:"Nuvens e meteorologia",start:75,end:92,stage:"núcleo físico/visual",algorithms:group4},
  {name:"water",title:"Água e oceano",start:93,end:102,stage:"núcleo numérico",algorithms:group5},
  {name:"dynamics",title:"Dinâmica de voo",start:103,end:130,stage:"modelo experimental",algorithms:group6},
  {name:"airframes",title:"Aeronaves",start:131,end:142,stage:"malha/animação",algorithms:group7},
  {name:"infrastructure",title:"Aeroportos e tráfego",start:143,end:154,stage:"geração/IA",algorithms:group8},
  {name:"experience",title:"Áudio e experiência",start:155,end:166,stage:"núcleo de gameplay",algorithms:group9},
  {name:"performance",title:"Desempenho e testes",start:167,end:180,stage:"instrumentação",algorithms:group10}
]);
export const catalog=Object.freeze(algorithmGroups.flatMap(group=>
 group.algorithms.map((run,index)=>Object.freeze({
  id:group.start+index,
  code:"A"+String(group.start+index).padStart(3,"0"),
  name:run.name,category:group.title,stage:group.stage,run
 }))));
if(catalog.length!==180||catalog.some((item,index)=>item.id!==index+1))
 throw Error("Engine registry must contain algorithms 001–180 in order");
export function getAlgorithm(id){
 const number=typeof id==="string"?Number(id.replace(/^A/i,"")):id;
 return Number.isInteger(number)&&number>=1&&number<=180?
 catalog[number-1]:null;
}
export function runAlgorithm(id,...args){
 const algorithm=getAlgorithm(id);
 if(!algorithm)throw RangeError("Unknown engine algorithm: "+id);
 return algorithm.run(...args);
}
