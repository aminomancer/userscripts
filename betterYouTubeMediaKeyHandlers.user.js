// ==UserScript==
// @name           Better YouTube Media Key Handlers
// @version        1.0.1
// @author         aminomancer
// @homepageURL    https://github.com/aminomancer/userscripts
// @supportURL     https://github.com/aminomancer/userscripts
// @downloadURL    https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/betterYouTubeMediaKeyHandlers.user.js
// @updateURL      https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/betterYouTubeMediaKeyHandlers.user.js
// @namespace      https://github.com/aminomancer
// @match          http*://www.youtube.*/*
// @run-at         document-start
// @description    YouTube's natural shuffle method is really bad. From a given video, it deterministically chooses the next video. This sometimes leads to getting stuck in a short loop of videos, where one video leads through 3 or 4 videos to another video that leads back to the first video. The only way out of this situation is to manually click another video in the playlist, which sucks if you're trying to do this without a mouse or without switching back to the YouTube tab. If you wanted to use YouTube playlists at a party or something like that, you'd really be screwed. This script fixes that by taking over the "next" and "previous" hardware media keys, and applying an actually random shuffle function to them. If you don't have these hardware media keys, then the script won't do anything. These are basically the "next" and "previous" keys you find on keyboards, on remotes, and on certain headphones (e.g. click once to pause, twice to go forward). Now, this won't prevent loops when you just let one video end and it naturally proceeds to the next one. But this is basically a failsafe for when a loop does happen: if you hear the same song again, just hit the "next" media key and it should pick a truly random song, rather than picking the same (deterministic) song YouTube would pick.
// @license        CC-BY-NC-SA-4.0
// @icon           https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/icons/youtube.svg
// ==/UserScript==

function waiveXray(obj) {
  if (typeof obj === "object") {
    if ("wrappedJSObject" in obj) return obj.wrappedJSObject;
  }
  return obj;
}

function findProperty(obj, key) {
  if (typeof obj === "object") {
    let unwrapped = waiveXray(obj);
    let unwrappedGot = unwrapped.get?.(key);
    if (unwrappedGot) return unwrappedGot;
    let got = obj.get?.(key);
    if (got) return got;
    // If we don't find the target through get(), try to find it with a normal
    // accessor. Keys can have period accessors, which are passed to get() as a
    // single complete string (e.g. "prop1.prop2.prop3"). So we need to access
    // the properties in the same way by splitting the key.
    let keys = key.split(".");
    for (let key of keys) {
      unwrapped = waiveXray(unwrapped)?.[key];
      if (!unwrapped) break;
    }
    if (unwrapped) return unwrapped;
    let prop = obj;
    for (let key of keys) {
      prop = prop?.[key];
      if (!prop) break;
    }
    if (prop) return prop;
  }
  return null;
}

// There's a main container and a miniplayer container. We usually want to
// search for elements in whichever one is active, so use this instead of
// document wherever possible.
function getContainer() {
  let preview = document.getElementsByTagName("ytd-video-preview")[0];
  if (findProperty(preview, "active")) {
    return preview;
  }
  let miniplayer = document.getElementsByTagName("ytd-miniplayer")[0];
  if (findProperty(miniplayer, "active")) {
    return miniplayer;
  }
  let manager = document.getElementsByTagName("ytd-watch-flexy")[0];
  if (findProperty(manager, "active")) {
    return manager;
  }
  return document.body.querySelector("ytd-app > #content");
}

/**
 * There's a main container and a miniplayer container. We usually want to
 * search for elements in whichever one is active, so use this instead of
 * document.querySelector(selector) wherever possible.
 * @param {string} selector A CSS selector string
 * @returns {Element|undefined} Just like document.querySelector
 */
function findContainerElement(selector) {
  return (
    getContainer().querySelector(selector) || document.querySelector(selector)
  );
}

function findControlElement(selector) {
  let sel;
  let container = getContainer();
  switch (container.localName) {
    case "ytd-video-preview":
      sel = selector;
      break;
    case "ytd-miniplayer":
      sel = `.ytp-miniplayer-ui ${selector}`;
      break;
    default:
      sel = `.ytp-chrome-bottom ${selector}`;
      break;
  }
  return container.querySelector(sel) || document.querySelector(sel);
}

/**
 * Check a menu button's active state. Must be a button contained in
 * #top-level-buttons or #top-level-buttons-computed.
 * @param {Element} menu The container to search for the button in. Should be
 *   the parent of a ytd-menu-renderer element.
 * @param {string} query A data property to search for. This is basically a
 *   selector for a JS property instead of for an HTML attribute. It's needed
 *   because the buttons don't have any identifying HTML attributes. We'd be
 *   forced to just target them by child index otherwise, but such indices
 *   aren't consistent. An example is "data.targetId" which you can see inside
 *   the top level button in the console at button.__data.data.targetId
 * @param {*} [val] The value the data property specified by query should have.
 *   This is optional. If omitted, we'll accept the button regardless of the
 *   property value, as long as it has the property. This is usually a string.
 *   An example matching the above query parameter is "watch-like"
 * @returns {boolean|number|null} If the button is a toggle button, return true
 *   if the button is toggled on. If it's a cycle button like the repeat/loop
 *   button, return an integer representing the index of the button's current
 *   state relative to its possible states. These states match the Rainmeter
 *   plugin's repeat states: 0 is loop off, 1 is loop all, 2 is loop one.
 *   Finally, if this method doesn't support the button passed, return null.
 */
function checkTopLevelButton(menu, { query, val } = {}) {
  if (!menu || !query) {
    return null;
  }
  let buttons = menu.querySelector("#top-level-buttons-computed");
  if (!buttons || buttons.hidden) {
    buttons = menu.querySelector("#top-level-buttons");
  }
  if (!buttons) {
    return null;
  }

  buttons = [...buttons.children];
  let button = buttons.find(btn => {
    let found = findProperty(btn, query);
    if (val) {
      return found === val;
    }
    return !!found;
  });
  if (!button) {
    return null;
  }

  let data = findProperty(button, "data");
  if (data && data.states) {
    let states = [...data.states]?.map(state => {
      for (let prop in state) {
        if (typeof state[prop] === "object" && "state" in state[prop]) {
          return state[prop].state;
        }
      }
      return null;
    });
    if (states) {
      // loop states = ["PLAYLIST_LOOP_STATE_NONE", "PLAYLIST_LOOP_STATE_ALL", "PLAYLIST_LOOP_STATE_ONE"];
      let currentState = findProperty(button, "currentState");
      if (currentState) {
        return Math.max(states.indexOf(currentState), 0);
      }
    }
  }

  return (
    button.classList.contains("style-default-active") ||
    button.getAttribute("aria-pressed") == "true" ||
    !!button.querySelector("[aria-pressed='true']")
  );
}

function getShuffleState() {
  let menu = findContainerElement("#playlist-action-menu");
  if (menu?.children.length > 0) {
    return Number(
      checkTopLevelButton(menu, {
        query: "data.defaultIcon.iconType",
        val: "SHUFFLE",
      })
    );
  }
  return 0;
}

let session = navigator.mediaSession;

session.setActionHandler("nexttrack", () => {
  let next = findControlElement(".ytp-next-button");
  let playlist = findContainerElement(".playlist-items");
  if (
    !findContainerElement("#playlist")?.hasAttribute("has-playlist-buttons")
  ) {
    next.click();
  } else if (getShuffleState()) {
    playlist.children[Math.floor(Math.random() * playlist.children.length)]
      .querySelector("#meta")
      ?.click();
  } else if (
    !playlist
      .querySelector("#playlist-items:last-of-type")
      ?.hasAttribute("selected")
  ) {
    playlist
      .querySelector("#playlist-items[selected]")
      ?.nextSibling?.querySelector("#meta")
      ?.click();
  } else if (
    checkTopLevelButton(findContainerElement("#playlist-action-menu"), {
      query: "playlistLoopStateEntity",
    }) // Repeat playlist
  ) {
    playlist.firstElementChild.querySelector("#meta").click();
  } else {
    next.click();
  }
});

session.setActionHandler("previoustrack", () => {
  let video = document.querySelector(".html5-main-video");
  let previous = findControlElement(".ytp-prev-button");
  if (previous?.getAttribute("aria-disabled") == "false") {
    previous.click();
  } else {
    let container = getContainer();
    if (
      container.localName == "ytd-watch-flexy" &&
      (video.currentTime ||
        findProperty(container, "player.getCurrentTime")?.()) <= 3
    ) {
      history.back();
    } else {
      video.currentTime = 0;
    }
  }
});

// Now no-op the setActionHandler method so YouTube can't overwrite our handlers
session.setActionHandler = new Proxy(session.setActionHandler, {
  apply(target, thisArg, args) {
    // If it's not a nexttrack or previoustrack handler, route it to the
    // original method so YouTube can still use it for other actions.
    if (!["nexttrack", "previoustrack"].includes(args[0])) {
      return Reflect.apply(target, thisArg, args);
    }
  },
});
