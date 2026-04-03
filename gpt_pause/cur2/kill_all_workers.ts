import { getFleet } from "../../servers/home/src2/fleet";
import { GROW, HACK, WEAKEN } from "../../servers/home/src2/paths";

const WORKERS = new Set([
	HACK,
	GROW,
	WEAKEN,
]);

export async function main(ns: NS) {
	const fleet = getFleet(ns);

	let killedThreads = 0;
	let killedProcs = 0;

	for (const host of fleet.hosts) {
		for (const p of ns.ps(host.host)) {
			if (!WORKERS.has(p.filename)) continue;

			if (ns.kill(p.pid)) {
				killedThreads += p.threads ?? 1;
				killedProcs++;
				ns.tprint(
					`[KILLED] ${host.host} pid=${p.pid} ${p.filename} x${p.threads}`,
				);
			}
		}
	}

	ns.tprint(
		`Killed ${killedProcs} worker processes / ${killedThreads} threads total.`,
	);
}
