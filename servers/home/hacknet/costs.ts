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
	let levelCost = 0;
	for (let lvl = 1; lvl < targetLevel; lvl++) {
		levelCost += ns.hacknet.getLevelUpgradeCost(0);
	}

	let ramCost = 0;
	let curRam = 1;
	while (curRam < targetRam) {
		ramCost += ns.hacknet.getRamUpgradeCost(0);
		curRam *= 2;
	}

	const coreCost = ns.hacknet.getCoreUpgradeCost(0, targetCores - 1);
	return baseCost + levelCost + ramCost + coreCost;
}
