import { assemblyStats, parseFasta, sketchRecords } from './genome-core.mjs';

self.onmessage = ({ data }) => {
  try {
    const records = parseFasta(data.text);
    self.postMessage({
      id: data.id,
      ok: true,
      stats: assemblyStats(records),
      sketch: sketchRecords(records),
    });
  } catch (error) {
    self.postMessage({
      id: data.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
