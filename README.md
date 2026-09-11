# `after()` retains the request's async context when the task never settles

A promise passed to `after()` that never settles is held by the server's
process-lifetime awaiter, and the bookkeeping `.then()` registered inside
`waitUntil` captures the async context that was current at the call site. The
request's context, and everything reachable from it, is retained for the life of
the process.

Each request here puts 1 MiB in request-scoped async context, so the retention is
measurable. In a real App Router render the retained context holds Next's own
request and work-unit store, which references the RSC flight payload.

## Steps

```bash
npm install
npm run build
npm start          # sets NODE_OPTIONS=--expose-gc so GC can be forced
```

Then, in a second shell:

```bash
node measure.mjs settled 300     # control: after() with an already-settled promise
node measure.mjs detached 300    # control: never-settling promise, never given to after()
node measure.mjs leak 300        # after() with a never-settling promise
```

`measure.mjs` hits the route 300 times and asks `/api/heap` to run `global.gc()`
three times before and after, so what it prints is retained memory rather than
garbage that has not been collected yet.

## Observed on `next@16.4.0-canary.26`, Node 24.21.0

| route            | what it does                                            | arrayBuffers retained |
| ---------------- | ------------------------------------------------------- | --------------------- |
| `/api/settled`   | `after(Promise.resolve())`                              | 0.0 MiB               |
| `/api/detached`  | never-settling promise created, `after()` not called    | 0.0 MiB               |
| `/api/leak`      | `after(new Promise(() => {}))`                          | **300.0 MiB**         |

Exactly 1 MiB per request, and it accumulates linearly: a second batch of 300
takes it from 300.1 MiB to 600.1 MiB. It is never released, through any number of
forced collections, for as long as the server runs.

The two controls are there to rule out the obvious alternatives. `settled` shows
it is not `after()` itself, and `detached` shows it is not the unsettled promise on
its own.

## Routes

| file                          | purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `app/api/leak/route.ts`       | the case under test                                   |
| `app/api/settled/route.ts`    | control 1                                             |
| `app/api/detached/route.ts`   | control 2                                             |
| `app/api/heap/route.ts`       | forces GC, reports `process.memoryUsage()`            |
| `app/api/semantics/route.ts`  | checks `after()` still runs tasks and sees context    |
| `app/api/reject/route.ts`     | checks a rejecting task is still reported             |
| `app/request-payload.ts`      | the request-scoped payload, via `AsyncLocalStorage`   |

`semantics` and `reject` are not part of the bug; they exist so a fix can be
checked for behaviour changes. Hit `/api/semantics` then `/api/semantics-log`:
both the function task and the promise task must appear, with `host=` set and
`als=visible`.

## Why the promise is never dropped

`AwaiterMulti.waitUntil` drops a promise when it settles, which the code comment
describes. Nothing drops one that does not settle:

```ts
// packages/next/src/server/after/awaiter.ts
public waitUntil = (promise: Promise<unknown>): void => {
  // if a promise settles before we await it, we should drop it --
  // storing them indefinitely could result in a memory leak.
  const cleanup = () => {
    this.promises.delete(promise)
  }

  promise.then(cleanup, (err) => {
    cleanup()
    this.onError(err)
  })

  this.promises.add(promise)
}
```

The awaiter that `after()` reaches on a self-hosted server lives as long as the
process, and only drains on shutdown:

```ts
// packages/next/src/server/next-server.ts
createInternalWaitUntil() {
  // …
  const awaiter = new AwaiterOnce({ onError: console.error })
  // TODO(after): warn if the process exits before these are awaited
  this.onServerClose(() => awaiter.awaiting())
  return awaiter.waitUntil
}
```

So the Set entry lives for the life of the process, and so does the context the
`.then()` above captured.

## Which half retains the context

Set membership alone does not. The captured context does. Same 50-render harness,
three variants of those two lines:

| variant                                           | Set size | payloads retained |
| ------------------------------------------------- | -------- | ----------------- |
| current: Set entry + reaction in caller's context | 50       | **50 / 50**       |
| Set entry, reaction registered in an empty context| 50       | 0 / 50            |
| reaction in caller's context, no Set entry        | 0        | 0 / 50            |

That isolation is in `awaiter-which-retainer.cjs`, which needs no Next install.
