import { canRunThreads, runnableHosts } from "../lib/network_map";
import { buildNetworkMap } from "../lib/network_map";
import { log, tlog } from "../lib/log";
import { NS } from "../../@ns";

const WEAKEN = "weaken_worker.ts";
const GROW = "grow_worker.ts";

export async function main(ns: NS) {
	const target = String(ns.args[0] ?? "");
	if (!target) {
		ns.tprint("Usage: run prep_target.ts <target>");
		return;
	}

	const map = buildNetworkMap(ns);
	const runners = runnableHosts(ns, map.hosts);

	for (const r of runners) {
		await ns.scp([WEAKEN, GROW], r, "home");
	}

	while (true) {
		const sec = ns.getServerSecurityLevel(target);
		const minSec = ns.getServerMinSecurityLevel(target);
		const money = ns.getServerMoneyAvailable(target);
		const maxMoney = ns.getServerMaxMoney(target);

		const secBad = sec > minSec + 2;
		const moneyBad = money < maxMoney * 0.95;

		if (!secBad && !moneyBad) {
			tlog(ns, `[PREP DONE] ${target}`);
			return;
		}

		const script = secBad ? WEAKEN : GROW;
		let launched = 0;

		for (const host of runners) {
			const threads = canRunThreads(ns, host, script);
			if (threads < 1) continue;

			const pid = ns.exec(script, host, threads, target);
			if (pid !== 0) launched += threads;
		}

		log(
			ns,
			`[PREP] target=${target} ` +
				`money=${ns.format.number(money)}/${
					ns.format.number(maxMoney)
				} ` +
				`sec=${sec.toFixed(2)}/${minSec.toFixed(2)} ` +
				`script=${script} threads=${launched}`,
		);

		if (launched === 0) {
			tlog(ns, `[PREP] no threads available`);
			await ns.sleep(5000);
			continue;
		}

		const sleepMs = secBad
			? ns.getWeakenTime(target)
			: ns.getGrowTime(target);
		await ns.sleep(sleepMs + 200);
	}
}
