// app.js - shared logic untuk semua halaman DONE COIN
// - Deteksi Farcaster Mini App
// - Scroll reveal
// - Global tombol Connect Wallet di header
// - Helper Farcaster + Neynar score gating (dipakai di airdrop.js)

// Global namespace
window.DONE = window.DONE || {};
const DONE = window.DONE;

// URL mini app kamu di Farcaster (optional, untuk tombol "Open mini app")
DONE.MINIAPP_URL = "https://farcaster.xyz/miniapps/3YcfUSEaBQQM/done-quest-done";

// --------- DETECT MINI APP ----------
(function detectMiniApp() {
  let mini = false;
  try {
    // kalau dibuka dalam iframe native Farcaster
    if (window.parent && window.parent !== window) mini = true;

    const ref = document.referrer || "";
    if (ref.includes("warpcast.com") || ref.includes("farcaster.xyz")) {
      mini = true;
    }

    const qs = new URLSearchParams(location.search);
    if (
      qs.get("miniapp") === "1" ||
      qs.get("miniApp") === "1" ||
      qs.get("miniapp") === "true"
    ) {
      mini = true;
    }
  } catch (e) {}

  if (mini) {
    document.documentElement.classList.add("miniapp");
  }
  DONE.isMiniApp = mini;
})();

// --------- SCROLL REVEAL ----------
const obs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        obs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.1 }
);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
});

// --------- MINI APP READY HELPER (opsional) ----------
function signalMiniAppReady() {
  try {
    window.parent?.postMessage({ type: "miniapp.ready" }, "*");
  } catch (e) {}

  try {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: "miniapp.ready" })
    );
  } catch (e) {}
}
DONE.signalMiniAppReady = signalMiniAppReady;

// --------- GLOBAL STATE: WALLET + FARCASTER ----------
DONE.wallet = {
  provider: null,
  address: null,
  chainId: null,
  connected: false,
  source: null, // 'miniapp' | 'browser'
};

DONE.farcaster = {
  fid: null,
  username: null,
  displayName: null,
  neynarScore: null,
  eligible: false,
  checked: false,
};

const MIN_NEYNAR_SCORE = 0.35;

// --------- WALLET UTILS ----------
function shortAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function updateWalletUI() {
  const btn = document.querySelector("[data-wallet-toggle]");
  const labelEl = document.querySelector("[data-wallet-label]");
  const addrDisplay = document.getElementById("evm-addr");
  const noteDisplay = document.getElementById("evm-note");

  const connected = DONE.wallet.connected;
  const addr = DONE.wallet.address;

  // Header button
  if (btn && labelEl) {
    if (!connected) {
      btn.classList.remove("connected", "miniapp-connected");
      labelEl.textContent = "Connect wallet";
    } else {
      btn.classList.add("connected");
      labelEl.textContent = shortAddress(addr) || "Wallet connected";

      if (DONE.isMiniApp) {
        btn.classList.add("miniapp-connected");
      } else {
        btn.classList.remove("miniapp-connected");
      }
    }
  }

  // Panel status di halaman airdrop (kalau ada)
  if (addrDisplay) {
    if (connected) {
      addrDisplay.textContent = shortAddress(addr);
      addrDisplay.style.display = "inline-block";
    } else {
      addrDisplay.textContent = "";
      addrDisplay.style.display = "none";
    }
  }

  if (noteDisplay) {
    if (!connected) {
      noteDisplay.textContent =
        "Connect wallet lewat tombol di kanan atas untuk bisa klaim airdrop.";
    } else if (DONE.isMiniApp) {
      noteDisplay.textContent =
        "Wallet Farcaster (mini app) kamu sudah terhubung.";
    } else {
      noteDisplay.textContent =
        "EVM wallet di browser sudah terhubung. Pastikan jaringan sudah di Base sebelum klaim.";
    }
  }
}

async function connectWallet() {
  if (DONE.wallet.connected) return DONE.wallet;

  const ethereum = window.ethereum;
  if (!ethereum) {
    alert(
      "Tidak menemukan wallet EVM di browser.\n" +
        "Di web: install MetaMask / Rabby / Coinbase.\n" +
        "Di mini app: pastikan membuka dari Farcaster yang support wallet."
    );
    return DONE.wallet;
  }

  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  const address = accounts && accounts[0];
  const chainId = await ethereum.request({ method: "eth_chainId" });

  DONE.wallet.provider = ethereum;
  DONE.wallet.address = address;
  DONE.wallet.chainId = chainId;
  DONE.wallet.connected = true;
  DONE.wallet.source = DONE.isMiniApp ? "miniapp" : "browser";

  updateWalletUI();
  return DONE.wallet;
}

function disconnectWallet() {
  if (DONE.isMiniApp) {
    alert(
      "Di Farcaster Mini App, putus koneksi wallet cukup dengan keluar dari mini app."
    );
    return;
  }

  DONE.wallet.provider = null;
  DONE.wallet.address = null;
  DONE.wallet.chainId = null;
  DONE.wallet.connected = false;
  DONE.wallet.source = null;

  updateWalletUI();
}

// --------- FARCASTER + NEYNAR GATING ----------
async function ensureFarcasterEligibility() {
  const state = DONE.farcaster;
  if (state.checked && state.neynarScore != null) {
    return state.eligible;
  }

  // Tidak pakai SDK, jadi minta FID manual
  if (!state.fid) {
    const input = prompt(
      "Masukkan FID Farcaster kamu untuk verifikasi Neynar (contoh: 12345):"
    );
    if (!input) {
      state.checked = true;
      state.eligible = false;
      return false;
    }
    const fidNum = Number.parseInt(input.trim(), 10);
    if (!Number.isFinite(fidNum)) {
      alert("FID tidak valid.");
      state.checked = true;
      state.eligible = false;
      return false;
    }
    state.fid = fidNum;
  }

  try {
    const resp = await fetch(`/api/neynar-score?fid=${state.fid}`);
    if (!resp.ok) throw new Error("Failed to fetch Neynar score");
    const data = await resp.json();

    const score =
      typeof data.score === "number"
        ? data.score
        : data.experimental?.neynar_user_score ?? 0;

    state.neynarScore = score;
    state.eligible = score >= MIN_NEYNAR_SCORE;
    state.checked = true;

    return state.eligible;
  } catch (err) {
    console.warn("Tidak bisa memverifikasi Neynar score:", err);
    state.neynarScore = null;
    state.eligible = false;
    state.checked = true;
    return false;
  }
}

DONE.updateWalletUI = updateWalletUI;
DONE.connectWallet = connectWallet;
DONE.disconnectWallet = disconnectWallet;
DONE.ensureFarcasterEligibility = ensureFarcasterEligibility;

// --------- DOM WIRING ----------
window.addEventListener("DOMContentLoaded", () => {
  // Header: tombol connect wallet global
  const btn = document.querySelector("[data-wallet-toggle]");
  if (btn) {
    btn.addEventListener("click", async () => {
      if (!DONE.wallet.connected) {
        await connectWallet();
      } else if (!DONE.isMiniApp) {
        const sure = confirm("Putus koneksi wallet dari situs ini?");
        if (sure) disconnectWallet();
      } else {
        alert(
          "Wallet sudah terhubung lewat Farcaster. Untuk disconnect, keluar dari mini app."
        );
      }
    });
  }

  // Tombol "Open DONE Quest Mini App"
  document.querySelectorAll(".js-miniapp-start").forEach((el) => {
    el.addEventListener("click", () => {
      if (DONE.isMiniApp) {
        signalMiniAppReady();
      } else if (DONE.MINIAPP_URL) {
        window.open(DONE.MINIAPP_URL, "_blank");
      }
    });
  });

  updateWalletUI();
});

// Auto connect kalau di mini app (pakai window.ethereum)
window.addEventListener("load", () => {
  if (DONE.isMiniApp) {
    connectWallet().catch((e) =>
      console.warn("Auto-connect wallet mini app gagal:", e)
    );
  }
});
