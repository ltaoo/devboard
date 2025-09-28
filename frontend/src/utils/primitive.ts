export function toNumber<T extends number | undefined>(
  v: any,
  default_v?: T
): T extends undefined ? number | null : number {
  const vv = Number(v);
  if (Number.isNaN(vv)) {
    if (default_v !== undefined) {
      return default_v as any;
    }
    return null as any;
  }
  return vv as any;
}

export function inRange(v: number, [a, b]: [number, number]) {
  return v >= a && v <= b;
}
