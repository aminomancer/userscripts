// ==UserScript==
// @name           Open GitHub files in VS Code
// @version        1.0.0
// @author         aminomancer
// @homepageURL    https://github.com/aminomancer/userscripts
// @supportURL     https://github.com/aminomancer/userscripts
// @downloadURL    https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/openGitHubFilesInVSCode.user.js
// @updateURL      https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/openGitHubFilesInVSCode.user.js
// @match          https://github.com/*/*
// @grant          GM_listValues
// @grant          GM_getValue
// @grant          GM_setValue
// @description    When viewing a file on a known GitHub repo with a local clone, pressing the `\` key will open the file in VS Code. If a line is highlighted, the file will be opened to that line in VS Code.
// @license        CC-BY-NC-SA-4.0
// @icon           data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 998.7'><path d='M512 0C229.1 0 0 229.1 0 512c0 226.6 146.6 417.9 350.1 485.8 25.6 4.5 35.2-10.9 35.2-24.3 0-12.2-.6-52.5-.6-95.4-128.6 23.7-161.9-31.4-172.2-60.2-5.8-14.7-30.7-60.2-52.5-72.3-17.9-9.6-43.5-33.3-.6-33.9 40.3-.6 69.1 37.1 78.7 52.5 46.1 77.4 119.7 55.7 149.1 42.2 4.5-33.3 17.9-55.7 32.6-68.5-113.9-12.8-233-57-233-252.8 0-55.7 19.8-101.8 52.5-137.6-5.1-12.8-23-65.3 5.1-135.7 0 0 42.9-13.4 140.8 52.5 41-11.5 84.5-17.3 128-17.3s87 5.8 128 17.3c97.9-66.6 140.8-52.5 140.8-52.5 28.2 70.4 10.2 122.9 5.1 135.7 32.6 35.8 52.5 81.3 52.5 137.6 0 196.5-119.7 240-233.6 252.8 18.6 16 34.6 46.7 34.6 94.7 0 68.5-.6 123.5-.6 140.8 0 13.4 9.6 29.4 35.2 24.3C877.4 929.9 1024 737.9 1024 512 1024 229.1 794.9 0 512 0z' fill-rule='evenodd' clip-rule='evenodd' fill='white'/></svg>
// ==/UserScript==

/* global GM_listValues, GM_getValue, GM_setValue */

// These are the default preference values. When the script is first installed,
// these values will be used to populate the preferences, which are stored by
// the userscript manager. To modify the preferences, don't edit the file here.
// Go to the Values tab in the userscript manager and edit them there.
const defaultPrefs = {
  // This script works by opening a URL with vscode's custom URL protocol. The
  // protocol name can be changed here. The default is "vscode", but if you use
  // VS Code Insiders, you should change it to "vscode-insiders".
  protocol_name: "vscode",
  // This is how the script knows what local file to open. This pref maps each
  // GitHub repo to the path of the local clone. If the repo name is "foo/bar",
  // then the path should be "/path/to/foo/bar". If a repo is not listed here,
  // it will not be opened in VS Code. Only use forward slashes, even on
  // Windows, since the path becomes part of a URL.
  repos: {
    "user123/example456": "/path/to/user123/example456",
  },
};

for (const [key, value] of Object.entries(defaultPrefs)) {
  if (GM_getValue(key) === undefined) {
    GM_setValue(key, value);
  }
}

const prefs = {};
for (const key of GM_listValues()) {
  prefs[key] = GM_getValue(key);
}

function openInVSCode({ repoName, filePath, lineNum }) {
  const repoPath = prefs.repos[repoName];
  if (!repoPath) return;
  let protocolURL = `${prefs.protocol_name}://file/${repoPath}/${filePath}`;
  if (lineNum) {
    protocolURL += `:${lineNum}`;
  }
  if (!protocolURL) return;
  var link = document.createElement("a");
  link.setAttribute("href", protocolURL);
  link.click();
}

function getForFilesView() {
  let fileView;
  let fileHeader;
  const hash = location.hash?.match(/#diff-(.*)/)?.[1]?.split("-")[0];
  let targetDiff = hash && `diff-${hash}`;
  let targetFile = targetDiff && document.getElementById(targetDiff);
  while (targetFile) {
    if (!targetFile.classList.contains("file")) {
      if (targetFile.classList.contains("selected-line")) {
        targetFile = targetFile.closest(".file");
        continue;
      }
      break;
    }
    const header = targetFile.querySelector(".file-header");
    const rect = header.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
      fileView = targetFile;
      fileHeader = header;
    }
    break;
  }

  if (!fileView) {
    const fileHeaders = document.querySelectorAll(".file-header");
    for (const header of fileHeaders) {
      const rect = header.getBoundingClientRect();
      if (
        Math.floor(
          Math.abs(rect.top - parseInt(getComputedStyle(header).top))
        ) === 0
      ) {
        fileHeader = header;
        fileView = fileHeader.closest(".file");
        break;
      }
    }
  }

  if (!fileView) {
    return null;
  }

  const selectedLine = fileView.querySelector(".selected-line");
  const lineNum = selectedLine?.dataset?.lineNumber;

  const fileMenu = fileHeader.querySelector(".dropdown details-menu");
  let fileDetails;
  for (const item of fileMenu.children) {
    let path = item.pathname;
    if (!path) continue;
    const match = path.match(/\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)/);
    if (!match) continue;
    const [, user, repo, , filePath] = match;
    fileDetails = {};
    fileDetails.repoName = `${user}/${repo}`;
    fileDetails.filePath = filePath;
    fileDetails.lineNum = lineNum;
    break;
  }

  return fileDetails;
}

function getForURL(url) {
  switch (typeof url) {
    case "string":
      url = new URL(url);
      break;
    case "object":
      if (url instanceof URL) break;
      if (url instanceof Location) break;
      if (url instanceof HTMLAnchorElement) {
        url = new URL(url.href);
        break;
      }
    // fall through
    default:
      return null;
  }
  const [, user, repo, , , ...pathParts] = url.pathname.split("/");
  if (!pathParts.length) return null;
  const repoName = `${user}/${repo}`;
  const lineNum = url.hash?.match(/^#L(\d+)/)?.[1];
  return { repoName, filePath: pathParts.join("/"), lineNum };
}

function handleKeydown(event) {
  if (event.key === "\\") {
    if (document.querySelector("#files.diff-view")) {
      const fileDetails = getForFilesView();
      if (!fileDetails) return;
      event.preventDefault();
      openInVSCode(fileDetails);
    } else if (location.pathname.match(/^\/[^/]+\/[^/]+\/blob\//)) {
      const fileDetails = getForURL(location);
      if (!fileDetails) return;
      event.preventDefault();
      openInVSCode(fileDetails);
    } else if (document.querySelector(".js-navigation-container")) {
      const focusedItem = document.querySelector(
        ".js-navigation-item.navigation-focus"
      );
      if (!focusedItem) return;
      const rect = focusedItem.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
        const link = focusedItem.querySelector("a.rgh-quick-file-edit");
        if (!link) return;
        const fileDetails = getForURL(link);
        if (!fileDetails) return;
        event.preventDefault();
        openInVSCode(fileDetails);
      }
    }
  }
}

document.addEventListener("keydown", handleKeydown);
