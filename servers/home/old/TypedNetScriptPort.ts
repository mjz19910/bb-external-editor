import { NetscriptPort } from "../NetscriptDefinitions.d";
import { assign_opt, empty_opt, Optional, some_opt } from "./helpers";

export const Null = "NULL PORT DATA" as const;
export type Null = typeof Null;
export type NS_Port = NetscriptPort;

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
	return port.peek();
}

export function readPort<T>(port: NS_Port): T | Null {
	return port.read();
}

export function writePort<TIn, TOut = TIn>(
	port: NS_Port,
	input: TIn,
): TOut | Null {
	return port.write(input);
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

export class TypedNSP {
	readonly ns: NS;
	readonly #port_id: number;
	readonly #port: NS_Port;
	private logging = false;

	constructor(ns: NS, port_id: number) {
		this.ns = ns;
		this.#port_id = port_id;
		this.#port = ns.getPortHandle(port_id);
	}

	get port_id() {
		return this.#port_id;
	}

	config({ logging }: { logging: boolean }) {
		this.logging = logging;
	}

	private log(
		user_msg: string | undefined,
		port: keyof TypedNSP,
		...args: any[]
	) {
		if (!this.logging) return;
		this.ns.tprint(
			`port(${this.#port_id}).${port}()${
				user_msg == null ? "" : ` ${user_msg}`
			}`,
			...args,
		);
	}

	peek<T>(log_msg?: string): T {
		const data = rawPeek<T>(this.#port);
		this.log(log_msg, "peek", data);
		if (data === void 0) throw new PortEmptyError(this.#port_id);
		return data;
	}

	read<T>(log_msg?: string): T {
		const data = rawRead<T>(this.#port);
		this.log(log_msg, "read", data);
		if (data === void 0) throw new PortEmptyError(this.#port_id);
		return data;
	}

	tryRead<T>(log_msg?: string): T | undefined {
		const data = rawRead<T>(this.#port);
		this.log(log_msg, "tryRead", data);
		return data;
	}

	readOpt<T>(log_msg?: string): Optional<T> {
		const data = rawReadOpt<T>(this.#port);
		this.log(log_msg, "readOpt", data);
		return data;
	}

	readAll<T>(log_msg?: string): T[] {
		const results: T[] = [];
		for (;;) {
			const data = rawRead<T>(this.#port);
			if (data === void 0) break;
			results.push(data);
		}
		this.log(log_msg, "readAll", results);
		return results;
	}

	write<T>(data: T, log_msg?: string): void {
		if (this.#port.full()) throw new PortFullError(this.#port_id);
		const prev = rawWrite<T, Null>(this.#port, data);
		this.log(log_msg, "write", some_opt(data), "prev", some_opt(prev));
	}

	writePrev<T>(data: T, log_msg?: string): T | undefined {
		const prev = rawWrite<T>(this.#port, data);
		this.log(log_msg, "writePrev", some_opt(data), "prev", some_opt(prev));
		return fromRaw(prev);
	}

	writePrevOpt<T>(data: T, log_msg?: string): Optional<T> {
		const prev = rawReadOpt<T>(this.#port.write(data));
		this.log(log_msg, "writePrevOpt", some_opt(data), "prev", prev);
		return prev;
	}

	tryWrite<T>(data: T, log_msg?: string): boolean {
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
