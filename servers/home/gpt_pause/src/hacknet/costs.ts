
export function totalLevelUpgradeCost(ns: NS, levels: number) {
	const h = ns.hacknet;
	let total = 0;
	for (let i = 0; i < h.numNodes(); i++) {
		total += h.getLevelUpgradeCost(i, levels);
	}
	return total;
}

export function totalRamUpgradeCost(ns: NS, steps: number) {
	const h = ns.hacknet;
	let total = 0;
	for (let i = 0; i < h.numNodes(); i++) {
		total += h.getRamUpgradeCost(i, steps);
	}
	return total;
}

export function totalCoreUpgradeCost(ns: NS, cores: number) {
	const h = ns.hacknet;
	let total = 0;
	for (let i = 0; i < h.numNodes(); i++) {
		total += h.getCoreUpgradeCost(i, cores);
	}
	return total;
}

export function totalCostForNewNodeToMatch(
	ns: NS,
	targetLevel: number,
	targetRam: number,
	targetCores: number,
): number {
	const baseCost = ns.hacknet.getPurchaseNodeCost();
	const costs = [baseCost];
	const level_upg_cost = ns.hacknet.getLevelUpgradeCost(0);
	if (Number.isFinite(level_upg_cost)) {
		costs.push(level_upg_cost * targetLevel);
	}

	let ramCostMul = 0;
	let curRam = 1;
	while (curRam < targetRam) {
		ramCostMul++;
		curRam *= 2;
	}
	const ram_upg_cost = ns.hacknet.getRamUpgradeCost(0);
	if (Number.isFinite(ram_upg_cost)) {
		costs.push(ram_upg_cost * targetRam);
	}

	const coreCost = ns.hacknet.getCoreUpgradeCost(0);
	if (Number.isFinite(coreCost)) {
		costs.push(coreCost * (targetCores - 1));
	}
	return costs.reduce((a, b) => a + b, 0);
}
