import { buildNetworkMap, classifyServer } from "../lib/network_map";

type TargetScore = {
	host: string;
	score: number;
	maxMoney: number;
	sec: number;
	minSec: number;
	reqHack: number;
};

export async function main(ns: NS) {
	const map = buildNetworkMap(ns);

	const targets: TargetScore[] = [];

	for (const host of map.hosts) {
		if (classifyServer(ns, host) !== "farmable") continue;

		const maxMoney = ns.getServerMaxMoney(host);
		const minSec = ns.getServerMinSecurityLevel(host);
		const sec = ns.getServerSecurityLevel(host);
		const reqHack = ns.getServerRequiredHackingLevel(host);

		if (maxMoney <= 0) continue;

		const growth = ns.getServerGrowth(host);
		const score = (maxMoney * growth) / Math.max(1, minSec * reqHack);

		targets.push({
			host,
			score,
			maxMoney,
			minSec,
			sec,
			reqHack,
		});
	}

	targets.sort((a, b) => a.minSec - b.minSec);

	if (targets.length === 0) {
		ns.tprint("No farmable targets found.");
		return;
	}

	ns.tprint("=== TARGETS (Minimum Security) ===");
	for (const t of targets.slice(0, 15)) {
		ns.tprint(
			`${t.host.padEnd(20)} ` +
				`money=${ns.format.number(t.maxMoney)} ` +
				`minSec=${t.minSec.toFixed(1)} ` +
				`sec=${t.sec.toFixed(1)} ` +
				`hack=${t.reqHack}`,
		);
	}
}
