// Shared JS: miniapp detection, scroll reveal, miniapp start button

window.DONE = window.DONE || {};
DONE.MINIAPP_URL = "https://farcaster.xyz/miniapps/3YcfUSEaBQQM/done-quest-done";

(function detectMiniApp(){
  let mini = false;
  try{
    if(window.parent && window.parent !== window) mini = true;
    const ref = document.referrer || "";
    if(ref.includes("warpcast.com") || ref.includes("farcaster.xyz")) mini = true;
    const qs = new URLSearchParams(location.search);
    if(qs.get("miniapp") === "1") mini = true;
  }catch(e){}
  if(mini){
    document.documentElement.classList.add("miniapp");
  }
  DONE.isMiniApp = mini;
})();

// Reveal on scroll
const obs = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add("in");
      obs.unobserve(e.target);
    }
  });
},{threshold:0.1});
document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll(".reveal").forEach(el=>obs.observe(el));
});

// Mini app ready helpers
function signalMiniAppReady(){
  try{ if(window.sdk?.actions?.ready) window.sdk.actions.ready(); }catch(e){}
  try{ window.parent?.postMessage({type:"miniapp.ready"}, "*"); }catch(e){}
  try{ window.parent?.postMessage({type:"frame_ready"}, "*"); }catch(e){}
  try{ window.ReactNativeWebView?.postMessage(JSON.stringify({type:"miniapp.ready"})); }catch(e){}
}
DONE.signalMiniAppReady = signalMiniAppReady;

window.addEventListener("load", ()=>{
  // auto signal on load (safe)
  signalMiniAppReady();

  // wire "Tap to start Mini App" buttons
  document.querySelectorAll(".js-miniapp-start").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(DONE.isMiniApp){
        signalMiniAppReady();
      }else{
        window.open(DONE.MINIAPP_URL, "_blank");
      }
    });
  });
});

// optional: load Farcaster Mini App SDK
(async ()=>{
  try{
    const { sdk } = await import("https://esm.sh/@farcaster/miniapp-sdk");
    window.sdk = sdk;
    try{ await sdk.actions.ready(); }catch(e){}
  }catch(e){}
})();
