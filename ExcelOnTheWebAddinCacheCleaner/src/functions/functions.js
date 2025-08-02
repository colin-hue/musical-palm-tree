/**
 * @customfunction
 */


(function () {
  "use strict";
  debugger;
  CustomFunctions.associate("ABOUT", function () {
    return "Extension Inspector v1.0 - Runtime bridge active.";
  });
})();

function listManifestEntriesFromLocalStorage() {
  debugger;
  const matches = [];
  const pattern = /^__OSF_UPLOADFILE\.Manifest\.(\d+)_(.+)$/;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const match = key.match(pattern);

    if (match) {
      const nn = match[1];
      const guid = match[2];
      let name = "—";
      let description = "—";
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        name = parsed?.DisplayName || "Unknown";
        description = parsed?.Description || "None";
      } catch (e) {
        console.warn(`Failed to parse manifest: ${key}`, e);
      }
      matches.push({ NN: nn, GUID: guid, Name: name, Description: description });
    }
  }

  return matches;
}

Office.onReady(() => {
    debugger;
    if (info.host === Office.HostType.Excel) {
    console.log("📡 Custom functions runtime is ready");

    // Check for shared runtime availability
    if (Office.addin?.getGlobal) {
      console.log("✅ Shared runtime active");

      const globals = Office.addin.getGlobal();
      globals.mySharedState = { loaded: true };
    } else {
      console.warn("⚠️ Shared runtime not active in custom functions context");
    }
  }
  if (Office.addin?.getGlobal) {
    const globals = Office.addin.getGlobal();
    globals.listManifestEntriesFromLocalStorage = listManifestEntriesFromLocalStorage;
  }
});