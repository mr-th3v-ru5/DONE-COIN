// Airdrop / quest JS for DONE COIN ($DONE)
// Uses real airdrop contract on Base (EVM only).

(function () {
  // ========= CONFIG: AIRDROP CONTRACT (BASE) =========
  const AIRDROP_ADDRESS = "0x19b240F3ac551Ba736Bf2144A0A629294e410206";
  const AIRDROP_ABI = [
    "function claim() external"
  ];

  let airdropContract = null;

  // ========= QUEST STEP LOGIC =========
  const steps = document.querySelectorAll(".step");
  const checks = [
    document.getElementById("q1"),
    document.getElementById("q2"),
    document.getElementById("q3"),
    document.getElementById("q4"),
  ];
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");

  function openMissionUrl(url) {
    if (!url) return;
    try {
      window.open(url, "_blank");
    } catch (e) {
      console.warn("Unable to open mission url", e);
    }
  }

  function updateProgress() {
    const done = checks.filter((c) => c.checked).length;
    const pct = (done / 4) * 100;
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressLabel) {
      progressLabel.textContent = `${done} / 4 steps marked as done.`;
    }
    updateClaimState();
  }

  steps.forEach((step, idx) => {
    step.addEventListener("click", () => {
      const url = step.dataset.url;
      openMissionUrl(url);

      // toggle local state
      checks[idx].checked = !checks[idx].checked;
      step.classList.toggle("active", checks[idx].checked);

      const circle = step.querySelector(".step-circle");
      if (circle) {
        circle.style.borderColor = checks[idx].checked
          ? "#4ade80"
          : "rgba(129,140,248,.7)";
        circle.style.background = checks[idx].checked
          ? "radial-gradient(circle at 30% 0,#22c55e,#065f46)"
          : "radial-gradient(circle at 30% 0,rgba(59,130,246,.3),rgba(15,23,42,1))";
      }

      updateProgress();
    });
  });

  updateProgress();

  // ========= WALLET TABS (only Base EVM, but keep tab logic future-proof) =========
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      const t = btn.dataset.tab;
      document
        .querySelectorAll(".wallet-panel")
        .forEach((p) => p.classList.remove("active"));
      const panel = document.getElementById("panel-" + t);
      if (panel) panel.classList.add("active");
    });
  });

  // ========= EVM WALLET (BASE) =========
  const providerOptions = {
    walletconnect: {
      package: window.WalletConnectProvider.default,
      options: {
        rpc: {
          8453: "https://mainnet.base.org",
        },
      },
    },
  };

  const web3Modal = new window.Web3Modal.default({
    cacheProvider: false,
    providerOptions,
    theme: "dark",
  });

  let evmProvider = null;
  let evmSigner = null;
  let evmAddress = null;

  async function ensureBaseNetwork(provider) {
    const baseChainId = "0x2105"; // 8453
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: baseChainId }],
      });
    } catch (switchErr) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: baseChainId,
              chainName: "Base",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.base.org"],
              blockExplorerUrls: ["https://basescan.org"],
            },
          ],
        });
      } catch (addErr) {
        console.warn("Cannot switch/add Base:", addErr);
      }
    }
  }

  async function connectEVM() {
    const note = document.getElementById("evm-note");
    try {
      const instance = await web3Modal.connect();
      evmProvider = new ethers.providers.Web3Provider(instance);
      await ensureBaseNetwork(evmProvider.provider);

      evmSigner = evmProvider.getSigner();
      evmAddress = await evmSigner.getAddress();

      // init airdrop contract
      airdropContract = new ethers.Contract(
        AIRDROP_ADDRESS,
        AIRDROP_ABI,
        evmSigner
      );

      const short = evmAddress.slice(0, 6) + "…" + evmAddress.slice(-4);
      const addrEl = document.getElementById("evm-addr");
      if (addrEl) {
        addrEl.textContent = short;
        addrEl.style.display = "inline-block";
      }

      if (note) {
        note.textContent = "Connected to EVM wallet on Base.";
      }
      updateClaimState();
    } catch (err) {
      console.error(err);
      if (note) {
        note.textContent = "Failed to connect. Please try again.";
      }
    }
  }

  const btnEvm = document.getElementById("btn-evm-connect");
  if (btnEvm) {
    btnEvm.addEventListener("click", connectEVM);
  }

  // ========= CLAIM LOGIC =========
  function isQuestComplete() {
    return checks.every((c) => c.checked);
  }

  function isWalletConnected() {
    return !!evmAddress;
  }

  function updateClaimState() {
    const btn = document.getElementById("btn-claim");
    if (!btn) return;
    if (isQuestComplete() && isWalletConnected()) {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    } else {
      btn.style.opacity = ".55";
      btn.style.pointerEvents = "none";
    }
  }

  const btnClaim = document.getElementById("btn-claim");
  if (btnClaim) {
    btnClaim.addEventListener("click", async () => {
      if (!(isQuestComplete() && isWalletConnected())) return;

      if (!airdropContract) {
        alert("Kontrak airdrop belum siap. Coba reconnect wallet.");
        return;
      }

      const hint = document.getElementById("claim-hint");

      try {
        if (hint) {
          hint.textContent =
            "Sending claim transaction to Base… please confirm in your wallet.";
        }
        const tx = await airdropContract.claim();
        alert("Transaction sent. Waiting for confirmation…");
        await tx.wait();
        alert("Claim successful! 🎉 1,000 DONE sent to your wallet on Base.");
        if (hint) {
          hint.textContent =
            "Claim successful. You can verify the transfer on BaseScan using your wallet address.";
        }
      } catch (e) {
        console.error(e);
        if (hint) {
          hint.textContent =
            "Claim failed. Check your wallet / explorer for more details.";
        }
        alert("Claim failed. Please check the console or your wallet for details.");
      }
    });
  }
})();
