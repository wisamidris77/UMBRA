/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Utility and Math functions
 * ==========================================================================
 */

export const LERP_FACTOR = 0.1;

export function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Normalizes an angle into the range [-PI, PI]
 */
export function normalizeAngle(angle) {
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

/**
 * Calculates the shortest difference between two angles
 */
export function angleDifference(target, source) {
  let diff = target - source;
  return normalizeAngle(diff);
}

/**
 * Check if a circle intersects a line segment (used for laser sweeps)
 * @param {number} cx Circle Center X
 * @param {number} cy Circle Center Y
 * @param {number} cr Circle Radius
 * @param {number} x1 Line Start X
 * @param {number} y1 Line Start Y
 * @param {number} x2 Line End X
 * @param {number} y2 Line End Y
 */
export function checkCircleLineCollision(cx, cy, cr, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  // Calculate line segment length squared
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return getDistance(cx, cy, x1, y1) <= cr;

  // Project circle center onto the line segment (clamped to segment bounds)
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = clamp(t, 0, 1);

  // Find the closest point on the segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  // Check if distance to closest point is less than radius
  const dist = getDistance(cx, cy, closestX, closestY);
  return dist <= cr;
}

/**
 * Simple ease out easing functions
 */
export const ease = {
  outQuad: (t) => t * (2 - t),
  outCubic: (t) => (--t) * t * t + 1,
  outElastic: (t) => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  inOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
};
