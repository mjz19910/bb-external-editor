import { Server } from "../NetscriptDefinitions.d";
import { DarknetServer } from "../type/helper";

const EmptyOptStr = "None";
const ValueOptStr = "Some";

export type OptSome<T> = { type: "Some"; value: T };
export type OptNone = { type: "None" };
export type Optional<T> = OptSome<T> | OptNone;

export function empty_opt(): { type: "None" } {
	return { type: EmptyOptStr };
}

export function some_opt<T>(value: T): { type: "Some"; value: T } {
	return { type: ValueOptStr, value };
}

export function isSome<T>(val: Optional<T>): val is OptSome<T> {
	return val.type === ValueOptStr;
}

export function isNone<T>(val: Optional<T>): val is OptNone {
	return val.type === EmptyOptStr;
}

export function assign_opt<T>(opt: Optional<T>, val: T) {
	opt.type = ValueOptStr;
	if (isNone(opt)) return;
	opt.value = val;
}

export function isDarknetServer(
	s: { hostname: string } | Server | DarknetServer,
): s is DarknetServer {
	return "blockedRam" in s;
}
