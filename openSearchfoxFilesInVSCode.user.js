// ==UserScript==
// @name           Open Searchfox files in VS Code
// @version        1.0.0
// @author         aminomancer
// @homepageURL    https://github.com/aminomancer/userscripts
// @supportURL     https://github.com/aminomancer/userscripts
// @downloadURL    https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/openSearchfoxFilesInVSCode.user.js
// @updateURL      https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/openSearchfoxFilesInVSCode.user.js
// @namespace      https://github.com/aminomancer
// @match          https://searchfox.org/*
// @grant          GM_listValues
// @grant          GM_getValue
// @grant          GM_setValue
// @description    When viewing a file on a known Searchfox repo with a local clone, pressing the `\` key will open the file in VS Code. If a line is highlighted, the file will be opened to that line in VS Code. Use the Values tab in the userscript manager to configure the script and map Searchfox repos to local clone paths. Supports wildcards in repo names.
// @license        CC-BY-NC-SA-4.0
// @icon           https://cdn.jsdelivr.net/gh/aminomancer/userscripts@latest/icons/vscode.svg
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
  // Searchfox repo to the path of the local clone. If the repo name is
  // "foo/bar", then the path should be "/path/to/foo/bar". If a repo is not
  // listed here, it will not be opened in VS Code. Only use forward slashes,
  // even on Windows, since the path becomes part of a URL.
  repos: {
    example123: "/path/to/example123",
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

// Compile the wildcard search regex once for efficiency.
let wildcardExp = /(?<!\\)\*/g;

// Store the compiled expressions for user wildcards in a map for efficiency.
let patternMap = new Map();
function getPatternFor(key) {
  let pattern = patternMap.get(key);
  if (!pattern) {
    pattern = new RegExp("^" + key.replace(wildcardExp, ".*") + "$");
    patternMap.set(key, pattern);
  }
  return pattern;
}

// We support pref keys with wildcards. For example, mozilla-* will match
// mozilla-central, mozilla-beta, mozilla-release, etc. So if the current repo
// name is mozilla-central, we'll first check for that, then we'll check for a
// pref whose wildcard key matches the repo name. Escaped asterisks are treated
// as literal asterisks. Also, a key can't be only asterisks/wildcards.
function getRepoPath(repoName) {
  let keys = Object.keys(prefs.repos);
  let exactMatch = prefs.repos[repoName];
  if (exactMatch) {
    return exactMatch;
  }
  for (let key of keys.filter(
    key => wildcardExp.test(key) && key.replace(wildcardExp, "")
  )) {
    if (getPatternFor(key).test(repoName)) {
      return prefs.repos[key];
    }
  }
}

function openInVSCode({ repoName, filePath, lineNum }) {
  const repoPath = getRepoPath(repoName);
  let protocolURL = `${prefs.protocol_name}://file/${repoPath}/${filePath}`;
  if (lineNum) {
    protocolURL += `:${lineNum}`;
  }
  if (!protocolURL) {
    return;
  }
  let link = document.createElement("a");
  link.setAttribute("href", protocolURL);
  link.click();
}

function getForURL(url) {
  let [, repoName, method, ...pathParts] = url.pathname.split("/");
  if (!pathParts.length) {
    return null;
  }
  switch (method) {
    case "source":
      break;
    case "rev":
    case "diff":
      pathParts.shift();
      break;
    default:
      return null;
  }
  let lineNum = url.hash?.match(/^#(\d+)/)?.[1];
  return { repoName, filePath: pathParts.join("/"), lineNum };
}

function handleKeydown(event) {
  if (event.key === "\\") {
    // Ignore keydown events that originated from a text input, textarea,
    // contenteditable, etc.
    if (
      ["input", "textarea"].includes(event.target.localName) ||
      event.target.isContentEditable ||
      event.target.getAttribute("role") === "textbox"
    ) {
      return;
    }

    const fileDetails = getForURL(location);
    if (fileDetails) {
      event.preventDefault();
      openInVSCode(fileDetails);
    }
  }
}

document.addEventListener("keydown", handleKeydown);
