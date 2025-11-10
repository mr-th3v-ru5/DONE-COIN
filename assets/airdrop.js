// Airdrop / quest JS for DONE COIN ($DONE) on Base
// Requires ethers, web3modal, walletconnect libs loaded in HTML

(function(){
  // --------- QUEST STEPS ----------
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
    const done = checks.filter(c => c && c.checked).length;
    const total = checks.length;
    const pct = (done / total) * 100;

    if(progressFill) progressFill.style.width = pct + "%";
    if(progressLabel) progressLabel.textContent = `${done} / ${total} steps marked as done.`;

    updateClaimState();
  }

  steps.forEach((step, idx) => {
    const checkbox = checks[idx];
    if(!checkbox) return;

    step.addEventListener("click", () => {
      const url = step.dataset.url;
      openMissionUrl(url);

      // toggle state
      checkbox.checked = !checkbox.checked;
      step.classList.toggle("active", checkbox.checked);

      const circle = step.querySelector(".step-circle");
      if(circle){
        circle.style.borderColor = checkbox.checked ? "#4ade80" : "rgba(129,140,248,.7)";
        circle.style.background = checkbox.checked
          ? "radial-gradient(circle at 30% 0,#22c55e,#065f46)"
          : "radial-gradient(circle at 30% 0,rgba(59,130,246,.3),rgba(15,23,42,1))";
      }

      updateProgress();
    });
  });

  updateProgress();

  // --------- TABS (EVM / lainnya) ----------
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const t = btn.dataset.tab;
      document.querySelectorAll(".wallet-panel").forEach(p => p.classList.remove("active"));
      const panel = document.getElementById("panel-" + t);
      if(panel) panel.classList.add("active");
    });
  });

  // --------- WEB3 / BASE SETUP ----------
  const providerOptions = {
    walletconnect: {
      package: window.WalletConnectProvider && window.WalletConnectProvider.default,
      options: {
        rpc: {
          8453: "https://mainnet.base.org", // Base mainnet
        }
      }
    }
  };

  const web3Modal = new window.Web3Modal.default({
    cacheProvider: false,
    providerOptions,
    theme: "dark"
  });

  let evmProvider = null;
  let evmSigner = null;
  let evmAddress = null;
  let airdropContract = null;

  const AIRDROP_ADDRESS = "0x1df8DcCAD57939BaB8Ae0f3406Eaa868887E03bb";
  const AIRDROP_ABI = [
    "function claim() external"
  ];

  // --- helper: cek apakah sedang jalan sebagai Farcaster/Base Mini App ---
  function isMiniApp(){
    try{
      return !!(window.DONE && window.DONE.isMiniApp);
    }catch(e){
      return false;
    }
  }

  async function ensureBaseNetwork(provider){
    const baseChainId = "0x2105"; // 8453
    if(!provider || !provider.request) return;
    try{
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: baseChainId }]
      });
    }catch(switchErr){
      try{
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: baseChainId,
            chainName: "Base",
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18
            },
            rpcUrls: ["https://mainnet.base.org"],
            blockExplorerUrls: ["https://basescan.org"]
          }]
        });
      }catch(addErr){
        console.warn("Cannot switch/add Base network:", addErr);
      }
    }
  }

  // --------- CONNECT WALLET (EVM) ----------
  async function connectEVM(){
    const note = document.getElementById("evm-note");

    try{
      // Mode 1: di Farcaster/Base mini app → pakai injected wallet kalau ada
      if(isMiniApp() && window.ethereum){
        evmProvider = new ethers.providers.Web3Provider(window.ethereum);
      }else{
        // Mode 2: di web biasa (atau mini app tanpa injected) → Web3Modal
        const instance = await web3Modal.connect();
        evmProvider = new ethers.providers.Web3Provider(instance);
      }

      // Pastikan di jaringan Base
      await ensureBaseNetwork(evmProvider.provider || evmProvider);

      evmSigner = evmProvider.getSigner();
      evmAddress = await evmSigner.getAddress();

      // Init kontrak airdrop
      airdropContract = new ethers.Contract(AIRDROP_ADDRESS, AIRDROP_ABI, evmSigner);

      const short = evmAddress.slice(0, 6) + "…" + evmAddress.slice(-4);
      const addrEl = document.getElementById("evm-addr");
      if(addrEl){
        addrEl.textContent = short;
        addrEl.style.display = "inline-block";
      }

      if(note){
        note.textContent = isMiniApp()
          ? "Connected to Farcaster/Base wallet on Base."
          : "Connected to EVM wallet on Base.";
      }

      updateClaimState();
    }catch(err){
      console.error(err);
      if(note){
        note.textContent = "Failed to connect. Please try again (make sure your wallet supports Base).";
      }
    }
  }

  const evmBtn = document.getElementById("btn-evm-connect");
  if(evmBtn) evmBtn.addEventListener("click", connectEVM);

  // --------- CLAIM LOGIC ----------
  function isQuestComplete(){
    return checks.every(c => c && c.checked);
  }

  function isWalletConnected(){
    return !!evmAddress;
  }

  function updateClaimState(){
    const btn = document.getElementById("btn-claim");
    if(!btn) return;

    if(isQuestComplete() && isWalletConnected()){
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }else{
      btn.style.opacity = ".55";
      btn.style.pointerEvents = "none";
    }
  }

  const claimBtn = document.getElementById("btn-claim");
  const claimHint = document.getElementById("claim-hint");

  if(claimBtn){
    claimBtn.addEventListener("click", async () => {
      if(!(isQuestComplete() && isWalletConnected())) return;
      if(!airdropContract){
        if(claimHint){
          claimHint.textContent = "Wallet not fully connected. Please connect again.";
        }
        return;
      }

      try{
        claimBtn.disabled = true;
        claimBtn.textContent = "⏳ Sending claim…";
        if(claimHint){
          claimHint.textContent = "Sending claim transaction to DONE airdrop contract on Base…";
        }

        const tx = await airdropContract.claim();
        if(claimHint){
          claimHint.textContent = "Transaction sent. Waiting for confirmation…";
        }

        await tx.wait();

        claimBtn.textContent = "✅ Claimed 1,000 DONE";
        if(claimHint){
          claimHint.textContent = "Claim successful. 1,000 DONE will appear in your Base wallet shortly.";
        }
      }catch(err){
        console.error(err);
        claimBtn.disabled = false;
        claimBtn.textContent = "🎁 Claim 1,000 DONE";
        if(claimHint){
          let message = "Claim failed. Possible reasons: already claimed, airdrop cap reached, or transaction reverted.";
          if(err && err.message) message += " Details: " + err.message;
          claimHint.textContent = message;
        }
      }
    });
  }

  // --------- INITIAL HINT TEXT ----------
  window.addEventListener("load", () => {
    const note = document.getElementById("evm-note");
    if(!note) return;

    if(isMiniApp()){
      note.textContent = "Open DONE Quest inside Farcaster/Base app and connect your in-app wallet.";
    }else{
      note.textContent = "Connect any EVM wallet that supports Base (MetaMask, OKX, Rabby, etc.) to claim DONE.";
    }
  });
})();
