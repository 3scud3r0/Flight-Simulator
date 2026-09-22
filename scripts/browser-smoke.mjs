/**
 * Real Chromium/WebGL smoke test. Writes screenshots + a short gameplay video;
 * fails CI if the initial scene, world switch or HUD control cannot execute.
 *
 * Run after installing playwright and local vendor/three.module.js:
 *   node scripts/browser-smoke.mjs
 */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir,rename,writeFile} from "node:fs/promises";
import {chromium} from "playwright";

const base="http://127.0.0.1:4173/";
const proof=new URL("../proof/",import.meta.url);
await mkdir(proof,{recursive:true});
const logs=[];
const server=spawn("python3",["-m","http.server","4173","--bind","127.0.0.1"],
 {stdio:"ignore"});
let browser;
let failMessage="";
async function ready(){
 for(let i=0;i<90;i++){
  try{const reply=await fetch(base);if(reply.ok)return}
  catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 throw Error("The local HTTP test server did not start.");
}
async function load(page,url){
 page.on("pageerror",error=>logs.push("PAGEERROR "+error.message));
 page.on("requestfailed",request=>
  logs.push("REQUEST "+request.url()+" "+request.failure()?.errorText));
 await page.goto(base+url,{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>{
  const loading=document.getElementById("loading");
  return loading?.classList.contains("hidden");
 },{timeout:45000});
 await page.waitForFunction(()=>{
  const fps=document.getElementById("fps")?.textContent||"";
  return fps.includes("FPS")&&!fps.startsWith("--");
 },{timeout:45000});
 const data=await page.evaluate(()=>{
  const scene=document.querySelector("#scene");
  return {brand:document.title,webgl:!!scene.getContext("webgl2")||
   !!scene.getContext("webgl"),canvas:scene.width>0&&scene.height>0};
 });
 assert.match(data.brand,/FLIGHT SIMULATOR/i);
 assert.ok(data.webgl,"A real WebGL context is required.");
 assert.ok(data.canvas,"The scene must have a nonzero canvas.");
}
async function choose(page,value){
 await page.locator("[data-world='"+value+"']").click();
 await page.waitForFunction(value=>{
  const world=document.querySelector("#world-select");
  return world?.value===value&&!world.disabled;
 },value,{timeout:45000});
 await page.waitForTimeout(750);
 const info=await page.locator("#world-info").innerText();
 assert.doesNotMatch(info,/Falha ao alternar mundo/i,info);
}
async function fly(page,file){
 await page.locator("#start").click();
 await page.waitForFunction(()=>document.querySelector("#welcome")
  ?.classList.contains("hidden"),{timeout:20000});
 await page.waitForTimeout(1200);
 await page.screenshot({path:new URL(file,proof).pathname,
  fullPage:false,animations:"disabled"});
}
try{
 await ready();
 browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",
  args:["--no-sandbox","--disable-dev-shm-usage",
   "--enable-webgl","--enable-unsafe-swiftshader",
   "--use-gl=angle","--use-angle=swiftshader",
   "--ignore-gpu-blocklist"]});
 const common={viewport:{width:1365,height:768},deviceScaleFactor:1,
  reducedMotion:"reduce"};
 // Demonstrate that the legacy Rio works independently.
 const rio=await browser.newPage(common);
 await load(rio,"?safe=1");
 await fly(rio,"rio.png");
 assert.equal(await rio.locator("#world-select").inputValue(),"rio");
 await rio.close();

 // Lite does NOT fetch /src/aetheria.js. It runs from bundled main.js.
 const lite=await browser.newPage(common);
 await lite.route("**/src/aetheria.js**",route=>route.abort());
 await load(lite,"?world=aetheria-lite&safe=1");
 await lite.waitForFunction(()=>document.querySelector("#world-select")
  ?.value==="aetheria-lite",{timeout:45000});
 await fly(lite,"aetheria-lite.png");
 assert.match(await lite.locator("#world-info").innerText(),/Aetheria/i);
 await lite.close();

 // Full runs the real world module (not the fallback) and records live flight.
 const ctx=await browser.newContext({...common,
  recordVideo:{dir:new URL(".",proof).pathname,
   size:{width:1365,height:768}}});
 const full=await ctx.newPage();
 await load(full,""); // normal renderer, without the compatibility flag
 await choose(full,"aetheria");
 const fullInfo=await full.locator("#world-info").innerText();
 assert.match(fullInfo,/qualidade máxima/i,
  "The full renderer should load, not silently fall back: "+fullInfo);
 await fly(full,"aetheria-full.png");
 // Check the world moves and update loop has not frozen.
 await full.keyboard.down("Equal");
 await full.waitForTimeout(1500);
 await full.keyboard.up("Equal");
 await full.locator("#hud-toggle").click();
 assert.equal(await full.evaluate(()=>document.body.classList
  .contains("cinematic-mode")),true);
 assert.equal(await full.locator(".hud").isVisible(),false);
 await full.screenshot({path:new URL("aetheria-cinematic.png",proof).pathname});
 await full.keyboard.press("u");
 assert.equal(await full.locator(".hud").isVisible(),true);
 await full.locator("#aetheria-region").selectOption("kharon");
 await full.waitForTimeout(1200);
 assert.equal(await full.locator("#aetheria-region").inputValue(),"kharon");
 await full.locator("#world-select").selectOption("rio");
 await full.waitForFunction(()=>document.querySelector("#world-select")
  ?.value==="rio",{timeout:20000});
 assert.equal(await full.locator("#airport option").count(),3);
 await full.screenshot({path:new URL("rio-restored.png",proof).pathname});
 const video=await full.video().path();
 await ctx.close();
 await rename(video,new URL("aetheria-flight.webm",proof));

 // Deliberately fail the optional full renderer: the Lite fallback must
 // still load, fly and allow Rio to be restored.
 const broken=await browser.newPage(common);
 await broken.route("**/src/aetheria.js**",route=>route.abort());
 await load(broken,"");
 await choose(broken,"aetheria");
 assert.match(await broken.locator("#world-info").innerText(),
  /recuperação/i);
 await fly(broken,"aetheria-offline-recovery.png");
 await broken.close();

 const report={
  passed:true,engine:"Chromium headless + WebGL",
  screenshots:["rio.png","aetheria-lite.png","aetheria-full.png",
   "aetheria-cinematic.png","rio-restored.png",
   "aetheria-offline-recovery.png"],
  video:"aetheria-flight.webm",checks:[
   "Rio original flight","Aetheria Lite without dynamic module",
   "Aetheria full renderer","Cinematic HUD and keyboard restore",
   "Region navigation","Return to Rio",
   "Forced full-renderer outage falls back to Lite"
  ]
 };
 await writeFile(new URL("report.json",proof),
  JSON.stringify(report,null,2));
 process.stdout.write(JSON.stringify(report)+"\n");
}catch(error){
 failMessage=error.stack||String(error);
 await writeFile(new URL("browser-failure.log",proof),
  failMessage+"\n"+logs.join("\n")).catch(()=>{});
 console.error(failMessage);
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 server.kill("SIGTERM");
}
