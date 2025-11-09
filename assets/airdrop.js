// Airdrop / quest specific JS (requires ethers, web3modal, walletconnect libs loaded in HTML)

(function(){
  const steps = document.querySelectorAll(".step");
  const checks = [
    document.getElementById("q1"),
    document.getElementById("q2"),
    document.getElementById("q3"),
    document.getElementById("q4")
  ];
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");

  function openMissionUrl(url){
    if(!url) return;
    try{
      window.open(url, "_blank");
    }catch(e){
      console.warn("Unable to open mission url", e);
    }
  }

  function updateProgress(){
    const done = checks.filter(c=>c.checked).length;
    const pct = (done/4)*100;
    progressFill.style.width = pct + "%";
    progressLabel.textContent = `${done} / 4 steps marked as done.`;
    updateClaimState();
  }

  steps.forEach((step, idx)=>{
    step.addEventListener("click", ()=>{
      const url = step.dataset.url;
      openMissionUrl(url);
      checks[idx].checked = !checks[idx].checked;
      step.classList.toggle("active", checks[idx].checked);
      const circle = step.querySelector(".step-circle");
      circle.style.borderColor = checks[idx].checked ? "#4ade80" : "rgba(129,140,248,.7)";
      circle.style.background = checks[idx].checked
        ? "radial-gradient(circle at 30% 0,#22c55e,#065f46)"
        : "radial-gradient(circle at 30% 0,rgba(59,130,246,.3),rgba(15,23,42,1))";
      updateProgress();
    });
  });
  updateProgress();

  // Tabs
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const t = btn.dataset.tab;
      document.querySelectorAll(".wallet-panel").forEach(p=>p.classList.remove("active"));
      document.getElementById("panel-"+t).classList.add("active");
    });
  });

  // Web3Modal for EVM (Base)
  const providerOptions = {
    walletconnect: {
      package: window.WalletConnectProvider.default,
      options: { rpc: { 8453: "https://mainnet.base.org" } }
    }
  };
  const web3Modal = new window.Web3Modal.default({
    cacheProvider:false,
    providerOptions,
    theme:"dark"
  });

  let evmProvider = null;
  let evmSigner = null;
  let evmAddress = null;
  let solAddress = null;

  async function ensureBaseNetwork(provider){
    const baseChainId = "0x2105"; // 8453
    try{
      await provider.request({ method:"wallet_switchEthereumChain", params:[{ chainId: baseChainId }] });
    }catch(switchErr){
      try{
        await provider.request({
          method:"wallet_addEthereumChain",
          params:[{
            chainId: baseChainId,
            chainName:"Base",
            nativeCurrency:{ name:"Ether",symbol:"ETH",decimals:18 },
            rpcUrls:["https://mainnet.base.org"],
            blockExplorerUrls:["https://basescan.org"]
          }]
        });
      }catch(addErr){
        console.warn("Cannot switch/add Base:",addErr);
      }
    }
  }

  async function connectEVM(){
    const note = document.getElementById("evm-note");
    try{
      const instance = await web3Modal.connect();
      evmProvider = new ethers.providers.Web3Provider(instance);
      await ensureBaseNetwork(evmProvider.provider);
      evmSigner = evmProvider.getSigner();
      evmAddress = await evmSigner.getAddress();
      const short = evmAddress.slice(0,6)+"…"+evmAddress.slice(-4);
      const addrEl = document.getElementById("evm-addr");
      addrEl.textContent = short;
      addrEl.style.display = "inline-block";
      note.textContent = "Connected to EVM wallet (Base).";
      updateClaimState();
    }catch(err){
      console.error(err);
      note.textContent = "Failed to connect. Please try again.";
    }
  }
  document.getElementById("btn-evm-connect").addEventListener("click", connectEVM);

  // Solana Phantom
  async function connectSol(){
    try{
      if(!window.solana || !window.solana.isPhantom){
        alert("Phantom not detected. Please install Phantom and reload.");
        return;
      }
      const resp = await window.solana.connect({ onlyIfTrusted:false });
      solAddress = resp.publicKey.toString();
      const short = solAddress.slice(0,6)+"…"+solAddress.slice(-4);
      const addrEl = document.getElementById("sol-addr");
      addrEl.textContent = short;
      addrEl.style.display = "inline-block";
      updateClaimState();
    }catch(err){
      console.error(err);
      alert("Failed to connect Phantom.");
    }
  }
  document.getElementById("btn-sol-connect").addEventListener("click", connectSol);

  function isQuestComplete(){ return checks.every(c=>c.checked); }
  function isWalletConnected(){ return !!(evmAddress || solAddress); }

  function updateClaimState(){
    const btn = document.getElementById("btn-claim");
    if(isQuestComplete() && isWalletConnected()){
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }else{
      btn.style.opacity = ".55";
      btn.style.pointerEvents = "none";
    }
  }

  document.getElementById("btn-claim").addEventListener("click", ()=>{
    if(!(isQuestComplete() && isWalletConnected())) return;
    const addr = evmAddress ? `EVM: ${evmAddress}` : `Solana: ${solAddress}`;
    alert(`Demo claim for ${addr}.\n\nHook this button to your airdrop contract on Base + Farcaster verifier API for a real claim.`);
  });
})();
