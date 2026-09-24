import { datasetBytes } from '../data/dataset';
import { generateDataset } from '../data/generator';
import { WorkerRequest, WorkerResponse } from './protocol';
import { QueryEngine } from './query-engine';

/** Same protocol as the worker, executed on the main thread (fallback only). */
export function createInlineTransport(receive: (message: WorkerResponse) => void): (request: WorkerRequest) => void {
  let engine: QueryEngine | null = null;
  return (request) => {
    queueMicrotask(() => {
      try {
        if (request.type === 'init') {
          const t0 = performance.now();
          const ds = generateDataset();
          engine = new QueryEngine(ds);
          receive({
            id: request.id,
            ok: true,
            type: 'init',
            meta: {
              start: ds.start,
              end: ds.end,
              days: ds.days,
              orders: ds.orderCount,
              customers: ds.customerCount,
              trafficCells: ds.traffic.sessions.length,
              generationMs: performance.now() - t0,
              approxBytes: datasetBytes(ds),
            },
          });
          return;
        }
        if (!engine) throw new Error('Dataset is not initialised');
        const { result, timing } = engine.run(request.kind, request.params);
        receive({ id: request.id, ok: true, type: 'query', result, timing });
      } catch (error) {
        receive({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
  };
}
