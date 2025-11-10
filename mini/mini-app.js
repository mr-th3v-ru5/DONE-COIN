// DONE Quest Mini App JS
// - Auto connect wallet via Farcaster Mini App SDK (sdk.wallet.getEthereumProvider)
//   atau fallback ke window.ethereum
// - Pakai sdk.context.user (via window.DONE_MINIAPP_CONTEXT) untuk ambil FID & username
// - Cek Neynar score via backend (>= 0.35)
// - Claim DONE airdrop di Base kalau:
//     * Wallet connected
//     * Quest steps selesai (user tap semua)
//     * FID ada & score >= 0.35

(function () {
  const AIRDROP_ADDRESS = "0x1df8DcCAD57939BaB8Ae0f3406Eaa868887E03bb";
  const AIRDROP_ABI = ["function claim() external"];
  const MIN_SCORE = 0.35;

  const state = {
    fid: null,
    username: null,
    displayName: null,
    score: null,
    scoreEligible: false,
    walletAddress: null,
    provider: null, // ethers provider
    signer: null,
    questCompleted: false,
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", () => {
    els.scorePill = document.getElementById("score-pill");
    els.scoreVal = document.getElementById("score-val");
    els.fcUser = document.getElementById("fc-user");
    els.walletAddr = document.getElementById("wallet-addr");
    els.fcHint = document.getElementById("fc-hint");
    els.progressFill = document.getElementById("progressFill");
    els.progressLabel = document.getElementById("progressLabel");
    els.progressHint = document.getElementById("progressHint");
    els.claimBtn = document.getElementById("btn-claim");
    els.claimStatus = document.getElementById("claim-status");

    setupQuestToggles();
    bootstrap().catch((e) => {
      console.error(e);
      setClaimStatus("Gagal inisialisasi mini app. Coba tutup dan buka lagi.");
    });
  });

  // ---------- QUEST ----------
  function setupQuestToggles() {
    const stepEls = document.querySelectorAll(".step");
    if (!stepEls.length) return;

    stepEls.forEach((step) => {
      step.addEventListener("click", () => {
        step.classList.toggle("done");
        updateQuestProgress();
        updateClaimButton();
      });
    });

    updateQuestProgress();
  }

  function updateQuestProgress() {
    const stepEls = document.querySelectorAll(".step");
    const total = stepEls.length;
    let done = 0;
    stepEls.forEach((s) => {
      if (s.classList.contains("done")) done++;
    });

    const pct = total ? (done / total) * 100 : 0;
    if (els.progressFill) {
      els.progressFill.style.width = pct + "%";
    }
    if (els.progressLabel) {
      els.progressLabel.textContent = `${done} / ${total} steps complete`;
    }
    state.questCompleted = done === total;
  }

  // ---------- HELPERS ----------
  function setClaimStatus(msg) {
    if (els.claimStatus) els.claimStatus.textContent = msg;
  }

  function shortAddr(addr) {
    if (!addr) return "—";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function parseFidFromQuery() {
    const qs = new URLSearchParams(window.location.search || "");
    const cand =
      qs.get("fid") ||
      qs.get("viewerFid") ||
      qs.get("viewer_fid") ||
      qs.get("f");
    if (!cand) return null;
    const n = parseInt(cand, 10);
    return Number.isFinite(n) ? n : null;
  }

  // ---------- FARCASTER CONTEXT (SDK) ----------
  function hydrateFarcasterFromSDKContext() {
    try {
      const sdk = window.DONE_MINIAPP_SDK;
      const ctx =
        window.DONE_MINIAPP_CONTEXT ||
        (sdk && sdk.context ? sdk.context : null);
      if (!ctx || !ctx.user) return;

      const user = ctx.user;
      state.fid = user.fid;
      state.username = user.username || null;
      state.displayName = user.displayName || null;
    } catch (e) {
      console.warn("hydrateFarcasterFromSDKContext error:", e);
    }
  }

  // ---------- FARCASTER BACKEND / NEYNAR ----------
  async function hydrateFarcasterFromBackend() {
    // Optional: backend endpoint yang return { fid, username, displayName, score? }
    try {
      const resp = await fetch("/api/farcaster/session");
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data || !data.fid) return;

      state.fid = data.fid;
      state.username = data.username || state.username;
      state.displayName = data.displayName || state.displayName;
      if (typeof data.score === "number") {
        state.score = data.score;
        state.scoreEligible = data.score >= MIN_SCORE;
      }
    } catch (e) {
      console.warn("hydrateFarcasterFromBackend error:", e);
    }
  }

  async function fetchNeynarScoreIfNeeded() {
    if (!state.fid) return;
    if (state.score != null) return;

    try {
      const resp = await fetch(`/api/neynar-score?fid=${state.fid}`);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      let score = null;
      if (typeof data.score === "number") {
        score = data.score;
      } else if (
        data.experimental &&
        typeof data.experimental.neynar_user_score === "number"
      ) {
        score = data.experimental.neynar_user_score;
      }
      state.score = score;
      state.scoreEligible = score != null && score >= MIN_SCORE;
    } catch (e) {
      console.warn("fetchNeynarScoreIfNeeded error:", e);
    }
  }

  // ---------- WALLET (SDK + fallback) ----------
  async function connectWallet() {
    if (state.walletAddress) return;

    let ethProvider = null;

    // 1) coba provider dari mini app SDK (wallet Farcaster)
    try {
      const sdk = window.DONE_MINIAPP_SDK;
      if (sdk && sdk.wallet && sdk.wallet.getEthereumProvider) {
        ethProvider = await sdk.wallet.getEthereumProvider();
      }
    } catch (e) {
      console.warn("sdk.wallet.getEthereumProvider error:", e);
    }

    // 2) fallback ke window.ethereum (kalau akses via browser biasa)
    if (!ethProvider && typeof window.ethereum !== "undefined") {
      ethProvider = window.ethereum;
    }

    if (!ethProvider) {
      if (els.walletAddr) els.walletAddr.textContent = "no provider";
      throw new Error(
        "No ethereum provider (Farcaster wallet / window.ethereum) found"
      );
    }

    const provider = new ethers.providers.Web3Provider(ethProvider);
    const accounts = await provider.send("eth_requestAccounts", []);
    const addr = accounts && accounts[0];

    state.provider = provider;
    state.signer = provider.getSigner();
    state.walletAddress = addr || null;

    if (els.walletAddr) {
      els.walletAddr.textContent = addr ? shortAddr(addr) : "unknown address";
    }
  }

  // ---------- UI UPDATE ----------
  function updateScoreUI() {
    if (els.scoreVal) {
      els.scoreVal.textContent =
        state.score != null ? state.score.toFixed(2) : "—";
    }
    if (!els.scorePill) return;
    els.scorePill.classList.remove("ok", "bad");

    if (state.score == null) {
      // belum tahu
    } else if (state.scoreEligible) {
      els.scorePill.classList.add("ok");
    } else {
      els.scorePill.classList.add("bad");
    }
  }

  function updateFarcasterUI() {
    if (els.fcUser) {
      if (!state.fid) {
        els.fcUser.textContent = "FID unknown";
      } else {
        const handle =
          state.username ? "@" + state.username : "fid:" + state.fid;
        els.fcUser.textContent = handle;
      }
    }

    if (els.fcHint) {
      if (!state.fid) {
        els.fcHint.textContent =
          "Tidak bisa mendeteksi FID Farcaster dari mini app. Pastikan mini app dikonfigurasi dengan context atau FID di URL.";
      } else if (state.score == null) {
        els.fcHint.textContent =
          "FID terdeteksi. Mengambil Neynar score untuk anti-bot…";
      } else if (!state.scoreEligible) {
        els.fcHint.textContent =
          "Score Neynar kamu di bawah 0.35. Kamu tetap bisa mencoba lagi nanti setelah score naik.";
      } else {
        els.fcHint.textContent =
          "Score Neynar kamu memenuhi syarat. Selesaikan quest lalu klaim airdrop.";
      }
    }
  }

  function updateClaimButton() {
    if (!els.claimBtn) return;

    const can =
      state.walletAddress && state.scoreEligible && state.questCompleted && state.fid;

    els.claimBtn.disabled = !can;

    if (!can) {
      if (!state.walletAddress) {
        setClaimStatus("Menunggu wallet Farcaster terhubung…");
      } else if (!state.fid) {
        setClaimStatus("FID Farcaster belum terdeteksi, tidak bisa klaim.");
      } else if (!state.scoreEligible) {
        setClaimStatus(
          "Score Neynar kamu belum mencapai 0.35. Klaim airdrop dikunci."
        );
      } else if (!state.questCompleted) {
        setClaimStatus("Centang semua langkah quest sebelum klaim.");
      }
    } else {
      setClaimStatus(
        "Semua syarat terpenuhi. Kamu bisa klaim 1,000 DONE ke wallet ini."
      );
    }
  }

  // ---------- NETWORK & CLAIM ----------
  async function ensureBaseNetwork(rawProvider) {
    const provider = rawProvider || (state.provider && state.provider.provider);
    if (!provider || !provider.request) return;

    const baseChainId = "0x2105";

    try {
      const current = await provider.request({ method: "eth_chainId" });
      if (current === baseChainId) return;
    } catch (e) {}

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
              nativeCurrency: {
                name: "Ether",
                symbol: "ETH",
                decimals: 18,
              },
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

  async function runClaim() {
    if (!state.signer || !state.provider) {
      throw new Error("Wallet belum terhubung");
    }
    if (typeof ethers === "undefined") {
      throw new Error("ethers.js belum dimuat");
    }

    await ensureBaseNetwork(state.provider.provider);

    const contract = new ethers.Contract(
      AIRDROP_ADDRESS,
      AIRDROP_ABI,
      state.signer
    );

    if (els.claimBtn) {
      els.claimBtn.disabled = true;
      els.claimBtn.textContent = "⛓️ Sending claim tx…";
    }
    setClaimStatus("Mengirim transaksi claim ke kontrak DONE airdrop…");

    const tx = await contract.claim();
    setClaimStatus("Tx terkirim: " + tx.hash + ". Menunggu konfirmasi…");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      if (els.claimBtn) {
        els.claimBtn.textContent = "✅ Claimed";
        els.claimBtn.disabled = true;
      }
      setClaimStatus("Berhasil klaim! 1,000 DONE dikirim ke wallet kamu.");
    } else {
      throw new Error("Transaction reverted");
    }
  }

  // ---------- BOOTSTRAP ----------
  async function bootstrap() {
    if (els.claimBtn) {
      els.claimBtn.addEventListener("click", async () => {
        try {
          await runClaim();
        } catch (e) {
          console.error(e);
          if (els.claimBtn) {
            els.claimBtn.disabled = false;
            els.claimBtn.textContent = "🎁 Claim 1,000 DONE";
          }
          setClaimStatus(
            "Claim gagal: " +
              (e && e.message ? e.message : "alasan tidak diketahui.")
          );
        }
      });
    }

    // 1) connect wallet (Farcaster)
    try {
      await connectWallet();
    } catch (e) {
      console.warn("connectWallet error:", e);
    }

    // 2) ambil FID dari SDK context dulu
    hydrateFarcasterFromSDKContext();

    // 3) fallback: query param
    if (!state.fid) {
      state.fid = parseFidFromQuery();
    }

    // 4) fallback lagi: session backend
    if (!state.fid) {
      await hydrateFarcasterFromBackend();
    }

    // 5) ambil Neynar score kalau perlu
    await fetchNeynarScoreIfNeeded();

    // 6) update UI
    if (state.walletAddress && els.walletAddr) {
      els.walletAddr.textContent = shortAddr(state.walletAddress);
    }
    updateScoreUI();
    updateFarcasterUI();
    updateClaimButton();
  }
})();
