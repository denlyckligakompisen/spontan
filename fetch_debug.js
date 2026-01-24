
import fs from "fs";
import fetch from "node-fetch";

const url = "https://destinationuppsala.se/event-kategori/konsert/";

async function fetchPage() {
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });
    const text = await res.text();
    fs.writeFileSync("debug_uppsala.html", text);
    console.log("Saved debug_uppsala.html");
}

fetchPage();
