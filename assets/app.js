// app.js – Shared JS untuk versi WEB (index.html, airdrop.html, community.html)
//
// - Scroll reveal animasi
// - Tombol "Open DONE Quest Mini App" di web (forward ke URL mini app di Farcaster)
//
// CATATAN PENTING:
//   Mini App Farcaster PUNYA file sendiri: /mini/index.html + /mini/mini-app.js
//   Di sini kita TIDAK import miniapp-sdk lagi supaya tidak bikin konflik.

window.DONE = window.DONE || {};
const DONE = window.DONE;

// URL mini app di Farcaster (ubah kalau ID mini app kamu beda)
DONE.MINIAPP_URL = "https://farcaster.xyz/miniapps/3YcfUSEaBQQM/done-quest-done";

(function () {
  // ---------- SCROLL REVEAL ----------
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

  // ---------- MINI APP BUTTON (WEB) ----------
  function setupMiniAppButtons() {
    const buttons = document.querySelectorAll(".js-miniapp-start");
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = (window.DONE && DONE.MINIAPP_URL) || null;
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
