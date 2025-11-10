// app.js – Script untuk versi WEB (index.html, airdrop.html, community.html)
//
// TIDAK pakai miniapp-sdk. Mini app cuma di /mini/.

window.DONE = window.DONE || {};

// Ganti dengan URL mini app Farcaster kamu
window.DONE.MINIAPP_URL =
  "https://farcaster.xyz/miniapps/3YcfUSEaBQQM/done-quest-done";

(function () {
  // ---------- Scroll reveal ----------
  function setupScrollReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;

    if (!("IntersectionObserver" in window)) {
      // Browser lama: tampilkan saja
      els.forEach((el) => el.classList.add("reveal-visible"));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    els.forEach((el) => obs.observe(el));
  }

  // ---------- Tombol buka mini app ----------
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
