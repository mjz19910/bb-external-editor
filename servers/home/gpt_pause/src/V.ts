export type V<T extends string, U> = {
  t: T
  v: U
}
export function uv<T extends string, U>(v: V<T, U>) {
  return v.v
}
export function wv<T extends string, U>(t: T, v: U) {
  return { t, v }
}
