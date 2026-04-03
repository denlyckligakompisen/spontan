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
    const timeRegex = /(?:kl\.?|kl|kl:|kl\.)?\s*(\d{1,2})[:.](\d{2})/gi;
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
        timeMinutes = parseInt(startMatch[2], 10);

        if (timeMatches.length > startMatchIdx + 1) {
            const endMatch = timeMatches[startMatchIdx + 1];
            const startPos = startMatch.index + startMatch[0].length;
            const endPos = endMatch.index;
            const separatorText = cleanStr.substring(startPos, endPos);

            if (separatorText.match(/[-–—]/)) {
                endDateRange = { h: parseInt(endMatch[1], 10), m: parseInt(endMatch[2], 10) };
            }
        }
    }

    const parts = cleanStr.split(/\s+/);
    let dates = [];
    
    // Check for "day-day month" format (e.g., "3-6 april")
    const rangeMatch = cleanStr.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)/i);
    if (rangeMatch) {
        const d1 = parseInt(rangeMatch[1], 10);
        const d2 = parseInt(rangeMatch[2], 10);
        const m = months[rangeMatch[3].toLowerCase()];
        if (!isNaN(d1) && !isNaN(d2) && m !== undefined) {
            dates.push({ day: d1, month: m });
            dates.push({ day: d2, month: m });
        }
    }

    // Fallback: look for all "day month" pairs
    if (dates.length === 0) {
        for (let i = 0; i < parts.length - 1; i++) {
            const d = parseInt(parts[i], 10);
            const m = months[parts[i + 1]];
            if (!isNaN(d) && m !== undefined) {
                dates.push({ day: d, month: m });
            }
        }
    }

    if (dates.length === 0) return null;

    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

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

    const startDate = getFinalDate(firstDate.day, firstDate.month);
    startDate.setHours(timeHours, timeMinutes, 0, 0);

    let endDate = null;
    if (dates.length > 1 || endDateRange) {
        endDate = getFinalDate(lastDate.day, lastDate.month);
        if (endDateRange) {
            endDate.setHours(endDateRange.h, endDateRange.m, 0, 0);
        } else {
            endDate.setHours(23, 59, 59, 999);
        }
        
        if (endDate < startDate) {
            // Handle ranges spanning over midnight if it's the same day, 
            // or just ensure endDate is after startDate
            if (dates.length === 1) endDate.setDate(endDate.getDate() + 1);
            else endDate.setFullYear(endDate.getFullYear() + 1);
        }
    }

    return { startDate, endDate };
};
