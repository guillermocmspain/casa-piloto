import { timeAt, follow, panelAt } from "./scroll-motion.mjs";
const base = import.meta.env.BASE_URL;
const tour = document.querySelector<HTMLElement>(".tour")!;
const stage = document.querySelector<HTMLElement>(".stage")!;
const panels = [...document.querySelectorAll<HTMLElement>("[data-panel]")];
const canvas = document.querySelector<HTMLCanvasElement>("#tour-canvas")!;
const ctx = canvas.getContext("2d", { alpha: false });
const progressBar = document.querySelector<HTMLElement>("#tour-progress")!;
const links = [...document.querySelectorAll<HTMLAnchorElement>(".stop-nav a")];
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const saveData = (
  navigator as Navigator & { connection?: { saveData?: boolean } }
).connection?.saveData;
let enhanced = !motion.matches && !saveData && !!ctx;
let fps = 30,
  count = 1013,
  duration = 33.75,
  frameDirectory = "frames-hd";
let currentTime = 0.6,
  desiredTime = 0.6,
  target = 19,
  drawn = -1,
  lastPanel = -1;
let raf = 0,
  lastTick = 0,
  loading = 0,
  errors = 0,
  velocity = 0,
  direction = 1;
let ready = false,
  active = true,
  initialised = false;
const images = new Map<number, HTMLImageElement>();
const pending = new Set<number>();
const failed = new Set<number>();
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
function setPanel(index: number) {
  if (index === lastPanel) return;
  lastPanel = index;
  panels.forEach((panel, i) => {
    panel.classList.toggle("active", i === index);
    panel.inert = enhanced && i !== index;
  });
  links.forEach((link, i) =>
    link.setAttribute("aria-current", String(i + 1 === index)),
  );
}
function draw(index: number) {
  const img = images.get(index);
  if (!img || !ctx || drawn === index) return;
  const scale = Math.max(
    canvas.width / img.naturalWidth,
    canvas.height / img.naturalHeight,
  );
  const w = img.naturalWidth * scale,
    h = img.naturalHeight * scale;
  // A constant crop avoids artificial sideways jumps between rooms.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    (canvas.width - w) * 0.56,
    (canvas.height - h) * 0.5,
    w,
    h,
  );
  canvas.style.opacity = "1";
  canvas.dataset.frame = String(index);
  drawn = index;
  // Copy follows the actual visible footage, even if the network is slower.
  setPanel(panelAt((index - 1) / fps));
}
function renderNearest() {
  if (images.has(target)) {
    draw(target);
    return;
  }
  let nearest = -1,
    dist = Infinity;
  for (const index of images.keys()) {
    // A late network response must not briefly rewind forward motion.
    if (
      drawn >= 0 &&
      Math.abs(velocity) > 0.15 &&
      (index - drawn) * direction < 0
    )
      continue;
    if (Math.abs(index - target) < dist) {
      nearest = index;
      dist = Math.abs(index - target);
    }
  }
  if (nearest >= 0 && (drawn < 0 || dist <= 8)) draw(nearest);
}
function prune() {
  const limit = innerWidth < 700 ? 14 : 20;
  while (images.size > limit) {
    let far = -1,
      dist = -1;
    for (const i of images.keys()) {
      const d = Math.abs(i - target) + ((i - target) * direction < 0 ? 3 : 0);
      if (d > dist) {
        far = i;
        dist = d;
      }
    }
    images.delete(far);
  }
}
function pump() {
  if (!enhanced || !ready || !active || document.hidden) return;
  const stride = clamp(Math.round((Math.abs(velocity) * fps) / 60), 1, 10);
  const candidates = [target, target + direction, target - direction];
  for (let i = 1; i <= 8; i++) candidates.push(target + direction * stride * i);
  for (let i = 2; i <= 3; i++) candidates.push(target - direction * i);
  for (const index of candidates) {
    if (loading >= 5) break;
    if (
      index < 1 ||
      index > count ||
      images.has(index) ||
      pending.has(index) ||
      failed.has(index)
    )
      continue;
    loading++;
    pending.add(index);
    const img = new Image();
    img.decoding = "async";
    img.onload = async () => {
      try {
        await img.decode();
      } catch {
        /* onload image remains drawable */
      }
      pending.delete(index);
      loading--;
      if (!enhanced) return;
      images.set(index, img);
      prune();
      schedule();
      pump();
    };
    img.onerror = () => {
      pending.delete(index);
      failed.add(index);
      loading--;
      errors++;
      if (errors > 16 && images.size === 0) disable();
      else pump();
    };
    img.src = `${base}media/${frameDirectory}/${String(index).padStart(4, "0")}.webp`;
  }
}
function readScroll() {
  if (!enhanced) return;
  const rect = tour.getBoundingClientRect();
  active = rect.bottom > 0 && rect.top < innerHeight;
  const p = clamp(
    -rect.top / Math.max(1, tour.offsetHeight - stage.clientHeight),
  );
  desiredTime = timeAt(p, duration);
  if (!initialised) {
    currentTime = desiredTime;
    initialised = true;
  }
  progressBar.style.transform = `scaleX(${p})`;
  schedule();
}
function update(now: number) {
  raf = 0;
  if (!enhanced || !ready || !active || document.hidden) {
    lastTick = 0;
    return;
  }
  const dt = lastTick ? Math.min((now - lastTick) / 1000, 0.05) : 1 / 60;
  lastTick = now;
  const previous = currentTime;
  currentTime = follow(currentTime, desiredTime, dt);
  if (Math.abs(currentTime - desiredTime) < 0.003) currentTime = desiredTime;
  velocity = (currentTime - previous) / Math.max(dt, 0.001);
  if (Math.abs(velocity) > 0.01) direction = velocity > 0 ? 1 : -1;
  target = clamp(Math.round(currentTime * fps) + 1, 1, count);
  renderNearest();
  pump();
  if (currentTime !== desiredTime) schedule();
  else lastTick = 0;
}
function schedule() {
  if (!raf) raf = requestAnimationFrame(update);
}
function resize() {
  if (!enhanced) return;
  // Never request a sharper backing store than the real Full HD source can supply.
  const sourceScale = Math.max(
    stage.clientWidth / 1920,
    stage.clientHeight / 1080,
  );
  const ratio = Math.min(devicePixelRatio || 1, 2, 1 / sourceScale);
  canvas.width = Math.round(stage.clientWidth * ratio);
  canvas.height = Math.round(stage.clientHeight * ratio);
  drawn = -1;
  readScroll();
}
function disable() {
  enhanced = false;
  document.documentElement.classList.remove("enhanced");
  panels.forEach((p) => {
    p.inert = false;
    p.classList.remove("active");
  });
  canvas.style.opacity = "0";
  images.clear();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}
if (enhanced) {
  document.documentElement.classList.add("enhanced");
  canvas.style.opacity = "0";
  setPanel(0);
  resize();
  fetch(`${base}media/manifest.json`, { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((m) => {
      fps = m.fps;
      count = m.count;
      duration = count / fps;
      frameDirectory = m.directory;
      ready = true;
      readScroll();
    })
    .catch(disable);
  addEventListener("scroll", readScroll, { passive: true });
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    lastTick = 0;
    readScroll();
  });
  motion.addEventListener("change", () => {
    if (motion.matches) disable();
  });
}

document.querySelectorAll<HTMLAnchorElement>("[data-jump]").forEach((a) =>
  a.addEventListener("click", (e) => {
    if (!enhanced) return;
    e.preventDefault();
    const y =
      tour.getBoundingClientRect().top +
      scrollY +
      (tour.offsetHeight - stage.clientHeight) * Number(a.dataset.jump);
    scrollTo({ top: y, behavior: "smooth" });
  }),
);
// Native dialogs provide focus trapping, Escape handling and a keyboard-friendly close.
const videoDialog = document.querySelector<HTMLDialogElement>("#video-dialog")!;
const video = videoDialog.querySelector("video")!;
const visitDialog = document.querySelector<HTMLDialogElement>("#visit-dialog")!;
let opener: HTMLElement | null = null;
document.querySelectorAll<HTMLButtonElement>("[data-video]").forEach((button) =>
  button.addEventListener("click", () => {
    opener = button;
    if (!video.src) video.src = video.dataset.src!;
    videoDialog.showModal();
    video.play().catch(() => {});
  }),
);
document.querySelectorAll<HTMLButtonElement>("[data-visit]").forEach((button) =>
  button.addEventListener("click", () => {
    opener = button;
    visitDialog.showModal();
  }),
);
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
  dialog
    .querySelector("[data-close]")!
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    video.pause();
    opener?.focus({ preventScroll: true });
  });
});
const dateInput = document.querySelector<HTMLInputElement>("#visit-date")!;
const today = new Date();
dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
document
  .querySelector<HTMLFormElement>("#visit-form")!
  .addEventListener("submit", (e) => {
    e.preventDefault();
    const result = document.querySelector<HTMLElement>("#visit-result")!;
    const day = new Date(`${dateInput.value}T12:00:00`).toLocaleDateString(
      "es-ES",
      { day: "numeric", month: "long", year: "numeric" },
    );
    const time = document
      .querySelector<HTMLSelectElement>("#visit-time")!
      .value.toLowerCase();
    result.textContent = `Simulación completada para el ${day}, ${time}. No se ha enviado ninguna solicitud ni reservado una visita real.`;
    result.hidden = false;
  });
