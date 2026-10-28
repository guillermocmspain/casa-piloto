import { timeAt, follow, panelAt } from "./scroll-motion.mjs";
import { downloadVideo } from "./download-video.mjs";
const tour = document.querySelector<HTMLElement>(".tour")!;
const stage = document.querySelector<HTMLElement>(".stage")!;
const film = document.querySelector<HTMLVideoElement>("#tour-film")!;
const panels = [...document.querySelectorAll<HTMLElement>("[data-panel]")];
const progressBar = document.querySelector<HTMLElement>("#tour-progress")!;
const links = [...document.querySelectorAll<HTMLAnchorElement>(".stop-nav a")];
const loader = document.querySelector<HTMLDialogElement>("#tour-loader")!;
const loadProgress =
  document.querySelector<HTMLProgressElement>("#loader-progress")!;
const loadPercent = document.querySelector<HTMLElement>("#loader-percent")!;
const loadMessage = document.querySelector<HTMLElement>("#loader-message")!;
const retry = document.querySelector<HTMLButtonElement>("#loader-retry")!;
const enter = document.querySelector<HTMLButtonElement>("#loader-enter")!;
const skip = document.querySelector<HTMLButtonElement>("#loader-skip")!;
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const saveData = (
  navigator as Navigator & { connection?: { saveData?: boolean } }
).connection?.saveData;
let enhanced = !motion.matches && !saveData;
let ready = false,
  active = true,
  duration = 33.75,
  raf = 0,
  lastTick = 0,
  lastPanel = -1;
let currentTime = 0.6,
  desiredTime = 0.6,
  seeking = false,
  seekStart = 0,
  seekWatchdog = 0;
let controller: AbortController | null = null,
  objectURL = "",
  slowTimer = 0,
  timeoutTimer = 0;
let sampleCount = 0,
  maxSeekMs = 0;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
function setPanel(index: number) {
  if (lastPanel === index) return;
  lastPanel = index;
  panels.forEach((panel, i) => {
    panel.classList.toggle("active", i === index);
    panel.inert = enhanced && i !== index;
  });
  links.forEach((link, i) =>
    link.setAttribute("aria-current", String(i + 1 === index)),
  );
}
function presented(time: number) {
  if (!ready) return;
  film.dataset.frame = String(Math.round(time * 30));
  setPanel(panelAt(time));
}
// Native compositing presents decoded video frames without copying Full HD
// images through a canvas on every update.
const hasFrameCallback = typeof film.requestVideoFrameCallback === "function";
if (hasFrameCallback) {
  const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
    presented(metadata.mediaTime);
    film.requestVideoFrameCallback(onFrame);
  };
  film.requestVideoFrameCallback(onFrame);
}
film.addEventListener("seeked", () => {
  seeking = false;
  clearTimeout(seekWatchdog);
  if (ready) {
    const elapsed = performance.now() - seekStart;
    maxSeekMs = Math.max(maxSeekMs, elapsed);
    sampleCount++;
    film.dataset.seekCount = String(sampleCount);
    film.dataset.maxSeekMs = String(Math.round(maxSeekMs));
    if (!hasFrameCallback) presented(film.currentTime);
    schedule();
  }
});
function requestFrame() {
  if (!ready || seeking || film.seeking || !active || document.hidden) return;
  const wanted = Math.min(
    duration - 0.08,
    Math.max(0, Math.round(currentTime * 30) / 30),
  );
  if (Math.abs(film.currentTime - wanted) < 1 / 60) return;
  // Coalesce wheel events: at most one seek is in flight, always followed by
  // the newest target. Never queue outdated positions or start network loads.
  seeking = true;
  seekStart = performance.now();
  film.currentTime = wanted;
  seekWatchdog = window.setTimeout(() => {
    seeking = false;
    if (!film.seeking) schedule();
    else disable();
  }, 4000);
}
function readScroll() {
  if (!enhanced) return;
  const rect = tour.getBoundingClientRect();
  active = rect.bottom > 0 && rect.top < innerHeight;
  const p = clamp(
    -rect.top / Math.max(1, tour.offsetHeight - stage.clientHeight),
  );
  desiredTime = timeAt(p, duration);
  progressBar.style.transform = `scaleX(${p})`;
  schedule();
}
function update(now: number) {
  raf = 0;
  if (!ready || !active || document.hidden) {
    lastTick = 0;
    return;
  }
  const dt = lastTick ? Math.min(0.05, (now - lastTick) / 1000) : 1 / 60;
  lastTick = now;
  currentTime = follow(currentTime, desiredTime, dt);
  if (Math.abs(currentTime - desiredTime) < 0.003) currentTime = desiredTime;
  requestFrame();
  if (currentTime !== desiredTime) schedule();
  else lastTick = 0;
}
function schedule() {
  if (enhanced && !raf) raf = requestAnimationFrame(update);
}
function setProgress(value: number, message?: string) {
  const rounded = Math.max(0, Math.min(100, Math.floor(value)));
  loadProgress.value = rounded;
  loadPercent.textContent = `${rounded}%`;
  if (message && loadMessage.textContent !== message)
    loadMessage.textContent = message;
}
function waitForMedia(event: string, signal: AbortSignal, ms = 15000) {
  return new Promise<void>((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      film.removeEventListener(event, done);
      film.removeEventListener("error", fail);
      signal.removeEventListener("abort", abort);
    };
    const done = () => {
      clean();
      resolve();
    };
    const fail = () => {
      clean();
      reject(new Error("No se pudo preparar el vídeo"));
    };
    const abort = () => {
      clean();
      reject(signal.reason);
    };
    const timer = setTimeout(fail, ms);
    film.addEventListener(event, done, { once: true });
    film.addEventListener("error", fail, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
async function prepareFirstFrame(signal: AbortSignal) {
  readScroll();
  currentTime = desiredTime;
  const first = Math.round(currentTime * 30) / 30;
  if (Math.abs(film.currentTime - first) > 1 / 60) {
    const loaded = waitForMedia("seeked", signal, 7000);
    film.currentTime = first;
    await loaded;
  }
  if (signal.aborted || !enhanced) return;
  clearTimeout(slowTimer);
  clearTimeout(timeoutTimer);
  setProgress(100, "Recorrido listo");
  film.dataset.loadState = "ready";
  film.classList.add("is-ready");
  ready = true;
  setPanel(panelAt(film.currentTime));
  document.documentElement.classList.remove("tour-loading");
  loader.close();
  readScroll();
}
async function loadTour() {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  ready = false;
  retry.hidden = true;
  enter.hidden = true;
  setProgress(0, "Preparando el recorrido…");
  film.dataset.loadState = "loading";
  document.documentElement.classList.add("tour-loading");
  if (!loader.open) loader.showModal();
  clearTimeout(slowTimer);
  clearTimeout(timeoutTimer);
  slowTimer = window.setTimeout(() => {
    loadMessage.textContent =
      "Seguimos preparando la visita. Puedes ver la ficha mientras tanto.";
  }, 15000);
  timeoutTimer = window.setTimeout(
    () => controller?.abort(new Error("La conexión está tardando demasiado.")),
    120000,
  );
  const mobile = innerWidth < 800 && innerHeight > innerWidth;
  film.dataset.profile = mobile ? "mobile" : "desktop";
  const url = (mobile ? film.dataset.mobile : film.dataset.desktop)!;
  const expectedBytes = Number(
    mobile ? film.dataset.mobileBytes : film.dataset.desktopBytes,
  );
  try {
    const blob = await downloadVideo(url, {
      signal,
      expectedBytes,
      onProgress: (received: number, total: number) => {
        setProgress(total ? (received / total) * 94 : 0);
      },
    });
    if (signal.aborted) return;
    clearTimeout(slowTimer);
    setProgress(96, "Preparando la imagen…");
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(blob);
    const loaded = waitForMedia("loadeddata", signal);
    film.preload = "auto";
    film.src = objectURL;
    film.load();
    await loaded;
    duration = film.duration;
    if (!Number.isFinite(duration) || duration < 1)
      throw Error("Vídeo no válido");
    try {
      await prepareFirstFrame(signal);
    } catch (error) {
      if (signal.aborted) throw error;
      // Some iOS versions require a user gesture before seeking a paused video.
      setProgress(98, "El recorrido está descargado. Pulsa para entrar.");
      enter.hidden = false;
      clearTimeout(timeoutTimer);
    }
  } catch (error) {
    clearTimeout(slowTimer);
    clearTimeout(timeoutTimer);
    if (!enhanced || (signal.aborted && controller?.signal !== signal)) return;
    film.dataset.loadState = "error";
    loadMessage.textContent =
      "No hemos podido preparar el recorrido. Puedes reintentarlo o ver la vivienda sin animación.";
    retry.hidden = false;
  }
}
function disable() {
  enhanced = false;
  ready = false;
  controller?.abort();
  film.pause();
  clearTimeout(slowTimer);
  clearTimeout(timeoutTimer);
  clearTimeout(seekWatchdog);
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  document.documentElement.classList.remove("enhanced", "tour-loading");
  panels.forEach((p) => {
    p.inert = false;
    p.classList.remove("active");
  });
  film.classList.remove("is-ready");
  film.dataset.loadState = "static";
  film.removeAttribute("src");
  film.load();
  if (objectURL) {
    URL.revokeObjectURL(objectURL);
    objectURL = "";
  }
  if (loader.open) loader.close();
}
skip.addEventListener("click", () => {
  disable();
  document.querySelector("#detalles")?.scrollIntoView({ behavior: "instant" });
});
loader.addEventListener("cancel", (e) => {
  e.preventDefault();
  disable();
});
retry.addEventListener("click", () => void loadTour());
enter.addEventListener("click", async () => {
  enter.disabled = true;
  try {
    await film.play();
    film.pause();
    await prepareFirstFrame(controller!.signal);
  } catch {
    loadMessage.textContent =
      "No se puede reproducir el recorrido en este navegador.";
    retry.hidden = false;
  } finally {
    enter.disabled = false;
  }
});
if (enhanced) {
  document.documentElement.classList.add("enhanced");
  setPanel(0);
  readScroll();
  void loadTour();
  addEventListener("scroll", readScroll, { passive: true });
  addEventListener("resize", readScroll);
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
    if (!ready) return;
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
    if (!video.src)
      video.src =
        ready && objectURL && film.dataset.profile === "desktop"
          ? objectURL
          : video.dataset.src!;
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
document
  .querySelectorAll<HTMLDialogElement>("#video-dialog, #visit-dialog")
  .forEach((dialog) => {
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
