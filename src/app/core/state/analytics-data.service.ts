import { computed, Injectable, signal } from '@angular/core';
import { DatasetMeta } from '../data/dataset';
import { QueryKind, QueryMap, QueryTiming, WorkerRequest, WorkerResponse } from '../worker/protocol';

export type DataStatus = 'loading' | 'ready' | 'error';

export interface LastQuery {
  readonly kind: QueryKind;
  readonly timing: QueryTiming;
  /** Main thread → worker → main thread, including structured-clone costs. */
  readonly roundTripMs: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

type Transport = (request: WorkerRequest) => void;

/**
 * Typed RPC client for the analytics worker. The dataset is generated and queried off the
 * main thread; the UI only ever receives small, pre-aggregated results.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsDataService {
  readonly status = signal<DataStatus>('loading');
  readonly meta = signal<DatasetMeta | null>(null);
  readonly error = signal<string | null>(null);
  readonly lastQuery = signal<LastQuery | null>(null);
  /** Number of queries in flight — the perf monitor waits for this to reach zero. */
  readonly inflight = signal(0);
  readonly busy = computed(() => this.inflight() > 0);

  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly ready: Promise<DatasetMeta>;
  private send: Transport = () => undefined;

  constructor() {
    this.ready = this.connect()
      .then(() => this.call<DatasetMeta>({ id: this.nextId++, type: 'init' }))
      .then((meta) => {
        this.meta.set(meta);
        this.status.set('ready');
        return meta;
      })
      .catch((error: unknown) => {
        this.error.set(error instanceof Error ? error.message : String(error));
        this.status.set('error');
        throw error;
      });
    this.ready.catch(() => undefined);
  }

  async query<K extends QueryKind>(kind: K, params: QueryMap[K]['params'], abortSignal?: AbortSignal): Promise<QueryMap[K]['result']> {
    this.inflight.update((n) => n + 1);
    try {
      await this.ready;
      const t0 = performance.now();
      const id = this.nextId++;
      const request = { id, type: 'query', kind, params } as WorkerRequest;
      const { result, timing } = await this.call<{ result: QueryMap[K]['result']; timing: QueryTiming }>(request, abortSignal);
      this.lastQuery.set({ kind, timing, roundTripMs: performance.now() - t0 });
      return result;
    } finally {
      this.inflight.update((n) => n - 1);
    }
  }

  private call<T>(request: WorkerRequest, abortSignal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (abortSignal?.aborted) return reject(abortSignal.reason);
      this.pending.set(request.id, { resolve: resolve as (v: unknown) => void, reject });
      // The worker can't be interrupted mid-query, but a superseded request resolves nobody.
      abortSignal?.addEventListener('abort', () => {
        if (this.pending.delete(request.id)) reject(abortSignal.reason);
      });
      this.send(request);
    });
  }

  private receive = (message: WorkerResponse): void => {
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    if (!message.ok) entry.reject(new Error(message.error));
    else if (message.type === 'init') entry.resolve(message.meta);
    else entry.resolve({ result: message.result, timing: message.timing });
  };

  private async connect(): Promise<void> {
    if (typeof Worker !== 'undefined') {
      const worker = new Worker(new URL('../worker/analytics.worker', import.meta.url), { type: 'module', name: 'analytics' });
      worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => this.receive(e.data));
      worker.addEventListener('error', (e) => this.failAll(new Error(e.message || 'Analytics worker failed')));
      this.send = (request) => worker.postMessage(request);
      return;
    }
    // No Worker support (e.g. some test runners): run the same engine on the main thread.
    const { createInlineTransport } = await import('../worker/inline-transport');
    this.send = createInlineTransport((message) => this.receive(message));
  }

  private failAll(error: Error): void {
    for (const entry of this.pending.values()) entry.reject(error);
    this.pending.clear();
    this.error.set(error.message);
    this.status.set('error');
  }
}
