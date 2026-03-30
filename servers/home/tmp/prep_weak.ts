import { NS } from "../@ns";

/** prep_weak.ts */
export async function main(ns: NS) {
	const f = ns.flags([["v", false]]);
	const verbose = !!f.v;
	const target = ns.args[0];
	const threads = ns.args[1];
	if (typeof target !== "string") return;
	if (typeof threads != "number") return;
	if (verbose) {
		const start = Date.now();
		await ns.weaken(target, { threads });
		const end = Date.now();

		ns.tprint(
			`[weaken] target=${target} threads=${threads} ${
				ns.format.time(end - start)
			}`,
		);
	} else {
		await ns.weaken(target);
	}
}
