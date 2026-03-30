import { DarknetServer } from "../darknet/misc";
import { DarknetServerInfo } from "../darknet/types";

const EmptyOptStr = "None";
const ValueOptStr = "Some";

export type WaitMessage = {
	type: "wait";
	on: "darknet.nextMutation";
	reply_port: number;
};
export type DarknetAuthenticateMessage = {
	type: "darknet.authenticate";
	by: string;
	for: string;
	auth: DarknetResult;
	password: string;
};
export type DarknetProbeMessage = {
	type: "darknet.probe";
	alt: "names";
	by: string;
	infos: DarknetServerInfo[];
} | {
	type: "darknet.probe";
	for: string;
	alt: "ip";
	results: string[];
};
export type DarknetFoundPassProbeMessage = {
	type: "found_password";
	by: string;
	for: string;
	password: string;
};
export type NewWordsMessage = {
	type: "new_words";
	from_dict: "commonPasswordDictionary";
	list: string[];
};
export type OptNone = { type: "None" };
export type OptSome<T> = { type: "Some"; value: T };
export type Optional<T> = OptNone | OptSome<T>;

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

export type OnlineServersMessage = {
	type: "online_servers";
	result: {
		darkweb: DarknetServer[];
		normal: Server[];
	};
};

export type QuitMessage = { type: "quit" };
export type TimeoutCheckMsg = { type: "timeout_check" };
