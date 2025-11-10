// app.js - shared logic untuk semua halaman
// - Deteksi Farcaster Mini App
// - Scroll reveal
// - Global tombol Connect Wallet di header
// - Helper Farcaster + Neynar score gating

import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk";

// Global namespace
window.DONE = window.DONE || {};
const DONE = window.DONE;

// URL mini app kamu di Farcaster
DONE.MINIAPP_URL = "https://farcaster.xyz/miniapps/3YcfUSEaBQQM/done-quest-done";

// --------- DETECT MINI APP ----------
(function detectMiniApp() {
  let mini = false;
  try {
    if (window.parent && window.parent !== window) mini = true;

    const ref = document.referrer || "";
    if (ref.includes("warpcast.com") || ref.includes("farcaster.xyz")) mini = true;

    const qs = new URLSearchParams(location.search);
    if (qs.get("miniapp") === "1" || qs.get("miniApp") === "1" || qs.get("miniapp") === "true") {
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

// --------- MINI APP READY HELPER ----------
function signalMiniAppReady() {
  try {
    if (sdk?.actions?.ready) sdk.actions.ready();
  } catch (e) {}

  try {
    window.parent?.postMessage({ type: "miniapp.ready" }, "*");
  } catch (e) {}

  try {
    window.parent?.postMessage({ type: "frame_ready" }, "*");
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
  provider: null, // EIP-1193 provider (mini app atau browser)
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
  checked: false, // sudah pernah dicek ke backend / Neynar
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
      btn.classList.remove("connected");
      btn.classList.remove("miniapp-connected");
      labelEl.textContent = "Connect wallet";
    } else {
      btn.classList.add("connected");
      labelEl.textContent = shortAddress(addr) || "Wallet connected";

      if (DONE.isMiniApp) {
        // di mini app, button cuma display, disconnect via keluar mini app
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
      noteDisplay.textContent = "Wallet Farcaster kamu sudah terhubung.";
    } else {
      noteDisplay.textContent =
        "EVM wallet di browser sudah terhubung. Pastikan jaringan sudah di Base sebelum klaim.";
    }
  }
}

async function connectWallet() {
  if (DONE.wallet.connected) return DONE.wallet;

  // MINI APP: pakai wallet embed Farcaster
  if (DONE.isMiniApp) {
    const provider = await sdk.wallet.getEthereumProvider();

    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const address = accounts && accounts[0];
    const chainId = await provider.request({ method: "eth_chainId" });

    DONE.wallet.provider = provider;
    DONE.wallet.address = address;
    DONE.wallet.chainId = chainId;
    DONE.wallet.connected = true;
    DONE.wallet.source = "miniapp";

    // hydrate farcaster context
    if (sdk.context?.user) {
      DONE.farcaster.fid = sdk.context.user.fid;
      DONE.farcaster.username = sdk.context.user.username || null;
      DONE.farcaster.displayName = sdk.context.user.displayName || null;
    }

    updateWalletUI();
    return DONE.wallet;
  }

  // WEB: pakai wallet EVM di browser (MetaMask, Rabby, dll)
  const ethereum = window.ethereum;
  if (!ethereum) {
    alert(
      "Tidak menemukan wallet EVM di browser.\nCoba install MetaMask / Rabby / Coinbase Wallet."
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
  DONE.wallet.source = "browser";

  updateWalletUI();
  return DONE.wallet;
}

function disconnectWallet() {
  if (DONE.isMiniApp) {
    // by design: disconnect cuma via keluar mini app
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
  if (state.checked) return state.eligible;

  // Kalau di mini app, coba ambil FID dari context
  if (!state.fid && DONE.isMiniApp && sdk.context?.user) {
    state.fid = sdk.context.user.fid;
    state.username = sdk.context.user.username || null;
    state.displayName = sdk.context.user.displayName || null;
  }

  // Kalau masih belum ada FID (contoh: akses dari web biasa)
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
    // PENTING:
    // Ubah endpoint ini ke backend kamu sendiri.
    // Backend:
    //   - baca query ?fid=
    //   - panggil Neynar API (dengan NEYNAR_API_KEY di server, bukan di browser)
    //   - return JSON { score: number } atau { experimental: { neynar_user_score: number } }
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

// expose ke global
DONE.connectWallet = connectWallet;
DONE.disconnectWallet = disconnectWallet;
DONE.updateWalletUI = updateWalletUI;
DONE.ensureFarcasterEligibility = ensureFarcasterEligibility;
DONE.sdk = sdk;

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
  document.querySelectorAll(".js-miniapp-start").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (DONE.isMiniApp) {
        signalMiniAppReady();
      } else {
        window.open(DONE.MINIAPP_URL, "_blank");
      }
    });
  });

  // Initial sync UI
  updateWalletUI();
});

// Auto signal + auto connect kalau di mini app
window.addEventListener("load", () => {
  if (DONE.isMiniApp) {
    (async () => {
      try {
        await sdk.actions.ready();
      } catch (e) {
        console.warn("sdk.actions.ready error:", e);
      }

      try {
        await connectWallet();
      } catch (e) {
        console.warn("Auto-connect wallet mini app gagal:", e);
      }
    })();
  }
});
