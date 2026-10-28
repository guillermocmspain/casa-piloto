// Download the complete selected rendition before allowing scroll scrubbing.
// Progress measures bytes received, never a timer or a simulated percentage.
export async function downloadVideo(
  url,
  { signal, onProgress, expectedBytes = 0, fetcher = fetch },
) {
  const response = await fetcher(url, { signal, cache: "default" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get("content-length")) || expectedBytes;
  let received = 0;
  const chunks = [];
  if (response.body) {
    const reader = response.body.getReader();
    try {
      while (true) {
        signal?.throwIfAborted();
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        onProgress(received, total);
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const buffer = await response.arrayBuffer();
    received = buffer.byteLength;
    chunks.push(new Uint8Array(buffer));
    onProgress(received, total);
  }
  signal?.throwIfAborted();
  if (received === 0 || (total > 0 && received < total))
    throw new Error("Descarga incompleta");
  return new Blob(chunks, { type: "video/mp4" });
}
