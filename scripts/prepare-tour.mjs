import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { statSync, writeFileSync, mkdirSync } from "node:fs";
const input = process.argv[2];
if (!input) throw new Error("Indica el vídeo original.");
mkdirSync("public/media", { recursive: true });
const profiles = [
  {
    name: "desktop",
    filter: "fps=30,scale=1920:-2:flags=lanczos",
    crf: "23",
    width: 1920,
    height: 1080,
  },
  {
    name: "mobile",
    filter: "fps=30,crop=720:1080:672:0",
    crf: "22",
    width: 720,
    height: 1080,
  },
];
const metadata = {};
for (const profile of profiles) {
  const file = `tour-${profile.name}-v3.mp4`;
  const result = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-an",
      "-map_metadata",
      "-1",
      "-vf",
      profile.filter,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      profile.crf,
      "-g",
      "3",
      "-keyint_min",
      "3",
      "-sc_threshold",
      "0",
      "-bf",
      "0",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      `public/media/${file}`,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("Error preparando el recorrido");
  metadata[profile.name] = {
    file,
    bytes: statSync(`public/media/${file}`).size,
    width: profile.width,
    height: profile.height,
  };
}
mkdirSync("src/data", { recursive: true });
writeFileSync(
  "src/data/tour-media.json",
  JSON.stringify(metadata, null, 2) + "\n",
);
