async function listManifests(){
  console.log("TaskPane.js OnReady Called");
  const container = document.getElementById("results");

  try {
    const global = await Office.addin.getGlobal();
    const data = global.listManifestEntriesFromLocalStorage();

    if (!data.length) {
      container.innerHTML = "<p>No matching manifest entries found.</p>";
      return;
    }

    const table = document.createElement("table");
    table.innerHTML = `<thead>
      <tr><th>NN</th><th>GUID</th><th>Name</th><th>Description</th></tr>
    </thead><tbody></tbody>`;

    data.forEach(({ NN, GUID, Name, Description }) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${NN}</td><td>${GUID}</td><td>${Name}</td><td>${Description}</td>`;
      table.querySelector("tbody").appendChild(row);
    });

    container.appendChild(table);
  } catch (err) {
    container.innerHTML = `<p>Error accessing runtime: ${err.message}</p>`;
    console.error(err);
  }
}
Office.onReady(async () => await listManifests());

document.getElementById("getStartedButton").addEventListener("click", async () => {
  const container = document.getElementById("results");
  container.innerHTML = "<p>Loading...</p>";
  await listManifests();
}