export type HacknetUpgradeKind =
	| "new"
	| "level"
	| "ram"
	| "core"
	| "cache";

export type HacknetOption = {
	kind: HacknetUpgradeKind;
	node: number; // -1 for new node
	cost: number;
	gain: number; // estimated production gain/sec
	roi: number; // gain / cost
	label: string;
};

export type HacknetNodeInfo = {
	index: number;
	stats: NodeStats;
};

export function getHacknetNodes(ns: NS): HacknetNodeInfo[] {
	const out: HacknetNodeInfo[] = [];
	const n = ns.hacknet.numNodes();

	for (let i = 0; i < n; i++) {
		const s = ns.hacknet.getNodeStats(i);
		out.push({
			index: i,
			stats: s,
		});
	}

	return out;
}

/**
 * Rough production estimate using current production and hypothetical upgrade.
 * This avoids needing to hardcode internal formulas.
 */
function estimateGainFromLevel(ns: NS, i: number, amount = 1): number {
	const s = ns.hacknet.getNodeStats(i);
	const before = s.production;

	// Approximation: production scales near-linearly with level
	const after = before * ((s.level + amount) / Math.max(1, s.level));
	return Math.max(0, after - before);
}

function estimateGainFromRam(ns: NS, i: number, amount = 1): number {
	const s = ns.hacknet.getNodeStats(i);
	const before = s.production;

	// RAM doubles each upgrade step in Hacknet Nodes
	const afterRam = s.ram * Math.pow(2, amount);
	const ratio = afterRam / Math.max(1, s.ram);
	const after = before * ratio;

	return Math.max(0, after - before);
}

function estimateGainFromCore(ns: NS, i: number, amount = 1): number {
	const s = ns.hacknet.getNodeStats(i);
	const before = s.production;

	// Approximation: cores improve multiplicatively but weaker than RAM
	const after = before * ((s.cores + amount + 4) / (s.cores + 4));
	return Math.max(0, after - before);
}

function estimateGainFromCache(_ns: NS, _i: number, _amount = 1): number {
	// Cache does not directly improve production
	return 0;
}

export function getHacknetOptions(ns: NS): HacknetOption[] {
	const options: HacknetOption[] = [];
	const count = ns.hacknet.numNodes();

	// New node option
	const newCost = ns.hacknet.getPurchaseNodeCost();
	if (isFinite(newCost) && newCost > 0) {
		// Estimate new node gain based on fresh node baseline
		const estimatedGain = count > 0
			? Math.max(0.001, getHacknetNodes(ns)[0].stats.production ?? 1)
			: 1;

		options.push({
			kind: "new",
			node: -1,
			cost: newCost,
			gain: estimatedGain,
			roi: estimatedGain / newCost,
			label: `new node`,
		});
	}

	for (let i = 0; i < count; i++) {
		const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
		if (isFinite(levelCost) && levelCost > 0) {
			const gain = estimateGainFromLevel(ns, i, 1);
			options.push({
				kind: "level",
				node: i,
				cost: levelCost,
				gain,
				roi: gain / levelCost,
				label: `node ${i} +1 level`,
			});
		}

		const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
		if (isFinite(ramCost) && ramCost > 0) {
			const gain = estimateGainFromRam(ns, i, 1);
			options.push({
				kind: "ram",
				node: i,
				cost: ramCost,
				gain,
				roi: gain / ramCost,
				label: `node ${i} x2 ram`,
			});
		}

		const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
		if (isFinite(coreCost) && coreCost > 0) {
			const gain = estimateGainFromCore(ns, i, 1);
			options.push({
				kind: "core",
				node: i,
				cost: coreCost,
				gain,
				roi: gain / coreCost,
				label: `node ${i} +1 core`,
			});
		}

		const cacheCost = ns.hacknet.getCacheUpgradeCost(i, 1);
		if (isFinite(cacheCost) && cacheCost > 0) {
			const gain = estimateGainFromCache(ns, i, 1);
			options.push({
				kind: "cache",
				node: i,
				cost: cacheCost,
				gain,
				roi: gain / Math.max(1, cacheCost),
				label: `node ${i} +1 cache`,
			});
		}
	}

	return options.filter((o) => isFinite(o.cost) && o.cost > 0);
}

export function chooseBestHacknetOption(ns: NS): HacknetOption | null {
	const options = getHacknetOptions(ns)
		.filter((o) => o.gain > 0)
		.sort((a, b) => b.roi - a.roi || a.cost - b.cost);

	return options[0] ?? null;
}

export function applyHacknetOption(ns: NS, opt: HacknetOption): boolean {
	switch (opt.kind) {
		case "new":
			return ns.hacknet.purchaseNode() !== -1;
		case "level":
			return ns.hacknet.upgradeLevel(opt.node, 1);
		case "ram":
			return ns.hacknet.upgradeRam(opt.node, 1);
		case "core":
			return ns.hacknet.upgradeCore(opt.node, 1);
		case "cache":
			return ns.hacknet.upgradeCache(opt.node, 1);
		default:
			return false;
	}
}
