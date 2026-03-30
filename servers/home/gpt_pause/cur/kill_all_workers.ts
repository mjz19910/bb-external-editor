import { NS } from "../../@ns";
import { getFleet } from "../lib/fleet";

const WORKERS = new Set([
	"hack_worker.ts",
	"grow_worker.ts",
	"weaken_worker.ts",
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
