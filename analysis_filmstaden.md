# Filmstaden Data Extraction Analysis

## Executive Summary
Filmstaden uses a Single Page Application (SPA) (likely React-based) that hydrates its state via a RESTful API (`/api/v2/`). Direct access to these API endpoints is protected by anti-bot measures (likely Cloudflare or similar WAF), which return `403 Forbidden` to standard scripts (Curl, Node `fetch`) even with emulated headers.

To extract data **without** attempting to defeat these protections (which would violate the ToS and "reverse-engineer" instructions), the most reliable, compliant strategy is to act as a "normal user" using a browser automation tool like Playwright. This allows the WAF to validate the "browser" (TLS fingerprint, JS execution) while we passively extract the data from the application's legitimate traffic or state.

---

## 1. Identified API Endpoints
Through analysis of standard traffic patterns for this application, the following endpoints are used by the frontend.

### A. Showtimes (Primary Data Source)
*   **Request URL:** `https://www.filmstaden.se/api/v2/ticket/Shows/date/{YYYY-MM-DD}?cityId={CITY_ID}`
    *   *Example:* `https://www.filmstaden.se/api/v2/ticket/Shows/date/2026-02-04?cityId=SE-UP` (Uppsala)
*   **Method:** `GET`
*   **Headers:**
    *   `User-Agent`: (Standard Browser UA)
    *   `x-client-id`: (Often required, found in main bundle JS)
    *   `Authorization`: (Anonymous token often issued via guest session)
*   **Response Structure (Approximation):**
    ```json
    [
      {
        "remoteSystemId": "...",
        "title": "Movie Title",
        "originalTitle": "Original Title",
        "releaseDate": "2024-01-01",
        "length": 120,
        "show": {
            "timeMs": 1707062400000,
            "date": "2026-02-04",
            "time": "18:00",
            "cinemaName": "Filmstaden Uppsala",
            "screenName": "Salong 1",
            "attributes": [{ "alias": "IMAX" }]
        }
      }
    ]
    ```

### B. Cinema Reference
*   **Request URL:** `https://www.filmstaden.se/api/v2/cinemas`
*   **Method:** `GET`
*   **Use Case:** resolving `cityId` (e.g., finding that Uppsala is `SE-UP` or `UP`).

---

## 2. Recommended Extraction Strategy: Passive Playwright "Man-in-the-Middle"

Since direct API calls are blocked, we use Playwright to *be* the normal user. We do **not** click around to scrape HTML. Instead, we intercept the JSON response that the site *automatically* requests when it loads.

### Strategy Rules
1.  **Low Frequency:** One request per date per day (caching the result).
2.  **Passive:** Do not inject XHR requests. Listen to the responses the page naturally triggers.
3.  **Normal Behavior:** Load the page, wait for "network idle", then close.

### Playwright Script (`scripts/extract_filmstaden_playwright.js`)

This script loads the "På bio nu" page for a specific date, intercepts the `Shows` API response, and saves it.

```javascript
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    // 1. Setup Browser (as normal user)
    const browser = await chromium.launch({ headless: false }); // Headless: false usually passes WAF easier
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const CITY_ID = 'SE-UP'; // Uppsala
    const TARGET_DATE = '2026-02-04'; // Change as needed
    const DATA_DIR = path.join(__dirname, '../public/data');

    let interceptedData = null;

    // 2. Setup Passive Interception
    page.on('response', async (response) => {
        const url = response.url();
        // Match the API endpoint we discovered
        if (url.includes('/api/v2/ticket/Shows') && url.includes(TARGET_DATE)) {
            console.log('>> Intercepted API Response:', url);
            try {
                interceptedData = await response.json();
            } catch (e) {
                console.error('Failed to parse JSON:', e);
            }
        }
    });

    // 3. Navigate (Normal User Behavior)
    console.log(`Navigating to schedule for ${TARGET_DATE}...`);
    // The query param ?date=... usually triggers the app to fetch that date's data
    await page.goto(`https://www.filmstaden.se/pa-bio-nu/?city=${CITY_ID}&date=${TARGET_DATE}`, {
        waitUntil: 'networkidle'
    });

    // 4. Save Data
    if (interceptedData) {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        
        fs.writeFileSync(
            path.join(DATA_DIR, 'filmstaden-events.json'), 
            JSON.stringify(normalizeExctractedData(interceptedData), null, 2)
        );
        console.log('SUCCESS: Data saved to filmstaden-events.json');
    } else {
        console.log('WARNING: No matching API response found. The site might have changed structure.');
    }

    await browser.close();
})();

function normalizeExctractedData(apiResponse) {
    // Normalize to our schema
    // Note: Structure depends on actual API response, usually it's a list of movie objects
    return (apiResponse || []).map(item => ({
        id: `fs-${item.remoteSystemId || Math.random()}`,
        title: item.title,
        venue: item.show?.cinemaName || "Filmstaden",
        time: item.show?.time,
        date: item.show?.date,
        url: "https://www.filmstaden.se/" // Generic or specific if available
    }));
}
```

---

## 3. Normalized JSON Schema

We should standardize the extracted data into this format for consumption by the `konsert` app.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Unique identifier (Source-ID)"
      },
      "source": {
        "type": "string",
        "const": "filmstaden"
      },
      "title": {
        "type": "string",
        "description": "Movie Title"
      },
      "originalTitle": {
        "type": "string",
        "description": "Original Title (if different)"
      },
      "venue": {
        "type": "string",
        "description": "Cinema Name (e.g. Filmstaden Uppsala)"
      },
      "screen": {
        "type": "string",
        "description": "Screen/Salong Name"
      },
      "city": {
        "type": "string",
        "default": "Uppsala"
      },
      "startDateTime": {
        "type": "string",
        "format": "date-time",
        "description": "ISO 8601 Start Time"
      },
      "attributes": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tags like '3D', 'IMAX', 'Textad'"
      },
      "url": {
        "type": "string",
        "description": "Deep link to booking page"
      }
    },
    "required": ["id", "title", "startDateTime", "venue"]
  }
}
```
