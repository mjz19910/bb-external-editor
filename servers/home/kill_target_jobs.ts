import { NS } from "./@ns";
import { getFleet } from "./gpt_pause/src/lib/fleet";

const WORKERS = new Set([
	"gpt_pause/src/hack_worker.ts",
	"gpt_pause/src/grow_worker.ts",
	"gpt_pause/src/weaken_worker.ts",
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
