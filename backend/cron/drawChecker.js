/**
 * drawChecker.js
 *
 * Cron jobs that:
 *  1. Fetch PCSO results shortly after each draw time (2PM, 5PM, 9PM)
 *  2. Run the winner-detection service for each draw
 *
 * Draw schedule (Philippine time):
 *   2PM draw  → check at 2:05 PM
 *   5PM draw  → check at 5:05 PM
 *   9PM draw  → check at 9:05 PM
 *
 * Uses node-cron: https://www.npmjs.com/package/node-cron
 * Cron format: second(opt) minute hour day month weekday
 */

const cron = require('node-cron');
const moment = require('moment');
const { fetchAndSaveToday } = require('../services/pcsoScraper');
const { processWinners } = require('../services/winnerService');

async function checkDrawResult(drawTime) {
  console.log(`[Cron] Checking ${drawTime} draw results at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  try {
    await fetchAndSaveToday();
    const today = moment().format('YYYY-MM-DD');
    await processWinners(today, drawTime);
  } catch (err) {
    console.error(`[Cron] Error in ${drawTime} check:`, err.message);
  }
}

function startCronJobs() {
  // All times in UTC (Fly.io runs UTC). Manila = UTC+8.
  // 2PM Manila = 06:05 UTC
  cron.schedule('0 5 6 * * *', () => checkDrawResult('2PM'));

  // 5PM Manila = 09:05 UTC
  cron.schedule('0 5 9 * * *', () => checkDrawResult('5PM'));

  // 9PM Manila = 13:05 UTC
  cron.schedule('0 5 13 * * *', () => checkDrawResult('9PM'));

  // Retry at +10, +30, +60 minutes to handle PCSO posting delays
  cron.schedule('0 15 6 * * *',  () => checkDrawResult('2PM'));
  cron.schedule('0 35 6 * * *',  () => checkDrawResult('2PM'));
  cron.schedule('0 5 7 * * *',   () => checkDrawResult('2PM'));

  cron.schedule('0 15 9 * * *',  () => checkDrawResult('5PM'));
  cron.schedule('0 35 9 * * *',  () => checkDrawResult('5PM'));
  cron.schedule('0 5 10 * * *',  () => checkDrawResult('5PM'));

  cron.schedule('0 15 13 * * *', () => checkDrawResult('9PM'));
  cron.schedule('0 35 13 * * *', () => checkDrawResult('9PM'));
  cron.schedule('0 5 14 * * *',  () => checkDrawResult('9PM'));

  console.log('[Cron] Draw checker cron jobs started (UTC schedule for Asia/Manila times).');
}

module.exports = { startCronJobs };
