import { getFleet } from "./lib/fleet";
import { GROW, HACK, WEAKEN } from "./lib/paths";
import { chooseBestTarget } from "./lib/targeting";

const WORKERS = new Set([
	HACK,
	GROW,
	WEAKEN,
]);

const FARM_SCRIPT = "smart_farm.ts";

export async function main(ns: NS) {
	let newTarget = String(ns.args[0] ?? "");
	const hackPct = Number(ns.args[1] ?? 0.1);
	const killFarm = Boolean(ns.args[2] ?? true);

	if (!newTarget) {
		const best = chooseBestTarget(ns);
		if (!best) {
			ns.tprint("No farmable target found.");
			return;
		}
		newTarget = best.host;
	}

	const fleet = getFleet(ns);

	let killedThreads = 0;
	let killedProcs = 0;
	let killedFarmPids = 0;

	// Kill all worker jobs everywhere
	for (const host of fleet.hosts) {
		for (const p of ns.ps(host.host)) {
			if (WORKERS.has(p.filename)) {
				if (ns.kill(p.pid)) {
					killedThreads += p.threads ?? 1;
					killedProcs++;
				}
			}
		}
	}

	// Kill running smart_farm.ts on home if requested
	if (killFarm) {
		for (const p of ns.ps("home")) {
			if (p.filename !== FARM_SCRIPT) continue;

			if (ns.kill(p.pid)) {
				killedFarmPids++;
				ns.tprint(
					`[KILLED FARM] pid=${p.pid} args=${JSON.stringify(p.args)}`,
				);
			}
		}
	}

	ns.tprint(
		`Killed ${killedProcs} worker processes / ${killedThreads} worker threads.`,
	);

	if (killFarm) {
		ns.tprint(`Killed ${killedFarmPids} smart_farm processes.`);
	}

	const pid = ns.exec(FARM_SCRIPT, "home", 1, newTarget, hackPct);
	if (pid === 0) {
		ns.tprint(
			`[ERROR] Failed to launch ${FARM_SCRIPT} ${newTarget} ${hackPct}`,
		);
		return;
	}

	ns.tprint(
		`[RESTARTED] ${FARM_SCRIPT} target=${newTarget} hackPct=${hackPct} pid=${pid}`,
	);
}
