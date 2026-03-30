
// port.ts
export class PortEmptyError extends Error {
	constructor() {
		super(`Unexpected "NULL PORT DATA"`);
		this.name = "PortEmptyError";
	}
}

export class Com<T> {
	#port: NetscriptPort;

	constructor(ns: NS, portId: number) {
		this.#port = ns.getPortHandle(portId);
	}

	write(value: T) {
		return this.#port.write(value);
	}
	tryWrite(value: T) {
		return this.#port.tryWrite(value);
	}

	peek(): T {
		const data = this.#port.peek();
		if (data === "NULL PORT DATA") throw new PortEmptyError();
		return data;
	}

	read(): T {
		const data = this.#port.read();
		if (data === "NULL PORT DATA") throw new PortEmptyError();
		return data;
	}

	readOrUndefined(): T | undefined {
		const data = this.#port.read();
		return data === "NULL PORT DATA" ? undefined : data;
	}

	readAll(): T[] {
		const results: T[] = [];
		for (;;) {
			const data = this.#port.read();
			if (data === "NULL PORT DATA") break;
			results.push(data);
		}
		return results;
	}

	full() {
		return this.#port.full();
	}
	empty() {
		return this.#port.empty();
	}
	clear() {
		return this.#port.clear();
	}
	nextWrite() {
		return this.#port.nextWrite();
	}
}
