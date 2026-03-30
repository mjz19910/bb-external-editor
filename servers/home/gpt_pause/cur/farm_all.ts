import {
	buildNetworkMap,
	canRunThreads,
	runnableHosts,
} from "../src/lib/network_map";
import { chooseBestTarget } from "./choose_best_target";
import { log, tlog } from "../src/lib/log";
import { NS } from "./@ns";

const HACK = "hack_worker.ts";
const GROW = "grow_worker.ts";
const WEAKEN = "weaken_worker.ts";

export async function main(ns: NS) {
	let target = String(ns.args[0] ?? "");

	if (!target) {
		const best = chooseBestTarget(ns);
		if (!best) {
			ns.tprint("No valid target found.");
			return;
		}
		target = best.host;
	}

	tlog(ns, `[FARM] target=${target}`);
	tlog(ns, `[FARM] prep target first for best results`);

	const map = buildNetworkMap(ns);
	const runners = runnableHosts(ns, map, map.hosts);

	for (const r of runners) {
		ns.scp([HACK, GROW, WEAKEN], r, "home");
	}

	while (true) {
		const money = ns.getServerMoneyAvailable(target);
		const maxMoney = ns.getServerMaxMoney(target);
		const sec = ns.getServerSecurityLevel(target);
		const minSec = ns.getServerMinSecurityLevel(target);

		let script = WEAKEN;

		if (sec > minSec + 3) {
			script = WEAKEN;
		} else if (money < maxMoney * 0.85) {
			script = GROW;
		} else {
			script = HACK;
		}

		let launched = 0;

		for (const host of runners) {
			const threads = canRunThreads(ns, map, host, script);
			if (threads < 1) continue;

			const pid = ns.exec(script, host, threads, target);
			if (pid !== 0) launched += threads;
		}

		log(
			ns,
			`[FARM] target=${target} ` +
				`money=${ns.format.number(money)}/${
					ns.format.number(maxMoney)
				} ` +
				`sec=${sec.toFixed(2)}/${minSec.toFixed(2)} ` +
				`script=${script} threads=${launched}`,
		);

		if (launched === 0) {
			await ns.sleep(5000);
			continue;
		}

		const sleepMs = script === WEAKEN
			? ns.getWeakenTime(target)
			: script === GROW
			? ns.getGrowTime(target)
			: ns.getHackTime(target);

		await ns.sleep(Math.max(1000, sleepMs * 0.25));
	}
}
