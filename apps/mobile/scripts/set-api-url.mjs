// Points the app at this computer's Wi-Fi address so a real phone (Expo Go) can reach the API.
// Usage: npm run lan            (auto-detects the address)
//        npm run lan -- 192.168.1.20   (use a specific address)
import { networkInterfaces } from 'node:os';
import { writeFileSync } from 'node:fs';

const port = process.env.API_PORT ?? '4000';
const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

function detect() {
  const found = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === 'IPv4' && !i.internal && isPrivate(i.address)) found.push({ name, ip: i.address });
    }
  }
  // Wi-Fi first (en0 on a Mac, wlan0/wl* on Linux), then anything else on a private network.
  found.sort((a, b) => Number(/^(en0|wlan|wl)/.test(b.name)) - Number(/^(en0|wlan|wl)/.test(a.name)));
  return found;
}

const given = process.argv[2];
const options = given ? [{ name: 'given', ip: given }] : detect();
if (options.length === 0) {
  console.error('Could not find a Wi-Fi address. Connect to Wi-Fi, or run: npm run lan -- 192.168.x.x');
  process.exit(1);
}
const { ip } = options[0];
const url = `http://${ip}:${port}`;
writeFileSync(new URL('../.env.local', import.meta.url), `# Written by npm run lan. Ignored by git. Delete this file to go back to .env.\nEXPO_PUBLIC_API_URL=${url}\n`);
console.log(`\nApp will use the API at ${url}`);
if (options.length > 1) console.log(`(Other addresses found: ${options.slice(1).map((o) => `${o.ip} on ${o.name}`).join(', ')}. If this one is wrong, run: npm run lan -- <address>)`);
console.log(`\nNext:\n  1. Make sure the API is running (it listens on every network address by default).\n  2. On your phone's browser open ${url}/v1/health  - you should see a response.\n  3. Restart Expo with a clean cache:  npx expo start -c\n`);
