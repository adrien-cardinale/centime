(function(){
const RELEASES="https://github.com/adrien-cardinale/centime/releases/latest";
const API="https://api.github.com/repos/adrien-cardinale/centime/releases/latest";
const KINDS={exe:[/\.exe$/i,["x64",null]],msi:[/\.msi$/i,["x64",null]],"dmg-arm":[/\.dmg$/i,["arm",null]],"dmg-x64":[/\.dmg$/i,["x64",null]],deb:[/\.deb$/i,["x64",null]],rpm:[/\.rpm$/i,["x64",null]],appimage:[/\.appimage$/i,["x64",null]],apk:[/\.apk$/i,[null,"arm"]]};
const line=document.getElementById("release");
const arch=n=>/aarch64|arm64/i.test(n)?"arm":/x86_64|x64|amd64/i.test(n)?"x64":/armv7|armeabi|i686|x86/i.test(n)?"other":null;
const mb=b=>(b/1048576).toFixed(1)+" MB";
const pick=(assets,[ext,prefs])=>{for(const p of prefs){const a=assets.find(x=>ext.test(x.name)&&arch(x.name)===p);if(a)return a}};
function detectOs(){
  const n=navigator,p=((n.userAgentData&&n.userAgentData.platform)||n.platform||"")+" "+n.userAgent;
  if(/android/i.test(p))return"android";
  if(/iphone|ipad|ipod/i.test(p)||(/mac/i.test(p)&&n.maxTouchPoints>1))return"web";
  if(/windows|win32|win64/i.test(p))return"windows";
  if(/mac/i.test(p))return"macos";
  if(/linux|x11|cros/i.test(p))return"linux";
  return null;
}
function setPrimary(card,asset){
  card.querySelectorAll(".dl .btn").forEach(b=>b.classList.remove("primary"));
  const b=asset?card.querySelector(`[data-asset="${asset}"]`):card.querySelector(".dl .btn");
  if(b)b.classList.add("primary");
}
function markPlatform(){
  const os=detectOs(),card=os&&document.querySelector(`[data-os="${os}"]`);
  if(!card)return;
  card.classList.add("mine");
  card.querySelector("h3").insertAdjacentHTML("beforeend",' <span class="badge">Your platform</span>');
  setPrimary(card);
  const ua=navigator.userAgentData;
  if(os==="macos"&&ua&&ua.getHighEntropyValues)ua.getHighEntropyValues(["architecture"]).then(v=>{if(v.architecture==="x86")setPrimary(card,"dmg-x64")}).catch(()=>{});
}
function fill(rel){
  const page=rel.html_url||RELEASES;
  const assets=(rel.assets||[]).filter(a=>a.name!=="latest.json"&&!/\.app\.tar\.gz$/i.test(a.name));
  document.querySelectorAll("[data-asset]").forEach(b=>{
    const a=pick(assets,KINDS[b.dataset.asset]);
    b.href=a?a.browser_download_url:page;
    b.querySelector(".size").textContent=a?mb(a.size):"";
  });
  const link=document.createElement("a");
  link.href=page;link.textContent=rel.tag_name;
  const date=rel.published_at?" · "+new Date(rel.published_at).toLocaleDateString("en",{year:"numeric",month:"long",day:"numeric"}):"";
  line.replaceChildren("Latest release: ",link,date);
}
function fail(){
  const link=document.createElement("a");
  link.href=RELEASES;link.textContent="See all releases on GitHub";
  line.replaceChildren(link);
}
async function load(){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
  try{
    const r=await fetch(API,{headers:{Accept:"application/vnd.github+json"},signal:ctl.signal});
    if(!r.ok)throw new Error(r.status);
    const rel=await r.json();
    if(!rel.tag_name)throw new Error("no release");
    fill(rel);
  }catch(e){fail()}finally{clearTimeout(timer)}
}
markPlatform();
load();
})();
