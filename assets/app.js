// app.js – Script untuk versi WEB (index.html, airdrop.html, community.html)
//
// TIDAK memakai miniapp-sdk di sini. Mini app /sdk cuma dipakai di /mini/.

// Namespace sederhana
window.DONE = window.DONE || {};

// GANTI dengan URL mini app kamu di Farcaster (kalau ID berubah)
window.DONE.MINIAPP_URL =
  "https://farcaster.xyz/miniapps/3YcfUSEaBQQM/done-quest-done";

(function () {
  // ---------- Scroll reveal ----------
  function setupScrollReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) {
      // fallback: kalau browser lama, tampilkan saja semuanya
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in"); // CSS: .reveal.in { opacity:1; ... }
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    els.forEach((el) => obs.observe(el));
  }

  // ---------- Tombol buka mini app Farcaster ----------
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
