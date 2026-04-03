
import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const BASE_URL = "https://www.uppsalastadsteater.se/kalender/";

const MONTHS = {
    'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
    'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11
};

async function fetchPage() {
    console.log(`Fetching ${BASE_URL}...`);
    try {
        const res = await fetch(BASE_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (err) {
        console.error("Fetch failed:", err);
        return null;
    }
}

async function run() {
    const html = await fetchPage();
    if (!html) return;

    const dom = new JSDOM(html);
    const document = dom.window.document;
    const events = [];

    const dateSections = document.querySelectorAll(".calendar_date_section");
    const now = new Date();
    const currentYear = now.getFullYear();

    console.log(`Found ${dateSections.length} date sections.`);

    dateSections.forEach(section => {
        // Parse date
        const dayEl = section.querySelector(".calendar_date_section_day");
        const monthEl = section.querySelector(".calendar_date_section_month");
        if (!dayEl || !monthEl) return;

        const day = parseInt(dayEl.textContent.trim(), 10);
        const monthName = monthEl.textContent.trim().toLowerCase();
        const month = MONTHS[monthName];

        if (isNaN(day) || month === undefined) {
            console.warn("Could not parse date:", dayEl.textContent, monthEl.textContent);
            return;
        }

        // Year logic: if date is in Jan/Feb and we are in Dec, it's next year.
        // If date is Dec and we are in Jan, it's last year (unlikely for "upcoming" cal).
        // Standard logic: assume current year, if date < now - 30 days, maybe next year?
        // Actually, just assume current year unless month < currentMonth (then next year).
        let year = currentYear;
        if (month < now.getMonth() && (now.getMonth() > 8)) {
            // If current is Oct/Nov/Dec and event is Jan/Feb -> Next year
            year++;
        }

        // Iterate events for this date
        const items = section.querySelectorAll(".calendar_date_item");
        items.forEach(item => {
            const link = item.href;
            const titleEl = item.querySelector(".date_item_title");
            const stageEl = item.querySelector(".date_item_stage");
            const timeEl = item.querySelector(".date_item_time");

            const title = titleEl ? titleEl.textContent.trim() : "Okänd titel";
            const venue = stageEl ? `Uppsala Stadsteater (${stageEl.textContent.trim()})` : "Uppsala Stadsteater";

            const imageEl = item.querySelector("img");
            const imageUrl = imageEl ? (imageEl.getAttribute("data-src") || imageEl.getAttribute("src")) : null;
            const fullImageUrl = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://www.uppsalastadsteater.se${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`) : null;

            // Time parsing: "18:00 \n 2 timmar..."
            let timeStr = "00:00";
            if (timeEl) {
                const rawTime = timeEl.textContent.trim(); // "18:00..."
                const match = rawTime.match(/(\d{1,2}[:.]\d{2})/);
                if (match) {
                    timeStr = match[1].replace('.', ':');
                }
            }

            // Construct ISO date
            const dateObj = new Date(year, month, day);
            const [h, m] = timeStr.split(':').map(Number);
            dateObj.setHours(h, m, 0, 0);

            // Timezone adjustment? 
            // We usually store as ISO. The display logic formats it.
            // If we use 'sv-SE' locale it assumes local time?
            // Let's store local ISO string: "YYYY-MM-DDTHH:mm:ss"

            // Correct ISO for Sweden (Winter UTC+1, Summer UTC+2)
            // But simpler is to just store the string and parse it as local in frontend.
            // Or better: Use the pattern we have in api.js:
            // "2026-01-24T16:00:00" (implicitly local or UTC?)
            // api.js uses : startDate: `${date}T00:00:00` or `event.dates.start.dateTime` (ISO with Z or offset).

            // I'll format as local ISO-like string: "YYYY-MM-DDTHH:mm:ss"
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

            events.push({
                title,
                venue,
                date: iso, // Use this directly
                url: link,
                image: fullImageUrl,
                source: "uppsalastadsteater.se",
                fetched_at: new Date().toISOString()
            });
        });
    });

    // Save
    fs.mkdirSync("public/data", { recursive: true });
    fs.writeFileSync(
        "public/data/uppsala-stadsteater-events.json",
        JSON.stringify(events, null, 2)
    );
    console.log(`Saved ${events.length} events from Uppsala Stadsteater.`);
}

run();
