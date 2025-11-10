// app.js – Shared JS untuk versi WEB (index.html, airdrop.html, community.html)
//
// TIDAK ada import miniapp-sdk di sini. Mini app cuma di /mini/.

// namespace simpel
window.DONE = window.DONE || {};

// Ganti dengan URL mini app kamu di Farcaster
window.DONE.MINIAPP_URL =
  "https://farcaster.xyz/miniapps/3YcfUSEaBQQM/done-quest-done";

(function () {
  // ---------- Scroll reveal ----------
  function setupScrollReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.15,
      }
    );

    els.forEach((el) => observer.observe(el));
  }

  // ---------- Open mini app from web ----------
  function setupMiniAppButtons() {
    const buttons = document.querySelectorAll(".js-miniapp-start");
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = window.DONE && window.DONE.MINIAPP_URL;
        if (!url) {
          alert("Mini app URL belum dikonfigurasi.");
          return;
        }
        window.open(url, "_blank");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupScrollReveal();
    setupMiniAppButtons();
  });
})();
