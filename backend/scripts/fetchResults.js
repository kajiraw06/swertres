require('dotenv').config();
const { fetchAndSaveToday } = require('../services/pcsoScraper');

const dates = process.argv.slice(2);
if (dates.length === 0) dates.push(require('moment')().format('YYYY-MM-DD'));

(async () => {
  for (const date of dates) {
    console.log(`\nFetching results for ${date}...`);
    try {
      const results = await fetchAndSaveToday(date);
      if (results.length === 0) {
        console.log(`  No results found (draws may not have happened yet).`);
      } else {
        results.forEach(r => console.log(`  ✅ ${r.draw_time}: ${r.winning_numbers}`));
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
    }
  }
  process.exit(0);
})();
