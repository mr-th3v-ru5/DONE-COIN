// Airdrop / quest JS untuk DONE COIN ($DONE) – VERSI WEB
// Halaman: airdrop.html
//
// Fitur:
// - 4 quest steps (klik button, buka link Farcaster, tandai selesai)
// - Connect EVM wallet (MetaMask / WalletConnect) di Base
// - Verifikasi Farcaster dengan Neynar score >= 0.35
// - Hanya bisa claim kalau:
//     * 4 steps selesai
//     * Wallet EVM terkoneksi (Base)
//     * Farcaster eligible (score >= 0.35)
//     * FID terisi

(function () {
  const MIN_SCORE = 0.35;

  // --- Quest elements ---
  const steps = document.querySelectorAll(".step");
  const checks = [
    document.getElementById("q1"),
    document.getElementById("q2"),
    document.getElementById("q3"),
    document.getElementById("q4"),
  ];
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");

  // --- Wallet / claim elements ---
  const connectBtn = document.getElementById("btn-evm-connect");
  const evmAddrEl = document.getElementById("evm-addr");
  const evmNote = document.getElementById("evm-note");
  const claimBtn = document.getElementById("btn-claim");
  const claimHint = document.getElementById("claim-hint");

  // --- Farcaster gating elements ---
  const fcStatus = document.getElementById("fc-status");
  const fcVerifyBtn = document.getElementById("btn-fc-verify");

  // --- State ---
  let stepsDone = 0;

  let evmProvider = null;
  let evmSigner = null;
  let evmAddress = null;
  let airdropContract = null;
  let walletConnected = false;

  const AIRDROP_ADDRESS = "0x1df8DcCAD57939BaB8Ae0f3406Eaa868887E03bb";
  const AIRDROP_ABI = ["function claim() external"];

  const farcaster = {
    fid: null,
    score: null,
    eligible: false,
    checked: false,
  };

  // ---------------- QUEST ----------------
  function openMissionUrl(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener");
  }

  function updateQuestProgress() {
    stepsDone = checks.reduce(
      (n, el) => (el && el.checked ? n + 1 : n),
      0
    );
    const total = checks.length || 4;
    const pct = total ? (stepsDone / total) * 100 : 0;

    if (progressFill) {
      progressFill.style.width = pct + "%";
    }
    if (progressLabel) {
      progressLabel.textContent = `${stepsDone} / ${total} steps done`;
    }

    updateClaimState();
  }

  function setupQuestSteps() {
    if (!steps || !steps.length) return;

    steps.forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        const stepIndex = parseInt(btn.getAttribute("data-step") || "0", 10);

        if (url) openMissionUrl(url);

        // tandai checkbox terkait
        if (stepIndex >= 1 && stepIndex <= checks.length) {
          const idx = stepIndex - 1;
          if (checks[idx]) {
            checks[idx].checked = true;
          }
        }

        btn.classList.add("done");
        updateQuestProgress();
      });
    });

    updateQuestProgress();
  }

  // ---------------- WALLET (WEB3MODAL) ----------------
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

  async function ensureBaseNetwork(raw) {
    const provider = raw || (evmProvider && evmProvider.provider);
    if (!provider || !provider.request) return;

    const baseChainId = "0x2105"; // 8453

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

  async function connectEVM() {
    if (!window.Web3Modal) {
      alert("Web3Modal tidak dimuat. Coba refresh halaman.");
      return;
    }

    try {
      if (evmNote) {
        evmNote.textContent = "Connecting wallet…";
      }

      const instance = await web3Modal.connect();
      evmProvider = new ethers.providers.Web3Provider(instance);
      await ensureBaseNetwork(evmProvider.provider);
      evmSigner = evmProvider.getSigner();
      evmAddress = await evmSigner.getAddress();

      airdropContract = new ethers.Contract(
        AIRDROP_ADDRESS,
        AIRDROP_ABI,
        evmSigner
      );

      const short = evmAddress.slice(0, 6) + "…" + evmAddress.slice(-4);
      if (evmAddrEl) {
        evmAddrEl.textContent = short;
        evmAddrEl.style.display = "inline-block";
      }
      if (evmNote) {
        evmNote.textContent = "Connected to EVM wallet on Base.";
      }

      walletConnected = true;
      updateClaimState();
    } catch (err) {
      console.error(err);
      if (evmNote) {
        evmNote.textContent = "Failed to connect. Please try again.";
      }
    }
  }

  // ---------------- FARCASTER + NEYNAR ----------------
  function setFcStatus(text) {
    if (fcStatus) fcStatus.textContent = text;
  }

  async function fetchSession() {
    try {
      const resp = await fetch("/api/farcaster/session");
      if (!resp.ok) return null;
      const data = await resp.json();
      return data || null;
    } catch (e) {
      console.warn("farcaster/session error:", e);
      return null;
    }
  }

  async function fetchScore(fid) {
    try {
      const resp = await fetch(`/api/neynar-score?fid=${fid}`);
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

      return score;
    } catch (e) {
      console.warn("neynar-score error:", e);
      return null;
    }
  }

  async function verifyFarcaster() {
    setFcStatus("Mencoba membaca sesi Farcaster…");
    farcaster.checked = true;

    // 1) coba session backend
    const session = await fetchSession();
    if (session && session.fid) {
      farcaster.fid = session.fid;
      if (typeof session.score === "number") {
        farcaster.score = session.score;
        farcaster.eligible = session.score >= MIN_SCORE;
        updateClaimState();
        if (farcaster.eligible) {
          setFcStatus(
            `Farcaster ok (fid:${farcaster.fid}, score ${session.score.toFixed(
              2
            )} ≥ ${MIN_SCORE}).`
          );
        } else {
          setFcStatus(
            `Score Neynar kamu ${session.score.toFixed(
              2
            )} masih di bawah ${MIN_SCORE}. Klaim akan dikunci.`
          );
        }
        return;
      }
    }

    // 2) kalau belum ada score, minta FID manual
    let fid = farcaster.fid;
    if (!fid) {
      const input = window.prompt(
        "Masukkan FID Farcaster kamu (angka, contoh: 12345):",
        ""
      );
      if (!input) {
        setFcStatus("Verifikasi dibatalkan. FID tidak diisi.");
        farcaster.eligible = false;
        updateClaimState();
        return;
      }
      const n = parseInt(input, 10);
      if (!Number.isFinite(n)) {
        setFcStatus("FID tidak valid. Harus berupa angka.");
        farcaster.eligible = false;
        updateClaimState();
        return;
      }
      fid = n;
    }

    farcaster.fid = fid;
    setFcStatus("Mengambil Neynar score untuk FID " + fid + "…");
    const score = await fetchScore(fid);

    if (score == null) {
      setFcStatus(
        "Tidak bisa mengambil Neynar score. Pastikan backend / API key Neynar sudah dikonfigurasi."
      );
      farcaster.eligible = false;
      updateClaimState();
      return;
    }

    farcaster.score = score;
    farcaster.eligible = score >= MIN_SCORE;

    if (farcaster.eligible) {
      setFcStatus(
        `Farcaster ok (fid:${fid}, score ${score.toFixed(
          2
        )} ≥ ${MIN_SCORE}).`
      );
    } else {
      setFcStatus(
        `Score Neynar kamu ${score.toFixed(
          2
        )} masih di bawah ${MIN_SCORE}. Klaim tidak akan dibuka.`
      );
    }

    updateClaimState();
  }

  // ---------------- CLAIM LOGIC ----------------
  function updateClaimState() {
    if (!claimBtn) return;

    const canClaim =
      walletConnected && stepsDone === 4 && farcaster.eligible;

    claimBtn.disabled = !canClaim;
    if (canClaim) {
      claimBtn.style.opacity = "1";
      claimBtn.style.pointerEvents = "auto";
      if (claimHint) {
        claimHint.textContent =
          "Semua syarat terpenuhi. Klik tombol untuk claim 1,000 DONE.";
      }
    } else {
      claimBtn.style.opacity = ".55";
      claimBtn.style.pointerEvents = "none";

      if (claimHint) {
        if (!walletConnected) {
          claimHint.textContent = "Hubungkan wallet EVM di Base terlebih dahulu.";
        } else if (stepsDone < 4) {
          claimHint.textContent =
            "Selesaikan dan tandai semua 4 langkah quest sebelum claim.";
        } else if (!farcaster.eligible) {
          claimHint.textContent =
            "Verifikasi Farcaster dengan Neynar score ≥ 0.35 untuk membuka klaim.";
        }
      }
    }
  }

  async function runClaim() {
    if (!airdropContract || !evmSigner || !walletConnected) {
      alert("Wallet belum terhubung atau kontrak belum siap.");
      return;
    }

    try {
      claimBtn.disabled = true;
      claimBtn.textContent = "⛓️ Sending claim tx…";
      if (claimHint) {
        claimHint.textContent =
          "Mengirim transaksi ke kontrak airdrop DONE di Base…";
      }

      await ensureBaseNetwork(evmProvider.provider);
      const tx = await airdropContract.claim();

      if (claimHint) {
        claimHint.textContent =
          "Tx terkirim: " + tx.hash + " – menunggu konfirmasi…";
      }

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        claimBtn.textContent = "✅ Claimed 1,000 DONE";
        if (claimHint) {
          claimHint.textContent =
            "Berhasil claim! 1,000 DONE akan tampil di wallet kamu di Base setelah beberapa saat.";
        }
      } else {
        throw new Error("Transaction reverted");
      }
    } catch (err) {
      console.error(err);
      claimBtn.disabled = false;
      claimBtn.textContent = "🎁 Claim 1,000 DONE";
      if (claimHint) {
        let message =
          "Claim gagal. Mungkin sudah pernah claim, airdrop habis, atau transaksi dibatalkan.";
        if (err && err.message) {
          message += " Details: " + err.message;
        }
        claimHint.textContent = message;
      }
    }
  }

  // ---------------- INIT ----------------
  document.addEventListener("DOMContentLoaded", () => {
    setupQuestSteps();

    if (connectBtn) {
      connectBtn.addEventListener("click", connectEVM);
    }

    if (fcVerifyBtn) {
      fcVerifyBtn.addEventListener("click", () => {
        verifyFarcaster();
      });
    }

    if (claimBtn) {
      claimBtn.addEventListener("click", () => {
        if (!walletConnected) {
          alert("Connect wallet dulu.");
          return;
        }
        if (stepsDone < 4) {
          alert("Lengkapi semua langkah quest dulu.");
          return;
        }
        if (!farcaster.eligible) {
          alert(
            "Farcaster kamu belum memenuhi syarat (Neynar score >= " +
              MIN_SCORE +
              ")."
          );
          return;
        }
        runClaim();
      });
    }

    // Default message
    if (fcStatus) {
      fcStatus.textContent =
        "Untuk claim, kamu perlu akun Farcaster dengan Neynar score ≥ 0.35. Klik tombol verifikasi di bawah.";
    }

    updateClaimState();
  });
})();
