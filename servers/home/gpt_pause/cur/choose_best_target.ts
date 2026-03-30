import { NS } from "./@ns";
import { buildNetworkMap, classifyServer } from "../../lib/network_map";

type TargetScore = {
	host: string;
	score: number;
	maxMoney: number;
	minSec: number;
	reqHack: number;
	growth: number;
};

export function chooseBestTarget(ns: NS): TargetScore | null {
	const map = buildNetworkMap(ns);
	const targets: TargetScore[] = [];

	for (const host of map.hosts) {
		if (classifyServer(ns, host) !== "farmable") continue;

		const maxMoney = ns.getServerMaxMoney(host);
		const minSec = ns.getServerMinSecurityLevel(host);
		const reqHack = ns.getServerRequiredHackingLevel(host);
		const growth = ns.getServerGrowth(host);

		if (maxMoney <= 0) continue;

		const score = (maxMoney * growth) / Math.max(1, minSec * reqHack);

		targets.push({
			host,
			score,
			maxMoney,
			minSec,
			reqHack,
			growth,
		});
	}

	targets.sort((a, b) => b.score - a.score);
	return targets[0] ?? null;
}

export async function main(ns: NS) {
	const best = chooseBestTarget(ns);
	if (!best) {
		ns.tprint("No farmable target found.");
		return;
	}

	ns.tprint(`Best target: ${best.host}`);
	ns.tprint(`Score: ${ns.format.number(best.score)}`);
	ns.tprint(`Max money: ${ns.format.number(best.maxMoney)}`);
	ns.tprint(`Min sec: ${best.minSec}`);
	ns.tprint(`Growth: ${best.growth}`);
	ns.tprint(`Req hack: ${best.reqHack}`);
}
