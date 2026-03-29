export const deps = [
  "types/arg_parse.ts"
];

export function read_string_arg(arg: ScriptArg) {
  if (typeof arg !== "string") throw new Error("Invalid argument")
  return arg
}

export function read_number_arg(arg: ScriptArg) {
  if (typeof arg !== "number") throw new Error("Invalid argument")
  return arg
}
