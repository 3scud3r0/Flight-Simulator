/** Capture and verify the actual Aurora WebGL scene in local Chromium. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],
 {stdio:'ignore'});
for(let i=0;i<60;i++){
 try{if((await fetch('http://127.0.0.1:4173/')).ok)break}catch{}
 await new Promise(resolve=>setTimeout(resolve,100));
}
const browser=await chromium.launch({headless:true,
 ...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
  '--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1365,height:768},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/?world=aurora',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#world-select')?.value==='aurora' &&
  !document.querySelector('#world-select')?.disabled &&
  document.querySelector('#airport')?.options.length===1,null,{timeout:45000});
 assert.equal(await page.locator('#airport option').count(),1);
 assert.equal(await page.locator('#route option').count(),5);
 await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#welcome')?.classList.contains('hidden'));
 await page.waitForFunction(()=>!document.querySelector('#fps')?.textContent?.startsWith('--'),
  null,{timeout:45000});
 const state=await page.evaluate(()=>({fps:document.querySelector('#fps')?.textContent,
  world:document.querySelector('#world-info')?.textContent,
  canvas:document.querySelector('#scene')?.width,
  status:document.querySelector('#flight-status')?.textContent}));
 assert.ok(state.canvas>0);assert.match(state.world,/Aurora/);
 assert.ok(!errors.length,'Browser exceptions: '+errors.join('; '));
 await mkdir('proof',{recursive:true});
 await page.screenshot({path:'proof/aurora-real.png',animations:'disabled'});
 await page.locator('#world-select').selectOption('rio');
 await page.waitForFunction(()=>document.querySelector('#airport')?.options.length===3 &&
  !document.querySelector('#world-select')?.disabled,null,{timeout:45000});
 await page.locator('#world-select').selectOption('aetheria-lite');
 await page.waitForFunction(()=>document.querySelector('#airport')?.options.length===4 &&
  !document.querySelector('#world-select')?.disabled,null,{timeout:45000});
 assert.ok(!errors.length,'Browser exceptions after world switches: '+errors.join('; '));
 console.log(JSON.stringify(state));
}finally{await browser.close();server.kill()}
