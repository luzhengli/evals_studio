let counter = 0;

/** Short, sortable, collision-safe id: <prefix>_<base36 time><base36 counter><rand> */
export function id(prefix: string): string {
  counter = (counter + 1) % 1296;
  const t = Date.now().toString(36);
  const c = counter.toString(36).padStart(2, "0");
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${t}${c}${r}`;
}

export const now = () => Date.now();
