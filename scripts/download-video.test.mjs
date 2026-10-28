import test from "node:test";
import assert from "node:assert/strict";
import { downloadVideo } from "../src/scripts/download-video.mjs";
function response(chunks, headers = {}) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
        controller.close();
      },
    }),
    { headers },
  );
}
test("Video is not ready until all bytes arrive; progress represents real bytes", async () => {
  const progress = [];
  const blob = await downloadVideo("/tour.mp4", {
    onProgress: (bytes, total) => progress.push([bytes, total]),
    fetcher: async () =>
      response(
        [
          [1, 2],
          [3, 4, 5],
        ],
        { "content-length": "5" },
      ),
  });
  assert.deepEqual(progress, [
    [2, 5],
    [5, 5],
  ]);
  assert.equal(blob.size, 5);
  assert.equal(blob.type, "video/mp4");
  assert.deepEqual(
    [...new Uint8Array(await blob.arrayBuffer())],
    [1, 2, 3, 4, 5],
  );
});
test("Missing Content-Length uses the build manifest size", async () => {
  const progress = [];
  await downloadVideo("/tour.mp4", {
    expectedBytes: 2,
    onProgress: (bytes, total) => progress.push([bytes, total]),
    fetcher: async () => response([[8, 9]]),
  });
  assert.deepEqual(progress, [[2, 2]]);
});
test("A truncated response never enables the tour", async () => {
  await assert.rejects(
    downloadVideo("/tour.mp4", {
      onProgress: () => {},
      fetcher: async () => response([[1, 2]], { "content-length": "4" }),
    }),
    /incompleta/,
  );
});
test("Server errors leave the loader in a recoverable failure state", async () => {
  await assert.rejects(
    downloadVideo("/tour.mp4", {
      onProgress: () => {},
      fetcher: async () => new Response(null, { status: 503 }),
    }),
    /503/,
  );
});
test("Skipping the tour aborts loading instead of enabling it later", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    downloadVideo("/tour.mp4", {
      signal: controller.signal,
      onProgress: () => {},
      fetcher: async () => response([[1]]),
    }),
    { name: "AbortError" },
  );
});
