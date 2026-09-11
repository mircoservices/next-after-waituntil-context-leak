// Which half of waitUntil retains the render?
//
//   this.promises.add(promise)          <- keeps the promise object
//   promise.then(cleanup, onError)      <- keeps the AsyncContext captured HERE
//
// Variant A reproduces the current implementation.
// Variant B keeps the Set entry but registers the reaction outside the caller's
// async context.
// Variant C keeps the reaction but not the Set entry.
//
// If B frees the payload and C does not, the minimal upstream fix is to
// register the cleanup reaction outside the caller's context.
//
// Run: node --expose-gc awaiter-which-retainer.cjs

const { AsyncLocalStorage } = require('node:async_hooks');

const RENDERS = 50;
const als = new AsyncLocalStorage();

async function gcSettle() {
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setImmediate(r));
    await new Promise(r => setTimeout(r, 10));
    globalThis.gc();
  }
}

// A minimal stand-in for AwaiterMulti, so the variants differ in exactly one
// line each. Shape copied from next/dist/server/after/awaiter.js.
function makeAwaiter(variant) {
  const promises = new Set();
  return {
    promises,
    waitUntil(promise) {
      const cleanup = () => promises.delete(promise);
      const register = () => promise.then(cleanup, cleanup);

      if (variant === 'A') {
        register();
        promises.add(promise);
      } else if (variant === 'B') {
        // Same reaction, registered with an empty async context.
        als.exit(register);
        promises.add(promise);
      } else if (variant === 'C') {
        register();
        // no Set entry
      }
    },
  };
}

function simulateRenders(refs, awaiter) {
  for (let i = 0; i < RENDERS; i++) {
    const payload = { i, bytes: Buffer.allocUnsafe(1 << 16) };
    refs.push(new WeakRef(payload));
    als.run({ payload }, () => {
      awaiter.waitUntil(new Promise(() => {}));
    });
  }
}

async function run(variant) {
  const awaiter = makeAwaiter(variant);
  const refs = [];
  simulateRenders(refs, awaiter);
  await gcSettle();
  return {
    variant,
    'Set entry': variant !== 'C',
    'reaction context': variant === 'B' ? 'empty' : "caller's",
    'Set size': awaiter.promises.size,
    'payloads alive': `${refs.filter(r => r.deref() !== undefined).length} / ${RENDERS}`,
  };
}

(async () => {
  console.log(`node ${process.version}`);
  console.table([await run('A'), await run('B'), await run('C')]);
})();
