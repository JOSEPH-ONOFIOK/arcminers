// Deterministic randomness.

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
};

/** mulberry32, small, fast, and well-spread enough for trait rolls. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length) % items.length],
    chance: (probability) => next() < probability,
  };
}

/** FNV-1a over a string. Turns a dig log into a stable 32-bit seed. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Split a hex digest into independent unit floats.
export function digitsFrom(digest: string, count: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = digest.slice(i * 8, i * 8 + 8);
    // A short digest wraps rather than yielding NaN, better a repeated roll
    // than an outcome that silently resolves to "dead rock" forever.
    const value = chunk.length === 8 ? parseInt(chunk, 16) : hashString(digest + i);
    rolls.push(value / 0x100000000);
  }
  return rolls;
}
