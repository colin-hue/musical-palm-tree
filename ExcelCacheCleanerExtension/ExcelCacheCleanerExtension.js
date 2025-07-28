var Hole19_API_URL = "https://script.google.com/macros/s/AKfycbyoHEo8gUNzJfUYTz4oInOmPQivUtZyymyLo3laNPTFA7JPv4eiXb6e8iDTZvcNnIHIHQ/exec"



Office.onReady((info) => {
        // Check that we loaded into Excel
        if (info.host === Office.HostType.Excel) {
            console.info("Excel Add-In Loaded", "onReady");
            const dbName = 'CustomFunctionCache';
            indexedDB.open(dbName).onsuccess = event => {
            const db = event.target.result;
            const tx = db.transaction(db.objectStoreNames, 'readonly');

            Array.from(db.objectStoreNames).forEach(storeName => {
              const store = tx.objectStore(storeName);
              store.openCursor().onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) {
                  const key = cursor.key;
                  const value = cursor.value;
                  // Render this to taskpane UI
                  console.log(`🗝️ ${key}`, value);
                  cursor.continue();
                }
              };
            });
          };
        }
    });




