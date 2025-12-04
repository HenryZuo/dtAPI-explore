// pull-all-kids-london.ts
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.DATATHISTLE_API_KEY?.trim();
if (!API_KEY) {
  console.error('DATATHISTLE_API_KEY is missing in .env');
  process.exit(1);
}

const BASE_URL = 'https://api.datathistle.com/v1/events';
const OUT_FILE = path.join(process.cwd(), 'datathistle-kids-london-full.json');


function formatIsoTimestamp(date: Date) {
  const iso = date.toISOString();
  return iso.slice(0, 19) + 'Z'; // drop milliseconds for compatibility
}

const now = new Date();

const CORE_PARAMS = {
  limit: '20',
  status: 'live',
  town: 'London',
  tags: 'kids', // exact tag match
  min_date: formatIsoTimestamp(now),
  max_date: formatIsoTimestamp(new Date(now.setMonth(now.getMonth() + 12)))
} as const;

async function fetchAllKidsEvents() {
  let page = 1;
  let allEvents: any[] = [];
  let totalRequests = 0;

  console.log('Starting full safe pull of London + kids events (60-second delay between requests)…\n');

  while (true) {
    const params = new URLSearchParams({
      ...CORE_PARAMS,
      page: page.toString(),
    });

    const url = `${BASE_URL}?${params.toString()}`;
    console.log(`Request #${totalRequests + 1} → page ${page} (${url})`);

    try {
      const start = Date.now();
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: 'application/json',
        },
        timeout: 30_000,
      });

      const pageEvents = res.data;

      if (!pageEvents || pageEvents.length === 0) {
        console.log('Empty page received → reached the end of results.\n');
        break;
      }

      allEvents.push(...pageEvents);
      console.log(`   ${pageEvents.length} events (total so far: ${allEvents.length})`);
      console.log(`   Rate-limit remaining: ${res.headers['x-ratelimit-remaining'] ?? 'unknown'}\n`);

      totalRequests++;
      page++;

      // 60-second polite pause (except after the very last page)
      if (pageEvents.length === 20) {
        console.log('Waiting 60 seconds before next request…\n');
        await new Promise(resolve => setTimeout(resolve, 60_000));
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        console.error('Rate limited (429). Stopping early.');
        break;
      } else if (err.response?.status === 401) {
        console.error('Unauthorized – check your API key.');
      } else {
        console.error('Request failed:', err.message);
      }
      break;
    }
  }

  console.log(`Finished!`);
  console.log(`Total requests made: ${totalRequests}`);
  console.log(`Total events collected: ${allEvents.length}`);

  return allEvents;
}

// Run the whole thing
(async () => {
  try {
    const events = await fetchAllKidsEvents();

    fs.writeFileSync(OUT_FILE, JSON.stringify(events, null, 2));
    console.log(`\nAll data saved to → ${OUT_FILE}`);

    const unique = new Set(events.map((e: any) => e.event_id)).size;
    console.log(`Unique event IDs: ${unique}`);
  } catch (e) {
    console.error('Pull failed:', e);
    process.exit(1);
  }
})();