/**
 * @customfunction
 */
!(function () {
  "use strict";
  CustomFunctions.associate("ABOUT", function (n, t) {
    return "Extension Inspector v1.0 - Runtime bridge active.";
  });
})();

function listManifestEntriesFromLocalStorage() {
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

Office.addin.setGlobalVariable("listManifestEntriesFromLocalStorage", listManifestEntriesFromLocalStorage);