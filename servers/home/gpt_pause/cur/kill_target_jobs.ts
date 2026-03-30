import { NS } from "./@ns";
import { getFleet } from "../src/lib/fleet";

const WORKERS = new Set([
	"hack_worker.ts",
	"grow_worker.ts",
	"weaken_worker.ts",
]);

export async function main(ns: NS) {
	const target = String(ns.args[0] ?? "");
	if (!target) {
		ns.tprint("Usage: run kill_target_jobs.ts <target>");
		return;
	}

	const fleet = getFleet(ns);

	let killed = 0;

	for (const host of fleet.hosts) {
		for (const p of ns.ps(host.host)) {
			if (!WORKERS.has(p.filename)) continue;
			if (String(p.args?.[0] ?? "") !== target) continue;

			if (ns.kill(p.pid)) {
				killed += p.threads ?? 1;
				ns.tprint(
					`[KILLED] ${host.host} pid=${p.pid} ${p.filename} x${p.threads}`,
				);
			}
		}
	}

	ns.tprint(`Killed ${killed} worker threads for target=${target}`);
}
