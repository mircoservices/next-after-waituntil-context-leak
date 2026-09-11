// Hits one route N times, forces GC on the server, and prints retained memory.
// Usage: node measure.mjs [leak|settled|detached] [requests] [port]

const route = process.argv[2] ?? 'leak';
const requests = Number(process.argv[3] ?? 300);
const port = Number(process.argv[4] ?? 3000);
const base = `http://127.0.0.1:${port}`;

const mib = n => (n / 1024 / 1024).toFixed(1).padStart(7);

async function heap() {
  const res = await fetch(`${base}/api/heap`);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body;
}

async function hit(n) {
  for (let i = 0; i < n; i++) {
    const res = await fetch(`${base}/api/${route}`);
    await res.arrayBuffer();
  }
}

const before = await heap();
await hit(requests);
const after = await heap();

console.log(`route /api/${route}, ${requests} requests, 1.0 MiB of request-scoped data each\n`);
console.log('                heapUsed   arrayBuffers        rss');
console.log(`before        ${mib(before.heapUsed)} MiB  ${mib(before.arrayBuffers)} MiB  ${mib(before.rss)} MiB`);
console.log(`after         ${mib(after.heapUsed)} MiB  ${mib(after.arrayBuffers)} MiB  ${mib(after.rss)} MiB`);
console.log(
  `retained      ${mib(after.heapUsed - before.heapUsed)} MiB  ` +
    `${mib(after.arrayBuffers - before.arrayBuffers)} MiB  ` +
    `${mib(after.rss - before.rss)} MiB`
);
console.log(`\nexpected if every request is retained: ~${(requests).toFixed(0)}.0 MiB of arrayBuffers`);
