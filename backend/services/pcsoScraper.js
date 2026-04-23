/**
 * pcsoScraper.js
 *
 * Fetches today's 3D Lotto (Swertres) draw results from the official
 * PCSO website: https://www.pcso.gov.ph/searchlottoresult.aspx
 *
 * The page is ASP.NET WebForms, so we first GET the page to collect
 * the hidden __VIEWSTATE / __EVENTVALIDATION fields, then POST with
 * today's date to retrieve the results table.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');

const PCSO_URL = 'https://www.pcso.gov.ph/searchlottoresult.aspx';

// Map PCSO game name substrings → our draw_time values
const DRAW_TIME_MAP = {
  '2PM': '2PM',
  '5PM': '5PM',
  '9PM': '9PM',
};

/**
 * Fetch 3D Lotto results for a given date.
 * @param {string} dateStr - Format: 'M/D/YYYY' (e.g. '3/30/2026')
 * @returns {Promise<Array<{ draw_time, winning_numbers, jackpot, winners_count }>>}
 */
async function fetch3DResults(dateStr) {
  try {
    // Step 1: GET the page to collect ASP.NET hidden fields
    const getRes = await axios.get(PCSO_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 15000,
    });
    const $get = cheerio.load(getRes.data);

    const viewstate       = $get('#__VIEWSTATE').val() || '';
    const viewstateGen    = $get('#__VIEWSTATEGENERATOR').val() || '';
    const eventValidation = $get('#__EVENTVALIDATION').val() || '';

    // Step 2: POST with the date range and "3D Lotto" game selection
    const formData = new URLSearchParams({
      __VIEWSTATE:           viewstate,
      __VIEWSTATEGENERATOR:  viewstateGen,
      __EVENTVALIDATION:     eventValidation,
      __EVENTTARGET:         '',
      __EVENTARGUMENT:       '',
      ctl00$ctl00$cphContainer$cpRightSidebar$ddlStartMonth:  getMonthValue(dateStr),
      ctl00$ctl00$cphContainer$cpRightSidebar$ddlStartDate:   getDayValue(dateStr),
      ctl00$ctl00$cphContainer$cpRightSidebar$ddlStartYear:   getYearValue(dateStr),
      ctl00$ctl00$cphContainer$cpRightSidebar$ddlEndMonth:    getMonthValue(dateStr),
      ctl00$ctl00$cphContainer$cpRightSidebar$ddlEndDate:     getDayValue(dateStr),
      ctl00$ctl00$cphContainer$cpRightSidebar$ddlEndYear:     getYearValue(dateStr),
      ctl00$ctl00$cphContainer$cpRightSidebar$ddlSelectGame:  '3',  // 3 = 3D Lotto
      ctl00$ctl00$cphContainer$cpRightSidebar$btnSearch:      'Search+Lotto',
    });

    const postRes = await axios.post(PCSO_URL, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer':       PCSO_URL,
      },
      timeout: 15000,
    });

    return parseResults(postRes.data, dateStr);
  } catch (err) {
    console.error('[PCSO Scraper] Error fetching results:', err.message);
    return [];
  }
}

/**
 * Parse the HTML table returned by PCSO and extract 3D Lotto rows.
 */
function parseResults(html, expectedDateStr) {
  const $ = cheerio.load(html);
  const results = [];

  // The table has headers: LOTTO GAME | COMBINATIONS | DRAW DATE | JACKPOT | WINNERS
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 5) return;

    const game       = $(cells[0]).text().trim();
    const combo      = $(cells[1]).text().trim();
    const drawDate   = $(cells[2]).text().trim();
    const jackpot    = $(cells[3]).text().trim().replace(/,/g, '');
    const winners    = $(cells[4]).text().trim();

    // Only 3D Lotto rows
    if (!game.toLowerCase().includes('3d lotto')) return;

    // Filter by expected date (PCSO returns multiple days in response)
    // drawDate from table is like "03/29/2026" or "3/29/2026"
    const expectedMoment = moment(expectedDateStr, 'M/D/YYYY');
    const rowMoment = moment(drawDate.trim(), ['MM/DD/YYYY', 'M/D/YYYY']);
    if (!rowMoment.isValid() || !rowMoment.isSame(expectedMoment, 'day')) return;

    // Match draw time
    let drawTime = null;
    for (const key of Object.keys(DRAW_TIME_MAP)) {
      if (game.includes(key)) { drawTime = DRAW_TIME_MAP[key]; break; }
    }
    if (!drawTime) return;

    // Normalize combination: PCSO returns "6-2-8" already
    const normalized = combo.trim();

    results.push({
      draw_time:       drawTime,
      winning_numbers: normalized,
      jackpot:         parseFloat(jackpot) || 4500.00,
      winners_count:   parseInt(winners) || 0,
    });
  });

  return results;
}

/**
 * Helper: parse a table from a page that has rows like "2:00 PM | 8-3-4"
 */
function parseTimeComboTable($, sourceName) {
  const timeMap = { '2:00 PM': '2PM', '5:00 PM': '5PM', '9:00 PM': '9PM' };
  const results = [];
  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const timeText = $(cells[0]).text().trim();
    const combo    = $(cells[1]).text().trim();
    const drawTime = timeMap[timeText];
    if (!drawTime) return;
    if (!/^\d-\d-\d$/.test(combo)) return;
    results.push({ draw_time: drawTime, winning_numbers: combo, jackpot: 4500.00, winners_count: 0 });
  });
  console.log(`[PCSO Scraper] ${sourceName} found ${results.length} result(s).`);
  return results;
}

/**
 * Fallback: scrape lottopcso.com for today's 3D results.
 */
async function fetchFromLottoPCSO() {
  try {
    const res = await axios.get('https://www.lottopcso.com/swertres-result-today/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 15000,
    });
    return parseTimeComboTable(cheerio.load(res.data), 'lottopcso.com');
  } catch (err) {
    console.error('[PCSO Scraper] lottopcso.com error:', err.message);
    return [];
  }
}

/**
 * Fallback: scrape philnews.ph for today's 3D results.
 */
async function fetchFromPhilNews() {
  try {
    const res = await axios.get('https://philnews.ph/pcso-lotto-result/swertres-result/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 15000,
    });
    return parseTimeComboTable(cheerio.load(res.data), 'philnews.ph');
  } catch (err) {
    console.error('[PCSO Scraper] philnews.ph error:', err.message);
    return [];
  }
}

/**
 * Merge results from multiple sources, preferring the one with more draws.
 * Deduplicates by draw_time, keeping the first seen value.
 */
function mergeResults(a, b) {
  const merged = [...a];
  const seen = new Set(a.map(r => r.draw_time));
  for (const r of b) {
    if (!seen.has(r.draw_time)) { merged.push(r); seen.add(r.draw_time); }
  }
  return merged;
}

/**
 * Fetch today's results and save them to the database.
 * Called by the cron job after each draw time.
 */
async function fetchAndSaveToday(targetDate) {
  const supabase = require('../config/supabase');
  const m = targetDate ? moment(targetDate, 'YYYY-MM-DD') : moment();
  const today = m.format('M/D/YYYY');
  const todayDb = m.format('YYYY-MM-DD');
  const manilaToday = moment().utcOffset(8).format('YYYY-MM-DD');

  console.log(`[PCSO Scraper] Fetching results for ${today}...`);
  let results = await fetch3DResults(today);

  // When official PCSO site is missing draws, try fallbacks in parallel (today only)
  if (results.length < 3 && todayDb === manilaToday) {
    console.log(`[PCSO Scraper] Official site has ${results.length}/3 draws — trying fallbacks...`);
    const [lottoPcso, philNews] = await Promise.all([fetchFromLottoPCSO(), fetchFromPhilNews()]);
    const fallback = mergeResults(lottoPcso, philNews);
    results = mergeResults(results, fallback);
    console.log(`[PCSO Scraper] After fallbacks: ${results.length} draw(s) available.`);
  }

  // Never save a draw that hasn't happened yet (Manila time, UTC+8)
  if (todayDb === manilaToday) {
    const DRAW_CUTOFFS_MIN = { '2PM': 14 * 60, '5PM': 17 * 60, '9PM': 21 * 60 };
    const manilaM = moment().utcOffset(8);
    const nowMin = manilaM.hours() * 60 + manilaM.minutes();
    results = results.filter(r => {
      const cutoff = DRAW_CUTOFFS_MIN[r.draw_time];
      return cutoff !== undefined && nowMin >= cutoff;
    });
    console.log(`[PCSO Scraper] After time filter (Manila ${manilaM.format('HH:mm')}): ${results.length} draw(s) eligible.`);
  }

  for (const r of results) {
    try {
      const { error } = await supabase.from('draws').upsert(
        {
          draw_date:       todayDb,
          draw_time:       r.draw_time,
          winning_numbers: r.winning_numbers,
          jackpot:         r.jackpot,
          winners_count:   r.winners_count,
          fetched_at:      new Date().toISOString(),
        },
        { onConflict: 'draw_date,draw_time' }
      );
      if (error) throw error;
      console.log(`[PCSO Scraper] Saved ${r.draw_time}: ${r.winning_numbers}`);
    } catch (e) {
      console.error(`[PCSO Scraper] DB save error for ${r.draw_time}:`, e.message);
    }
  }

  return results;
}

// Helpers for date fields (PCSO dropdowns use numeric month/day/year)
function getMonthValue(dateStr) { return dateStr.split('/')[0]; }
function getDayValue(dateStr)   { return dateStr.split('/')[1]; }
function getYearValue(dateStr)  { return dateStr.split('/')[2]; }

module.exports = { fetch3DResults, fetchAndSaveToday };
