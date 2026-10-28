import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
const input = process.argv[2];
if (!input) throw new Error("Indica la ruta del vídeo original.");
const frameDirectory = "public/media/frames-hd";
mkdirSync(frameDirectory, { recursive: true });
function run(args) {
  const r = spawnSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error("No se pudo preparar el vídeo.");
}
run([
  "-i",
  input,
  "-map",
  "0:v:0",
  "-an",
  "-vf",
  "fps=30,scale=1920:-2:flags=lanczos",
  "-c:v",
  "libwebp",
  "-quality",
  "84",
  "-compression_level",
  "4",
  `${frameDirectory}/%04d.webp`,
]);
for (const [name, time] of [
  ["salon", 6],
  ["bano", 19.5],
  ["cocina", 31.5],
  ["portada", 1],
]) {
  run([
    "-ss",
    String(time),
    "-i",
    input,
    "-map",
    "0:v:0",
    "-frames:v",
    "1",
    "-vf",
    "scale=1920:-2:flags=lanczos",
    "-c:v",
    "libwebp",
    "-quality",
    "90",
    `public/media/${name}.webp`,
  ]);
}
run([
  "-i",
  input,
  "-map",
  "0:v:0",
  "-an",
  "-map_metadata",
  "-1",
  "-vf",
  "scale=1920:-2:flags=lanczos,fps=30",
  "-c:v",
  "libx264",
  "-crf",
  "19",
  "-preset",
  "fast",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "public/media/recorrido-hd.mp4",
]);
writeFileSync(
  "public/media/manifest.json",
  JSON.stringify({
    fps: 30,
    width: 1920,
    height: 1080,
    directory: "frames-hd",
    count: readdirSync(frameDirectory).filter((f) => f.endsWith(".webp"))
      .length,
  }),
);
console.log("Fotogramas, fotografías y vídeo preparados.");
