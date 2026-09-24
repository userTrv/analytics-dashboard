/// <reference lib="webworker" />
import { datasetBytes, DatasetMeta } from '../data/dataset';
import { DEFAULT_GENERATOR_OPTIONS, generateDataset } from '../data/generator';
import { WorkerRequest, WorkerResponse } from './protocol';
import { QueryEngine } from './query-engine';

let engine: QueryEngine | null = null;

function reply(message: WorkerResponse): void {
  postMessage(message);
}

addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    if (data.type === 'init') {
      const t0 = performance.now();
      const ds = generateDataset({ ...DEFAULT_GENERATOR_OPTIONS, seed: data.seed ?? DEFAULT_GENERATOR_OPTIONS.seed });
      const generationMs = performance.now() - t0;
      engine = new QueryEngine(ds);
      const meta: DatasetMeta = {
        start: ds.start,
        end: ds.end,
        days: ds.days,
        orders: ds.orderCount,
        customers: ds.customerCount,
        trafficCells: ds.traffic.sessions.length,
        generationMs,
        approxBytes: datasetBytes(ds),
      };
      reply({ id: data.id, ok: true, type: 'init', meta });
      return;
    }
    if (!engine) throw new Error('Dataset is not initialised');
    const { result, timing } = engine.run(data.kind, data.params);
    reply({ id: data.id, ok: true, type: 'query', result, timing });
  } catch (error) {
    reply({ id: data.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
