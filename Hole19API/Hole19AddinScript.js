var Hole19_API_URL = "https://script.google.com/macros/s/AKfycbxJmX7hBOWpq7vQaCMHjBDUd6m9elR3oEOZt97tCFNyKv9hkFKITAl_8ktuExmOsot9Iw/exec"

Office.onReady((info) => {
        // Check that we loaded into Excel
        if (info.host === Office.HostType.Excel) {
            console.info("Excel Add-In Loaded", "onReady");
        }
    });



async function file_get_contents(url) {
    console.info(url);

    try {
        // Fetch the webpage content
        console.info("Fetching","file_get_contents");
        const response = await fetch(url);
        console.info("Fetched", "file_get_contents");
        if (response.ok)
        {
          console.info("Response OK", "file_get_contents");
          console.info("[" + response.status.toString() + "]", "file_get_contents");
          const text = await response.text();
          console.info(typeof text, "file_get_contents");
          console.info("[" + text.length.toString() + "]", "file_get_contents");
          console.info("Got Text", "file_get_contents");
          if ( text != null ) console.info("[" + String(text) + "]");
    
          return JSON.parse(text);
        }
        else {
          console.info ("Response Not OK", "file_get_contents");
          response.headers.forEach((value, name) => {
              console.info("[" + `${name}: ${value}` + "]");
          });
          const message = `An error has occured: ${response.status}`;
          console.info (message, "file_get_contents");
          throw new Error(message);
        }
    } catch (error) {
        console.error('Error downloading the webpage:', error, "file_get_contents");
        
    }
}

async function addNewRound(context) {
  debugger;
    var sheet = context.workbook.worksheets.getItem("Scores");
    var lastRound =  await getCellValue(context, "Scores", "Scores!D1");
    var source = String(`A${lastRound - 3}:AA${lastRound + 15}`);
    var destination = String(`A${lastRound + 16}`);
    const copyRange = sheet.getRange(source);
    const destinationRange = sheet.getRange(destination);
    destinationRange.copyFrom(copyRange);
    await context.sync();

    const dateCell = sheet.getRange(`A${lastRound + 16 + 3}`);
    datevalue = new Date();

    dateCell.values = [["=Date(" + datevalue.getFullYear() + "," + datevalue.getMonth() + "," + datevalue.getDate() + ")"]];
    await context.sync();

    var return_value = lastRound + 16 + 3;
    console.info ("New Round at ", return_value, "addNewRound");
    return (return_value);
}

async function add_new_round()
{
  console.info("Add New Round","testing");
  const context = new Excel.RequestContext();
  addNewRound(context);
}
function toExcelDateTime(isoString, utc = true) {
  var d = new Date(isoString);
  if (isNaN(d)) throw new Error("Invalid ISO string: " + isoString);

  // choose UTC vs. local getters
  var Y = utc ? d.getUTCFullYear()   : d.getFullYear();
  var M = utc ? d.getUTCMonth() + 1  : d.getMonth() + 1;
  var D = utc ? d.getUTCDate()       : d.getDate();
  var h = utc ? d.getUTCHours()      : d.getHours();
  var m = utc ? d.getUTCMinutes()    : d.getMinutes();
  var s = utc ? d.getUTCSeconds()    : d.getSeconds();

  // zero-pad helper
  function pad(n){ return n < 10 ? "0"+n : n; }

  return [
    Y, pad(M), pad(D)
  ].join("-")
   + " "
   + [ pad(h), pad(m), pad(s) ].join(":");
}



function loadNewData(context, data, newRoundRow)
{
  //debugger;
  setCellValue(context, "Scores", "Scores!B" + newRoundRow, data.data.course);
  setCellValue(context, "Scores", "Scores!A" + newRoundRow, toExcelDateTime(data.data.date));  
  columns = [ "D","E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U" ];
  var newRound = newRoundRow;
  for(inputIndex=0; inputIndex < 18; inputIndex++)
  {
    setCellValue(context, "Scores", "Scores!" + columns[inputIndex] + newRound, data.data.pars[inputIndex]);

    setCellValue(context, "Scores", "Scores!" + columns[inputIndex] + Number(newRound+1), data.data.score[inputIndex]);
    setCellValue(context, "Scores", "Scores!" + columns[inputIndex] + Number(newRound+4), data.data.index[inputIndex]);
    setCellValue(context, "Scores", "Scores!" + columns[inputIndex] + Number(newRound+11), data.data.sandshots[inputIndex]);
    console.info("Scores!" + columns[inputIndex] + Number(newRound+11), data.data.sandshots[inputIndex], "loadNewData" );
    setCellValue(context, "Scores", "Scores!" + columns[inputIndex] + Number(newRound+13), data.data.putts[inputIndex]);
    setCellValue(context, "Scores", "Scores!" + columns[inputIndex] + Number(newRound+9), data.data.penalties[inputIndex]);
    setCellValue(context, "Scores", "Scores!" + columns[inputIndex] + Number(newRound+12), data.data.fairways[inputIndex]);
  }
  context.sync();
}

async function getLastDate(context)
{
  var LastRow =   await getCellValue(context, "Scores", "Scores!D1");
  var tdate;
  var LastDate =  await getCellValue(context, "Scores", "Scores!A"+LastRow);
  tdate =  ConvertExcelDatetoJavascriptDate(LastDate);
  odate = new Date(String(tdate))
  console.info(odate.toDateString(),"getLastDate");
  return tdate;
}

async function get_hole19_data(url)
{
  //debugger;
  console.info("Entering","get_hole19_data");
  //var url=tag("url").value;
  console.info(url,"get_hole19_data");
  let dom2 = await file_get_contents(Hole19_API_URL + "?url=" + url);
  console.info(dom2.data.course, "get_hole19_data");
  const context = new Excel.RequestContext();

  console.info(dom2.data.date, Date(new String(dom2.data.date)),"get_hole19_data");
  var lDateString =  await getLastDate(context);
  var lDate = new Date(lDateString);
  var jsonDateString = new String(dom2.data.date);
  var jsonDate = new Date(jsonDateString);
  console.info( jsonDate, lDate, "get_hole19_data");
  if (false && jsonDate < lDate)
  {
    console.info("Cannot add a new round that's older than last round","get_hole19_data");
  }
  else 
  {
    console.info("Adding Data","get_hole19_data");

    var newRound = await addNewRound(context);
    loadNewData(context, dom2, newRound);
    await updateHandicapHistoryData(context);
  }
}

async function updateHandicapHistoryData(context)
{
  //debugger;
  await context.sync();
  var sheet = context.workbook.worksheets.getItem("Handicap History Data");
  var lastRound = await getCellValue(context, "Handicap History Data", "L1");
  var source = String(`A${lastRound}:R${lastRound}`);
  var destination = String(`A${lastRound + 1}`);
  const copyRange = sheet.getRange(source);
  const destinationRange = sheet.getRange(destination);
  destinationRange.copyFrom(copyRange);
  await context.sync();  
}

async function register_handler(excel){
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    sheet.onSingleClicked.add((event) => {
        return Excel.run((context) => {
            console.info(`Click detected at ${event.address} (pixel offset from upper-left cell corner: ${event.offsetX}, ${event.offsetY})`);
            if (event.address == "C1") {
              console.info("Add New Round", "register_handler");
              add_new_round();
            }
            else if (event.address == "AA1") {
              console.info("Process Hole 19","register_handler");
              process_hole_19();
            }
            return context.sync();
        });
    });
    console.log("The worksheet click handler is registered.","register_handler");
    await context.sync();
});
}

function setCellValue(excel, sheetName, address, value){
    console.info("Getting Worksheet", "setCellValue");
    
    let sheet = excel.workbook.worksheets.getItem(sheetName);
    
    sheet.getRange(address).values = new String(value);
    excel.sync();
    return true;
}

async function getCellValue(excel, sheetName, address){
    console.info("Getting Worksheet", "getCellValue");
    let sheet = await excel.workbook.worksheets.getItem(sheetName);
    sheet.load("name");
    await excel.sync();
    
    let cell = await sheet.getRange(address);
    cell.load("address, values");
    console.info("syncing", "getCellValue");
    await excel.sync();
    console.info(`The value of the cell in row 2, column 5 is "${cell.values[0][0]}" and the address of that cell is "${cell.address}"`);
    
    return(cell.values[0][0]);
}
  
function auto_exec(){
  Hole19UI();
}

function ConvertExcelDatetoJavascriptDate(ExcelDateValue)
{
  return (ExcelDateValue - 25569) * 86400 * 1000;
}

function testDate()
{
//  debugger;
  var t = new Date(ConvertExcelDatetoJavascriptDate(45486));

  console.info(t.toDateString());
}

function testDateConversion()
{
//2022-05-28 

t = new Date("2022-05-28")

alert(t.toDateString());

}

async function displayHole19ProcessingUI()
{
  const pane1 = document.getElementById("pane1");
  const pane2 = document.getElementById("pane2");
  const pane3 = document.getElementById("pane3");
  const inputField = document.getElementById("inputField");
  const resultMessage = document.getElementById("resultMessage");

      pane1.style.display = "none";
      pane2.style.display = "block";

}

async function resetHandler()
{
  const pane1 = document.getElementById("pane1");
  const pane2 = document.getElementById("pane2");
  const pane3 = document.getElementById("pane3");
  const inputField = document.getElementById("inputField");
  const resultMessage = document.getElementById("resultMessage");

  pane3.style.display = "none";
  pane1.style.display = "block";
}

async function processHole19EventHandler()
{
  const pane1 = document.getElementById("pane1");
  const pane2 = document.getElementById("pane2");
  const pane3 = document.getElementById("pane3");
  const inputField = document.getElementById("inputField");
  const resultMessage = document.getElementById("resultMessage"); 
  console.info("In processHole19EventHandler");

  // Get the value from the input field                             
  if (!inputField.value.trim()) {
    resultMessage.textContent = "Failure! No input value provided.";
  } else {
    try
    {
      await get_hole19_data(inputField.value.trim());
        resultMessage.textContent = `Success! The URL ${inputField.value}. has been processed`;
    } catch (error) {
      resultMessage.textContent = "Failure! Unable to process the input value " + inputField.value + ".";
    }
  }
  pane2.style.display = "none";
  pane3.style.display = "block";
}

async function TestNewFunctionality()
{
console.info("Test New Functionality");
const url = "https://www.hole19.com";

try {
    console.info("Fetching the home page...");
    const response = await fetch(url, {
        method: "GET",
    });

    if (response.ok) {
        const text = await response.text(); // Get the response as plain text
        console.info("Home page downloaded successfully.");
        console.info("Page content:", text);
        return text; // Return the page content
    } else {
        console.error(`Failed to fetch the home page. Status: ${response.status}`);
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
} catch (error) {
    console.error("Error fetching the home page:", error);
    throw error;
}
console.info(lastRound, "TestNewFunctionality");
}




document.getElementById("addNewRound").addEventListener("click", add_new_round);
document.getElementById("processHold19").addEventListener("click", displayHole19ProcessingUI);
document.getElementById("TestNewFunctionality").addEventListener("click", TestNewFunctionality );
document.getElementById("goButton").addEventListener("click", processHole19EventHandler);
document.getElementById("okButton").addEventListener("click", resetHandler);
document.getElementById("TestNewFunctionality").style.display = "none";
