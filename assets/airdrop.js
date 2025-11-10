// Airdrop / quest JS untuk DONE COIN ($DONE) di Base
// - Progress quest
// - Gating wallet + Farcaster (Neynar score >= 0.35)
// - Claim airdrop on-chain ke kontrak BASE

(function () {
  const DONE = (window.DONE = window.DONE || {});

  const AIRDROP_ADDRESS = "0x1df8DcCAD57939BaB8Ae0f3406Eaa868887E03bb";
  const AIRDROP_ABI = ["function claim() external"];

  document.addEventListener("DOMContentLoaded", () => {
    // QUEST PROGRESS
    const steps = document.querySelectorAll(".step");
    const progressFill = document.getElementById("progressFill");
    const progressLabel = document.getElementById("progressLabel");
    const hiddenChecks = [
      document.getElementById("q1"),
      document.getElementById("q2"),
      document.getElementById("q3"),
      document.getElementById("q4"),
    ].filter(Boolean);

    // CLAIM & STATUS
    const claimBtn = document.getElementById("btn-claim");
    const claimHint = document.getElementById("claim-hint");
    const farcasterBtn = document.getElementById("btn-connect-farcaster");
    const farcasterNote = document.getElementById("farcaster-note");

    // status wallet dari tombol global (header) / mini app
    const evmAddrEl = document.getElementById("evm-addr");
    const evmNoteEl = document.getElementById("evm-note");

    function openMissionUrl(url) {
      if (!url) return;
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        location.href = url;
      }
    }

    // --------- QUEST PROGRESS ----------
    function getCompletedCount() {
      if (hiddenChecks.length === steps.length && steps.length > 0) {
        return hiddenChecks.filter((c) => c.checked).length;
      }
      let done = 0;
      steps.forEach((s) => {
        if (s.classList.contains("active")) done++;
      });
      return done;
    }

    function updateProgress() {
      const total = steps.length || 4;
      const done = getCompletedCount();
      const pct = Math.min(100, Math.max(0, (done / total) * 100));

      if (progressFill) progressFill.style.width = pct + "%";
      if (progressLabel)
        progressLabel.textContent = `${done} / ${total} steps complete`;
    }

    function isWalletConnected() {
      return !!(DONE.wallet && DONE.wallet.connected);
    }

    function isFarcasterEligible() {
      return !!(DONE.farcaster && DONE.farcaster.eligible);
    }

    function updateClaimButtonState() {
      if (!claimBtn) return;

      const total = steps.length || 4;
      const done = getCompletedCount();
      const hasWallet = isWalletConnected();
      const farcasterOk = isFarcasterEligible();

      const ready = done === total && hasWallet && farcasterOk;

      claimBtn.disabled = !ready;
      claimBtn.style.opacity = ready ? "1" : "0.55";
      claimBtn.style.pointerEvents = ready ? "auto" : "none";

      if (!claimHint) return;

      if (!hasWallet) {
        claimHint.textContent =
          "Hubungkan wallet EVM lewat tombol di kanan atas dulu.";
      } else if (done !== total) {
        claimHint.textContent = `Selesaikan semua step quest dulu (${done}/${total}).`;
      } else if (!farcasterOk) {
        claimHint.textContent =
          "Akun Farcaster kamu belum diverifikasi / belum lolos Neynar score ≥ 0.35.";
      } else {
        claimHint.textContent =
          "Semua syarat terpenuhi. Klik tombol untuk klaim 1,000 DONE.";
      }
    }

    // Step click handlers
    steps.forEach((step, idx) => {
      const circle = step.querySelector(".step-circle");

      function applyVisual(active) {
        step.classList.toggle("active", active);
        if (!circle) return;

        if (active) {
          circle.style.borderColor = "#4ade80";
          circle.style.background =
            "radial-gradient(circle at 30% 0,#22c55e,#065f46)";
        } else {
          circle.style.borderColor = "rgba(129,140,248,.7)";
          circle.style.background =
            "radial-gradient(circle at 30% 0,rgba(59,130,246,.3),rgba(15,23,42,1))";
        }
      }

      applyVisual(false);

      step.addEventListener("click", () => {
        const url = step.dataset.url;
        if (url) openMissionUrl(url);

        const currentlyActive = step.classList.contains("active");
        const next = !currentlyActive;

        applyVisual(next);

        if (hiddenChecks[idx]) {
          hiddenChecks[idx].checked = next;
        }

        updateProgress();
        updateClaimButtonState();
      });
    });

    updateProgress();

    // --------- FARCASTER CONNECT BUTTON (WEB) ----------
    if (farcasterBtn) {
      farcasterBtn.addEventListener("click", async () => {
        try {
          if (!DONE.ensureFarcasterEligibility) {
            alert(
              "Verifikasi Farcaster belum dikonfigurasi di front-end (DONE.ensureFarcasterEligibility tidak ada)."
            );
            return;
          }

          if (farcasterNote) {
            farcasterNote.textContent =
              "Memeriksa Neynar score akun Farcaster kamu…";
          }

          const ok = await DONE.ensureFarcasterEligibility();
          DONE.farcaster.eligible = !!ok;

          if (farcasterNote) {
            if (ok) {
              const score = DONE.farcaster.neynarScore;
              farcasterNote.textContent =
                "Farcaster terverifikasi. Score: " +
                (score != null ? score.toFixed(2) : "OK") +
                ". Kamu bisa menyelesaikan quest dan klaim.";
            } else {
              farcasterNote.textContent =
                "Maaf, akun Farcaster kamu belum memenuhi Neynar score ≥ 0.35 atau tidak bisa diverifikasi.";
            }
          }
        } catch (e) {
          console.error(e);
          if (farcasterNote) {
            farcasterNote.textContent =
              "Gagal memverifikasi akun Farcaster. Coba lagi nanti.";
          }
        } finally {
          updateClaimButtonState();
        }
      });
    }

    // --------- BASE NETWORK HELPER ----------
    async function ensureBaseNetwork(provider) {
      const baseChainId = "0x2105"; // 8453

      try {
        const current = await provider.request({ method: "eth_chainId" });
        if (current === baseChainId) return;
      } catch (e) {
        // ignore
      }

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

    // --------- CLAIM TX ----------
    async function runClaimTransaction() {
      if (!DONE.wallet || !DONE.wallet.connected || !DONE.wallet.provider) {
        throw new Error("Wallet belum terhubung.");
      }

      if (typeof ethers === "undefined") {
        throw new Error("ethers.js belum dimuat di halaman ini.");
      }

      const rawProvider = DONE.wallet.provider;
      const ethersProvider = new ethers.providers.Web3Provider(rawProvider);

      await ensureBaseNetwork(ethersProvider.provider);

      const signer = ethersProvider.getSigner();
      const contract = new ethers.Contract(AIRDROP_ADDRESS, AIRDROP_ABI, signer);

      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.textContent = "⛓️ Sending claim tx…";
      }
      if (claimHint) {
        claimHint.textContent =
          "Tunggu transaksi dikonfirmasi di Base. Satu wallet hanya bisa klaim sekali.";
      }

      const tx = await contract.claim();

      if (claimHint) {
        claimHint.textContent = `Tx dikirim: ${tx.hash}. Menunggu 1 konfirmasi…`;
      }

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        if (claimBtn) {
          claimBtn.textContent = "✅ Claimed";
          claimBtn.disabled = true;
        }
        if (claimHint) {
          claimHint.textContent =
            "Berhasil klaim! DONE akan muncul di wallet kamu di jaringan Base.";
        }
      } else {
        throw new Error("Transaction reverted");
      }
    }

    // --------- CLAIM BUTTON HANDLER ----------
    if (claimBtn) {
      claimBtn.addEventListener("click", async () => {
        try {
          const total = steps.length || 4;
          const done = getCompletedCount();
          if (done !== total) {
            if (claimHint) {
              claimHint.textContent =
                "Selesaikan semua step quest dulu sebelum klaim.";
            }
            updateClaimButtonState();
            return;
          }

          if (!isWalletConnected()) {
            if (claimHint) {
              claimHint.textContent =
                "Hubungkan wallet EVM lewat tombol di kanan atas dulu.";
            }
            updateClaimButtonState();
            return;
          }

          if (!DONE.ensureFarcasterEligibility) {
            if (claimHint) {
              claimHint.textContent =
                "Verifikasi Farcaster belum dikonfigurasi di front-end.";
            }
            updateClaimButtonState();
            return;
          }

          if (claimHint) {
            claimHint.textContent =
              "Memeriksa Neynar score akun Farcaster kamu…";
          }

          const ok = await DONE.ensureFarcasterEligibility();
          DONE.farcaster.eligible = !!ok;

          if (!ok) {
            if (claimHint) {
              claimHint.textContent =
                "Maaf, akun Farcaster kamu belum memenuhi Neynar score ≥ 0.35 atau tidak bisa diverifikasi.";
            }
            updateClaimButtonState();
            return;
          }

          await runClaimTransaction();
        } catch (err) {
          console.error(err);
          if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.textContent = "🎁 Claim 1,000 DONE";
          }
          if (claimHint) {
            let message =
              "Claim failed. Bisa jadi sudah pernah klaim, cap airdrop habis, atau transaksi gagal.";
            if (err && err.message) message += " Details: " + err.message;
            claimHint.textContent = message;
          }
        } finally {
          updateClaimButtonState();
        }
      });
    }

    // Sinkron UI awal (wallet & farcaster)
    if (DONE.updateWalletUI) {
      DONE.updateWalletUI();
    }
    updateClaimButtonState();
  });
})();
