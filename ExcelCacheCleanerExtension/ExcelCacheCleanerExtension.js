var Hole19_API_URL =
  "https://script.google.com/macros/s/AKfycbyoHEo8gUNzJfUYTz4oInOmPQivUtZyymyLo3laNPTFA7JPv4eiXb6e8iDTZvcNnIHIHQ/exec";

Office.onReady((info) => {
  // Check that we loaded into Excel
  if (info.host === Office.HostType.Excel) {
    console.info("Excel Add-In Loaded", "onReady");
    indexedDB.open("CustomFunctionCache").onsuccess = (event) => {
      const db = event.target.result;
      const storeNames = Array.from(db.objectStoreNames);

      if (storeNames.length === 0) {
        console.warn("📭 No object stores found in CustomFunctionCache DB");
        return;
      }

      console.info(`📚 Available stores:`, storeNames);

      const tx = db.transaction(storeNames, "readonly");
      storeNames.forEach((storeName) => {
        const store = tx.objectStore(storeName);
        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            console.log(`🗝️ Key:`, cursor.key);
            console.log(`📦 Value:`, cursor.value);
            cursor.continue();
          } else {
            console.log(`✅ Finished iterating ${storeName}`);
          }
        };
      });
    };
  }
});
