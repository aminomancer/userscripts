// ==UserScript==
// @name           Old Reddit Better Image Gallery Comments
// @version        1.0.1
// @author         aminomancer
// @homepageURL    https://github.com/aminomancer/userscripts
// @supportURL     https://github.com/aminomancer/userscripts
// @downloadURL    https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/oldRedditBetterGallery.user.js
// @updateURL      https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/oldRedditBetterGallery.user.js
// @namespace      https://github.com/aminomancer
// @match          http*://*.reddit.com/r/*/comments/*
// @grant          GM_getValue
// @grant          GM_setValue
// @run-at         document-idle
// @description    If you visit the comments for an image gallery on old Reddit, it shows a really bad preview of the images rather than just showing the images. This script expands the first image in the gallery automatically, and it replaces all the tiny preview images with the full images. It also (optionally) makes these images resizable by dragging, similar to what the Reddit Enhancement Suite does with images in expandos. To disable this resizing feature, set the `resizeImages` value to false in your script settings. This script is specific to the old Reddit layout, so it does not work on new Reddit.
// @license        CC-BY-NC-SA-4.0
// @icon           https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/icons/reddit.png
// ==/UserScript==

/* global GM_getValue, GM_setValue */

let doResizing = GM_getValue("resizeImages", true);
if (doResizing === undefined) {
  doResizing = true;
  GM_setValue("resizeImages", true);
}

let galleries = [...document.querySelectorAll(".media-gallery")];
for (let gallery of galleries) {
  let tiles = gallery.querySelector(".gallery-tiles");
  if (!tiles) continue;

  tiles.firstElementChild.click();

  for (let item of gallery.children) {
    if (item.classList.contains("gallery-preview")) {
      let image = item.querySelector("img");
      if (image) {
        let originalSrc = image.src;
        image.src = image.parentElement.href;
        image.onerror = () => {
          image.src = originalSrc;
        };

        if (doResizing) {
          makeImageResizable(image);
        }
      }
    }
  }
}

function getDragSize(e) {
  let rect = e.target.getBoundingClientRect();
  return Math.pow(
    Math.pow(e.clientX - rect.left, 2) + Math.pow(e.clientY - rect.top, 2),
    0.5
  );
}

function makeImageResizable(image) {
  let dragTargetData = {};

  image.addEventListener("dragstart", () => false);

  image.addEventListener(
    "mousedown",
    e => {
      if (e.ctrlKey || e.metaKey) return;

      if (e.button === 0) {
        dragTargetData.iw = e.target.width;
        dragTargetData.d = getDragSize(e);
        dragTargetData.dr = false;
        e.preventDefault();
      }
    },
    true
  );

  image.addEventListener("mousemove", e => {
    if (dragTargetData.d) {
      e.target.style.maxWidth = e.target.style.width = `${
        (getDragSize(e) * dragTargetData.iw) / dragTargetData.d
      }px`;
      e.target.style.maxHeight = "";
      e.target.style.height = "auto";
      e.target.style.zIndex = 1000;
      if (!e.target.style.position) {
        e.target.style.position = "relative";
      }
      dragTargetData.dr = true;
    }
  });

  image.addEventListener("mouseout", () => (dragTargetData.d = false));

  image.addEventListener("mouseup", () => (dragTargetData.d = false), true);

  image.addEventListener("click", e => {
    if (e.ctrlKey || e.metaKey) return;
    dragTargetData.d = false;
    if (dragTargetData.dr) {
      e.preventDefault();
    }
  });
}
