export type Compute<T> = { [U in keyof T]: T[U] } & {};
