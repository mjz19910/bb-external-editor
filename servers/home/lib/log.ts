export function log(ns: NS, msg: string) {
	ns.print(msg);
}

export function tlog(ns: NS, msg: string) {
	ns.tprint(msg);
}

export function fmtMoney(ns: NS, n: number): string {
	return ns.format.number(n);
}

export function fmtRam(ns: NS, n: number): string {
	return `${ns.format.number(n)}GB`;
}
