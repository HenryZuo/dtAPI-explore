import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const API_KEY = process.env.DATATHISTLE_API_KEY?.trim();

console.log('🚀 Data Thistle API Explorer starting...');

if (!API_KEY) {
  console.error('❌ ERROR: DATATHISTLE_API_KEY is missing or empty!');
  console.error('   Please add your JWT token to .env');
  process.exit(1);
}

if (API_KEY.length < 50) {
  console.error('⚠️  WARNING: Your API key looks too short. It should be a long JWT (starts with eyJ...)');
}

/*
// ------------------------------------------------------------------
// 1. First – test authentication with /ping (this is the fastest way)
// ------------------------------------------------------------------

async function testPing() {
  console.log('\n1. Testing authentication with /ping endpoint...');
  try {
    const resp = await axios.get('https://api.datathistle.com/v1/ping', {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 10000,
    });
    console.log('✅ /ping SUCCESS → You are authenticated!');
    return true;
  } catch (err: any) {
    console.log('❌ /ping FAILED');
    if (err.response) {
      console.error(`   Status: ${err.response.status}`);
      console.error(`   Body:`, err.response.data);
    } else {
      console.error('   ', err.message);
    }
    console.error('\n   Most likely causes:');
    console.error('   • Wrong or expired API key');
    console.error('   • You are not logged in / key revoked');
    console.error('   • Network/firewall blocking the request');
    process.exit(1);
  }
}
*/

// ------------------------------------------------------------------
// 2. Then fetch real events
// ------------------------------------------------------------------
const MINUTES_AHEAD = 5;

function formatIsoTimestamp(date: Date) {
  const iso = date.toISOString();
  return iso.slice(0, 19) + 'Z'; // drop milliseconds for compatibility
}

function buildQueryParams() {
  const params = new URLSearchParams({
    limit: '20',
    page: '1',
    status: 'live',
    town: 'London',
    tags: 'kids',
    min_date: formatIsoTimestamp(new Date(Date.UTC(2026, 5, 1, 0, 0, 0))),
    max_date: formatIsoTimestamp(new Date(Date.UTC(2026, 11, 1, 0, 0, 0)))
  });

  return params;
}

async function fetchEvents() {
  console.log('\n2. Fetching real events...');
  const params = buildQueryParams();
  const url = `https://api.datathistle.com/v1/events?${params.toString()}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    console.log(`✅ SUCCESS! Received ${response.data.length} events`);
    console.log('\n📋 First event (pretty printed):\n');
    console.log(JSON.stringify(response.data[0], null, 2));

    // Save full response
    const outPath = path.join(process.cwd(), 'datathistle-full-response.json');
    fs.writeFileSync(outPath, JSON.stringify(response.data, null, 2));
    console.log(`\n💾 Full response saved to: ${outPath}`);

  } catch (err: any) {
    console.error('\n❌ Failed to fetch events');
    if (err.response) {
      console.error(`Status: ${err.response.status} ${err.response.statusText}`);
      console.error('Response body:', JSON.stringify(err.response.data, null, 2));
    } else if (err.code === 'ENETUNREACH' || err.code === 'ECONNREFUSED') {
      console.error('Network error – check your internet connection or firewall');
    } else {
      console.error(err.message);
    }
  }
}

// ------------------------------------------------------------------
// Run everything
// ------------------------------------------------------------------
(async () => {
  // await testPing();
  await fetchEvents();
})();
