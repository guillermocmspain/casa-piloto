// Continuous time mapping: every scroll increment advances the source footage.
export function timeAt(progress, duration = 33.75) {
  return 0.6 + Math.min(1, Math.max(0, progress)) * (duration - 1.15);
}

// Exponential following is independent of screen refresh rate. A short settling
// time smooths wheel notches without a long, floating camera drift afterwards.
export function follow(current, target, elapsedSeconds) {
  const dt = Math.min(0.05, Math.max(0, elapsedSeconds));
  return current + (target - current) * (1 - Math.exp(-dt / 0.12));
}

export function panelAt(time) {
  if (time < 3.7) return 0;
  if (time >= 4 && time <= 10) return 1;
  if (time >= 16 && time <= 22) return 2;
  if (time >= 28) return 3;
  return -1;
}
