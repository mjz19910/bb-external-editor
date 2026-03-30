export function parseString(value: unknown, name = "value"): string {
	if (typeof value !== "string") {
		throw new Error(`Invalid ${name}: ${String(value)} (expected string)`);
	}
	return value;
}

export function parseNumber(value: unknown, name = "value"): number {
	const n = Number(value);

	if (!Number.isFinite(n)) {
		throw new Error(`Invalid ${name}: ${String(value)} (expected finite number)`);
	}

	return n;
}

export function parseInteger(value: unknown, name = "value"): number {
	const n = Number(value);

	if (!Number.isInteger(n)) {
		throw new Error(`Invalid ${name}: ${String(value)} (expected integer)`);
	}

	return n;
}

export function parsePort(value: unknown, name = "port"): number {
	const n = Number(value);

	if (!Number.isInteger(n) || n < 1 || n > 20) {
		throw new Error(`Invalid ${name}: ${String(value)} (expected integer 1-20)`);
	}

	return n;
}

export const Arg = {
	string: parseString,
	number: parseNumber,
	int: parseInteger,
	port: parsePort,
};
