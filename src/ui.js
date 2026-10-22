// A tiny shared store for what the room tells the overlay UI (cursor label, drag state)
// without re-rendering React on every pointer move.
const listeners = new Set();

export const ui = {
  label: null, // name of the prop under the pointer, e.g. "Projects"
  drag: false,
  overScene: false,
  badge: 0, // the experience badge in front
  flip: false, // and whether it's turned over
  set(patch) {
    let changed = false;
    for (const k in patch) {
      if (this[k] !== patch[k]) {
        this[k] = patch[k];
        changed = true;
      }
    }
    if (changed) listeners.forEach((f) => f());
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const nowIST = (opts) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts }).format(new Date());
