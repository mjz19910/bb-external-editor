import { NS } from "../../../@ns";
import { API_PORT, REPLY_PORT, REQUEST_PORT } from "../const/port";
import {
	ApiMessage,
	assign_opt,
	empty_opt,
	OnlineCheckMsg,
	Optional,
	PortMessage,
	some_opt,
} from "./helper";

export const Null = "NULL PORT DATA" as const;
export type Null = typeof Null;
export type NS_Port = {
	read(): unknown;
	peek(): unknown;
	write(value: unknown): unknown;
	full(): boolean;
	tryWrite(value: unknown): boolean;
	nextWrite(): Promise<void>;
	empty(): boolean;
	clear(): void;
};

export class PortEmptyError extends Error {
	constructor(portId: number) {
		super(`Port ${portId} is empty`);
		this.name = "PortEmptyError";
	}
}

export class PortFullError extends Error {
	constructor(portId: number) {
		super(`Port ${portId} is full`);
		this.name = "PortFullError";
	}
}

export function peek<T>(port: NS_Port): T | Null {
	return port.peek() as T | Null;
}

export function readPort<T>(port: NS_Port): T | Null {
	return port.read() as T | Null;
}

export function writePort<TIn, TOut = TIn>(
	port: NS_Port,
	input: TIn,
): TOut | Null {
	return port.write(input) as TOut | Null;
}

export function optFromRaw<U>(value: U | Null): Optional<U> {
	return value === Null ? empty_opt() : some_opt(value);
}

export function rawPeekOpt<T>(port: NS_Port): Optional<T> {
	return optFromRaw<T>(peek(port));
}

export function rawReadOpt<T>(port: NS_Port): Optional<T> {
	return optFromRaw<T>(readPort(port));
}

export function rawWriteOpt<TIn, TOut = TIn>(
	port: NS_Port,
	input: TIn,
): Optional<TOut> {
	return optFromRaw<TOut>(writePort(port, input));
}

export function fromRaw<U>(value: U | Null): U | undefined {
	return value === Null ? undefined : value;
}

export function rawPeek<T>(port: NS_Port): T | undefined {
	return fromRaw(peek(port));
}

export function rawRead<T>(port: NS_Port): T | undefined {
	return fromRaw(readPort(port));
}

export function rawWrite<TIn, TOut = TIn>(
	port: NS_Port,
	input: TIn,
): TOut | undefined {
	return fromRaw(writePort(port, input));
}

export function readIntoObj<T, K extends string>(
	port: NS_Port,
	obj: Record<K, T>,
	key: K,
) {
	const data = readPort<T>(port);
	if (data === "NULL PORT DATA") return false;
	obj[key] = data;
	return true;
}

export function readIntoOpt<T>(port: NS_Port, readResult: Optional<T>) {
	const data = readPort<T>(port);
	if (data === "NULL PORT DATA") return false;
	assign_opt(readResult, data);
	return true;
}

export function readInto<T>(port: NS_Port, readResults: T[]) {
	const data = readPort<T>(port);
	if (data === "NULL PORT DATA") return false;
	readResults.push(data);
	return true;
}

export function rawReadAll<T>(port: NS_Port) {
	const results: T[] = [];
	while (readInto(port, results)) {}
	return results;
}

export class ScriptPort<BaseType> {
	static open_api_port(ns: NS) {
		return new ScriptPort<ApiMessage>(ns, API_PORT);
	}
	static open_reply_port(ns: NS) {
		return new ScriptPort<OnlineCheckMsg>(ns, REPLY_PORT);
	}
	static open_request_port(ns: NS) {
		return new ScriptPort<PortMessage>(ns, REQUEST_PORT);
	}
	readonly ns: NS;
	port_id: number;
	readonly #port: NS_Port;
	private logging = false;

	constructor(ns: NS, port_id: number) {
		this.ns = ns;
		this.port_id = port_id;
		this.#port = ns.getPortHandle(port_id);
	}

	config({ logging }: { logging: boolean }) {
		this.logging = logging;
	}

	private log(
		user_msg: string | undefined,
		port: keyof ScriptPort<BaseType>,
		...args: any[]
	) {
		if (!this.logging) return;
		this.ns.tprint(
			`port(${this.port_id}).${port}()${
				user_msg == null ? "" : ` ${user_msg}`
			}`,
			...args,
		);
	}

	peek<T extends BaseType = BaseType>(log_msg?: string): T {
		const data = rawPeek<T>(this.#port);
		this.log(log_msg, "peek", data);
		if (data === void 0) throw new PortEmptyError(this.port_id);
		return data;
	}

	read<T extends BaseType = BaseType>(log_msg?: string): T {
		const data = rawRead<T>(this.#port);
		this.log(log_msg, "read", data);
		if (data === void 0) throw new PortEmptyError(this.port_id);
		return data;
	}

	tryRead<T extends BaseType = BaseType>(log_msg?: string): T | undefined {
		const data = rawRead<T>(this.#port);
		this.log(log_msg, "tryRead", data);
		return data;
	}

	readOpt<T extends BaseType = BaseType>(log_msg?: string): Optional<T> {
		const data = rawReadOpt<T>(this.#port);
		this.log(log_msg, "readOpt", data);
		return data;
	}

	readAll<T extends BaseType = BaseType>(log_msg?: string): T[] {
		const results: T[] = [];
		for (;;) {
			const data = rawRead<T>(this.#port);
			if (data === void 0) break;
			results.push(data);
		}
		this.log(log_msg, "readAll", results);
		return results;
	}

	write<T extends BaseType = BaseType>(data: T, log_msg?: string): void {
		if (this.#port.full()) throw new PortFullError(this.port_id);
		const prev = rawWrite<T, Null>(this.#port, data);
		this.log(log_msg, "write", some_opt(data), "prev", some_opt(prev));
	}

	writePrev<T extends BaseType = BaseType>(
		data: T,
		log_msg?: string,
	): T | undefined {
		const prev = rawWrite<T>(this.#port, data);
		this.log(log_msg, "writePrev", some_opt(data), "prev", some_opt(prev));
		return fromRaw(prev);
	}

	writePrevOpt<T extends BaseType = BaseType>(
		data: T,
		log_msg?: string,
	): Optional<T> {
		const prev = rawWriteOpt<T>(this.#port, data);
		this.log(log_msg, "writePrevOpt", some_opt(data), "prev", prev);
		return prev;
	}

	tryWrite<T extends BaseType = BaseType>(
		data: T,
		log_msg?: string,
	): boolean {
		const success = this.#port.tryWrite(data);
		this.log(
			log_msg,
			"tryWrite",
			some_opt(data),
			success ? "success" : "failed",
		);
		return success;
	}

	nextWrite(log_msg?: string) {
		this.log(log_msg, "nextWrite");
		return this.#port.nextWrite();
	}

	full(log_msg?: string) {
		this.log(log_msg, "full");
		return this.#port.full();
	}

	empty(log_msg?: string) {
		this.log(log_msg, "empty");
		return this.#port.empty();
	}

	clear(log_msg?: string) {
		this.log(log_msg, "clear");
		this.#port.clear();
	}
}
