// bet.js — Frontend taruhan $DONE di jaringan Base (kontrak DoneBet)

(function () {
  // ====== KONFIGURASI WAJIB DIISI ======
  const DONE_TOKEN_ADDRESS = "0x3Da0Da9414D02c1E4cc4526a5a24F5eeEbfCEAd4";
  const BET_CONTRACT_ADDRESS = "0xA24f111Ac03D9b03fFd9E04bD7A18e65f6bfddd7";

  // ABI standar ERC20 minimal
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
  ];

  // ABI kontrak DoneBet (sesuai dengan DoneBet.sol)
  const BET_ABI = [
    "function minBetAmount() view returns (uint256)",
    "function poolBalance() view returns (uint256)",
    "function quotePayout(uint256 amount) view returns (uint256 reward, uint256 payout)",
    "function placeBet(uint8 side, uint256 amount) external",
  ];

  const els = {};
  const state = {
    provider: null,
    signer: null,
    address: null,
    doneDecimals: 18,
    doneBalanceRaw: "0",
    selectedSide: 0,
    selectedMult: 1.2,
    minBetRaw: null,
    poolBalanceRaw: null,
  };

  document.addEventListener("DOMContentLoaded", () => {
    els.walletAddr = document.getElementById("wallet-addr-bet");
    els.networkName = document.getElementById("network-name");
    els.networkPill = document.getElementById("network-pill");
    els.doneBalance = document.getElementById("done-balance");
    els.btnConnect = document.getElementById("btn-connect");
    els.walletHint = document.getElementById("wallet-hint");

    els.modes = document.querySelectorAll(".mode-chip");
    els.betAmount = document.getElementById("bet-amount");
    els.quickAmounts = document.querySelectorAll(".qa");
    els.minBetHint = document.getElementById("min-bet-hint");
    els.btnPlaceBet = document.getElementById("btn-place-bet");
    els.betStatus = document.getElementById("bet-status");

    els.rewardPreview = document.getElementById("reward-preview");
    els.payoutPreview = document.getElementById("payout-preview");
    els.poolInfo = document.getElementById("pool-info");

    setupUIHandlers();
  });

  function setStatus(msg) {
    if (els.betStatus) els.betStatus.textContent = msg;
  }

  function shortAddr(addr) {
    if (!addr) return "—";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function setupUIHandlers() {
    if (els.btnConnect) {
      els.btnConnect.addEventListener("click", connectWallet);
    }

    if (els.modes && els.modes.length) {
      els.modes.forEach((btn) => {
        btn.addEventListener("click", () => {
          els.modes.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const mult = parseFloat(btn.dataset.mult || "1");
          const side = parseInt(btn.dataset.side || "0", 10);
          state.selectedMult = mult;
          state.selectedSide = side;
          updatePayoutPreview();
        });
      });
    }

    if (els.quickAmounts && els.quickAmounts.length) {
      els.quickAmounts.forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = parseFloat(btn.dataset.percent || "0");
          if (!state.doneBalanceRaw || !state.doneDecimals) return;
          const bal = ethers.utils.formatUnits(
            state.doneBalanceRaw,
            state.doneDecimals
          );
          const numBal = parseFloat(bal);
          if (!isFinite(numBal) || numBal <= 0) return;
          const use = (numBal * p) / 100;
          if (els.betAmount) {
            els.betAmount.value = use.toFixed(4).replace(/\.?0+$/, "");
          }
          updatePayoutPreview();
        });
      });
    }

    if (els.betAmount) {
      els.betAmount.addEventListener("input", () => {
        updatePayoutPreview();
      });
    }

    if (els.btnPlaceBet) {
      els.btnPlaceBet.addEventListener("click", placeBetFlow);
    }
  }

  async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
      setStatus("Tidak ada wallet web3 (window.ethereum tidak ditemukan).");
      if (els.walletHint)
        els.walletHint.textContent =
          "Gunakan browser dengan wallet seperti MetaMask / Rabby.";
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const addr = accounts[0];

      state.provider = provider;
      state.signer = provider.getSigner();
      state.address = addr;

      if (els.walletAddr) els.walletAddr.textContent = shortAddr(addr);

      await ensureBaseNetwork(provider.provider);
      await refreshNetworkInfo();
      await loadDoneTokenInfo();
      await loadBetConfig();

      setStatus("Wallet terhubung. Siap untuk bertaruh.");
    } catch (e) {
      console.error(e);
      setStatus(
        "Gagal menghubungkan wallet: " + (e?.message || "unknown error")
      );
    }
  }

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

  async function refreshNetworkInfo() {
    if (!state.provider) return;
    try {
      const net = await state.provider.getNetwork();
      if (els.networkName) {
        const chainId = Number(net.chainId || 0);
        if (chainId === 8453) {
          els.networkName.textContent = "Base";
          els.networkPill && els.networkPill.classList.add("ok");
        } else {
          els.networkName.textContent = `chainId ${chainId}`;
          els.networkPill && els.networkPill.classList.add("bad");
        }
      }
    } catch (e) {
      console.warn("refreshNetworkInfo error:", e);
    }
  }

  async function loadDoneTokenInfo() {
    if (!state.signer || !state.address) return;
    if (
      !DONE_TOKEN_ADDRESS ||
      DONE_TOKEN_ADDRESS === "0xYOUR_DONE_TOKEN_ADDRESS_HERE"
    ) {
      setStatus("DONE_TOKEN_ADDRESS belum di-set di bet.js");
      return;
    }

    try {
      const erc20 = new ethers.Contract(
        DONE_TOKEN_ADDRESS,
        ERC20_ABI,
        state.signer
      );

      const [decimals, balance] = await Promise.all([
        erc20.decimals(),
        erc20.balanceOf(state.address),
      ]);

      state.doneDecimals = decimals;
      state.doneBalanceRaw = balance.toString();

      const human = ethers.utils.formatUnits(balance, decimals);
      if (els.doneBalance) {
        els.doneBalance.textContent = human;
      }
    } catch (e) {
      console.error(e);
      setStatus("Gagal membaca balance $DONE: " + (e?.message || ""));
    }
  }

  async function loadBetConfig() {
    if (!state.signer) return;
    if (!BET_CONTRACT_ADDRESS) {
      setStatus("BET_CONTRACT_ADDRESS belum di-set di bet.js");
      return;
    }
    try {
      const bet = new ethers.Contract(
        BET_CONTRACT_ADDRESS,
        BET_ABI,
        state.signer
      );

      try {
        const minBet = await bet.minBetAmount();
        state.minBetRaw = minBet.toString();
        const humanMin = ethers.utils.formatUnits(
          minBet,
          state.doneDecimals || 18
        );
        if (els.minBetHint) {
          els.minBetHint.textContent = `Minimal bet dari kontrak: ${humanMin} DONE`;
        }
      } catch (e) {
        console.warn("loadBetConfig: minBetAmount error", e);
      }

      try {
        const pool = await bet.poolBalance();
        state.poolBalanceRaw = pool.toString();
        if (els.poolInfo) {
          const humanPool = ethers.utils.formatUnits(
            pool,
            state.doneDecimals || 18
          );
          els.poolInfo.textContent = `Pool: ${humanPool} DONE tersedia untuk payout`;
        }
      } catch (e) {
        console.warn("loadBetConfig: poolBalance error", e);
      }

      updatePayoutPreview();
    } catch (e) {
      console.warn("loadBetConfig error:", e);
    }
  }

  async function updatePayoutPreview() {
    if (!state.signer || !BET_CONTRACT_ADDRESS) {
      return;
    }
    if (!els.betAmount) return;

    const rawAmount = els.betAmount.value;
    const num = parseFloat(rawAmount);
    if (!isFinite(num) || num <= 0) {
      if (els.rewardPreview) els.rewardPreview.textContent = "";
      if (els.payoutPreview) els.payoutPreview.textContent = "";
      return;
    }

    try {
      const bet = new ethers.Contract(
        BET_CONTRACT_ADDRESS,
        BET_ABI,
        state.signer
      );

      const amount = ethers.utils.parseUnits(
        rawAmount,
        state.doneDecimals || 18
      );
      const [reward, payout] = await bet.quotePayout(amount);

      const humanReward = ethers.utils.formatUnits(
        reward,
        state.doneDecimals || 18
      );
      const humanPayout = ethers.utils.formatUnits(
        payout,
        state.doneDecimals || 18
      );

      if (els.rewardPreview) {
        els.rewardPreview.textContent = `Reward (tanpa modal) jika menang: ${humanReward} DONE`;
      }
      if (els.payoutPreview) {
        els.payoutPreview.textContent = `Payout jika menang (modal + reward): ${humanPayout} DONE`;
      }
    } catch (e) {
      console.warn("updatePayoutPreview error:", e);
    }
  }

  async function placeBetFlow() {
    if (!state.signer || !state.address) {
      setStatus("Hubungkan wallet dulu.");
      return;
    }

    const rawAmount = (els.betAmount && els.betAmount.value) || "";
    const num = parseFloat(rawAmount);
    if (!isFinite(num) || num <= 0) {
      setStatus("Masukkan jumlah $DONE yang valid.");
      return;
    }

    try {
      const amount = ethers.utils.parseUnits(
        rawAmount,
        state.doneDecimals || 18
      );

      if (state.minBetRaw) {
        const min = ethers.BigNumber.from(state.minBetRaw);
        if (amount.lt(min)) {
          const humanMin = ethers.utils.formatUnits(
            state.minBetRaw,
            state.doneDecimals || 18
          );
          setStatus(`Jumlah bet kurang dari minimal: ${humanMin} DONE`);
          return;
        }
      }

      const erc20 = new ethers.Contract(
        DONE_TOKEN_ADDRESS,
        ERC20_ABI,
        state.signer
      );
      const bet = new ethers.Contract(
        BET_CONTRACT_ADDRESS,
        BET_ABI,
        state.signer
      );

      setStatus("Mengecek allowance $DONE untuk kontrak bet…");
      const allowance = await erc20.allowance(
        state.address,
        BET_CONTRACT_ADDRESS
      );

      if (allowance.lt(amount)) {
        setStatus("Allowance kurang. Mengirim transaksi approve…");
        const txApprove = await erc20.approve(BET_CONTRACT_ADDRESS, amount);
        await txApprove.wait();
        setStatus("Approve selesai. Mengirim transaksi bet…");
      } else {
        setStatus("Allowance cukup. Mengirim transaksi bet…");
      }

      const side = state.selectedSide || 0;
      const tx = await bet.placeBet(side, amount);
      setStatus(
        "Tx bet terkirim: " + tx.hash + " (menunggu konfirmasi)…"
      );

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        setStatus(
          "✅ Bet sukses! Kalau kamu menang, payout (modal + reward) sudah otomatis masuk ke wallet ini."
        );
        await loadDoneTokenInfo();
      } else {
        setStatus("Transaksi bet gagal / reverted.");
      }
    } catch (e) {
      console.error(e);
      setStatus("Bet gagal: " + (e?.message || "unknown error"));
    }
  }
})();
