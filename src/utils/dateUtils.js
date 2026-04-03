/**
 * Formats an ISO date string or Date object to HH:MM format.
 * Returns empty string for 00:00 (assumed to be a date-only timestamp).
 */
export const formatTime = (dateInput) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const time = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    return time === '00:00' ? '' : time;
};

/**
 * Checks if an event is currently "live" (ongoing or starting within 30 mins).
 */
export const isLive = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return false;

    if (endDate) {
        const end = new Date(endDate);
        if (now >= start && now <= end) return true;
    }

    const diffMs = start - now;
    const diffMins = diffMs / (1000 * 60);
    return diffMins > 0 && diffMins < 30;
};

/**
 * Calculates start and end Date objects for the upcoming weekend.
 * Logic: Starts Friday 17:00, Ends Sunday 23:59.
 */
export const getWeekendRange = () => {
    const d = new Date();
    const day = d.getDay();
    let daysUntilFriday = (5 - day + 7) % 7;
    if (day === 5 && d.getHours() >= 17) daysUntilFriday = 7;
    if (day === 6 || day === 0) daysUntilFriday = (5 - day + 7) % 7;

    const start = new Date(d);
    start.setDate(d.getDate() + daysUntilFriday);
    start.setHours(17, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 2);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

/**
 * Parses Swedish date strings (e.g., "12 februari 19:00") into Date objects.
 */
export const parseSwedishDate = (dateStr) => {
    if (!dateStr) return null;

    const months = {
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };

    const cleanStr = dateStr.toLowerCase().trim();
    let timeHours = 0;
    let timeMinutes = 0;
    // Updated regex: minutes are now optional (e.g. 12 or 12:00)
    const timeRegex = /(?:kl\.?|kl|kl:|kl\.)?\s*(\d{1,2})(?:[:.](\d{2}))?/gi;
    const timeMatches = Array.from(cleanStr.matchAll(timeRegex));
    let endDateRange = null;

    if (timeMatches.length > 0) {
        let startMatchIdx = -1;
        for (let i = 0; i < timeMatches.length; i++) {
            if (timeMatches[i][0].toLowerCase().includes('kl')) {
                startMatchIdx = i;
                break;
            }
        }
        if (startMatchIdx === -1) startMatchIdx = 0;

        const startMatch = timeMatches[startMatchIdx];
        timeHours = parseInt(startMatch[1], 10);
        timeMinutes = startMatch[2] ? parseInt(startMatch[2], 10) : 0;

        if (timeMatches.length > startMatchIdx + 1) {
            const endMatch = timeMatches[startMatchIdx + 1];
            const startPos = startMatch.index + startMatch[0].length;
            const endPos = endMatch.index;
            const separatorText = cleanStr.substring(startPos, endPos);

            if (separatorText.match(/[-–—]/)) {
                endDateRange = { 
                    h: parseInt(endMatch[1], 10), 
                    m: endMatch[2] ? parseInt(endMatch[2], 10) : 0 
                };
            }
        }
    }

    const dateParts = [];
    const parts = cleanStr.split(/\s+/);
    // Filter out ratios/years
    const filteredParts = parts.filter(p => !(/^\d{4}$/.test(p) || /^0[.,]\d+$/.test(p) || p === '1.33'));
    
    // Look for day-month pairs
    let tempStr = cleanStr;
    const dates = [];
    
    // Day-day month range (e.g. 3-6 apr)
    const rangeMatch = cleanStr.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)/i);
    if (rangeMatch) {
        const d1 = parseInt(rangeMatch[1], 10);
        const d2 = parseInt(rangeMatch[2], 10);
        const m = months[rangeMatch[3].toLowerCase()];
        if (!isNaN(d1) && !isNaN(d2) && m !== undefined) {
            dates.push({ day: d1, month: m });
            dates.push({ day: d2, month: m });
            // Remove the match from tempStr to avoid re-parsing days as times
            tempStr = tempStr.replace(rangeMatch[0], ' ');
        }
    }
    
    // Fallback: Day-month pairs
    if (dates.length === 0) {
        for (let i = 0; i < filteredParts.length - 1; i++) {
            const d = parseInt(filteredParts[i], 10);
            const m = months[filteredParts[i + 1].toLowerCase()];
            if (!isNaN(d) && d > 0 && d <= 31 && m !== undefined) {
                dates.push({ day: d, month: m });
                tempStr = tempStr.replace(new RegExp(filteredParts[i] + '\\s+' + filteredParts[i+1], 'i'), ' ');
            }
        }
    }
    
    if (dates.length === 0) return null;

    // 2. Identify times in the REMAINING string
    let startTime = { h: 18, m: 0 }; // default
    let endTimeRange = null;

    // Look for kl. XX:XX or kl XX
    const klMatch = tempStr.match(/kl\.?\s*(\d{1,2})[:.]?(\d{2})?/i);
    if (klMatch) {
        startTime.h = parseInt(klMatch[1], 10);
        startTime.m = klMatch[2] ? parseInt(klMatch[2], 10) : 0;
    }

    // Look for time range XX-YY or XX:XX-YY:YY
    const timeRangeMatch = tempStr.match(/(\d{1,2})[:.]?(\d{2})?\s*[-–]\s*(\d{1,2})[:.]?(\d{2})?/i);
    if (timeRangeMatch) {
        // If it's a range like "12 – 17" or "12:00 – 17:00"
        const h1 = parseInt(timeRangeMatch[1], 10);
        const m1 = timeRangeMatch[2] ? parseInt(timeRangeMatch[2], 10) : 0;
        const h2 = parseInt(timeRangeMatch[3], 10);
        const m2 = timeRangeMatch[4] ? parseInt(timeRangeMatch[4], 10) : 0;
        
        // Validation: Times should be 0-23
        if (h1 < 24 && h2 < 24) {
            startTime = { h: h1, m: m1 };
            endTimeRange = { h: h2, m: m2 };
        }
    } else if (!klMatch) {
        // Simple XX:XX or XX.XX
        const simpleTimeMatch = tempStr.match(/(\d{1,2})[:.](\d{2})/);
        if (simpleTimeMatch) {
            startTime.h = parseInt(simpleTimeMatch[1], 10);
            startTime.m = parseInt(simpleTimeMatch[2], 10);
        }
    }

    // 3. Assemble Date objects
    const now = new Date();
    let year = now.getFullYear();
    const getFinalDate = (d, m) => {
        const dateThisYear = new Date(year, m, d);
        let finalYear = year;
        if (dateThisYear < new Date(now.getFullYear(), now.getMonth() - 1, 1)) {
            finalYear++;
        }
        return new Date(finalYear, m, d);
    };

    const firstDateObj = dates[0];
    const lastDateObj = dates[dates.length - 1];
    
    const start = getFinalDate(firstDateObj.day, firstDateObj.month);
    start.setHours(startTime.h, startTime.m, 0, 0);

    let end = null;
    if (dates.length > 1 || endTimeRange) {
        end = getFinalDate(lastDateObj.day, lastDateObj.month);
        if (endTimeRange) {
            end.setHours(endTimeRange.h, endTimeRange.m, 0, 0);
        } else {
            end.setHours(23, 59, 59, 999);
        }
    }

    return { startDate: start, endDate: end };
};
