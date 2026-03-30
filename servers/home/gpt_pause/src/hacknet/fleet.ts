import { NS } from ".././@ns";
import { logUpgrade } from "./logging";

export function getFleetStats(ns: NS) {
	const h = ns.hacknet;
	if (h.numNodes() === 0) return { level: 1, ram: 1, cores: 1 };
	const s = h.getNodeStats(0);
	return { level: s.level, ram: s.ram, cores: s.cores };
}

export function syncFleet(
	ns: NS,
	fleet: { level: number; ram: number; cores: number },
	verbose = true,
): boolean {
	const changedLevel = syncLevels(ns, fleet.level, verbose);
	const changedRam = syncRam(ns, fleet.ram, verbose);
	const changedCores = syncCores(ns, fleet.cores, verbose);
	return changedLevel || changedRam || changedCores;
}

export function syncLevels(ns: NS, target: number, verbose = true): boolean {
	const h = ns.hacknet;
	let changed = false;
	const money = ns.getServerMoneyAvailable("home");

	for (let i = 0; i < h.numNodes(); i++) {
		const cur = h.getNodeStats(i).level;
		if (cur >= target) continue;

		const cost = h.getLevelUpgradeCost(i, target - cur);
		if (money < cost) continue;

		h.upgradeLevel(i, target - cur);
		changed = true;
		if (verbose) logUpgrade(ns, "level", i, cur, target, cost);
	}
	return changed;
}

export function syncRam(ns: NS, target: number, verbose = true): boolean {
	const h = ns.hacknet;
	let changed = false;
	const money = ns.getServerMoneyAvailable("home");

	for (let i = 0; i < h.numNodes(); i++) {
		let cur = h.getNodeStats(i).ram;
		if (cur >= target) continue;

		let steps = 0;
		let tmp = cur;
		while (tmp < target) {
			tmp *= 2;
			steps++;
		}
		const cost = h.getRamUpgradeCost(i, steps);
		if (money < cost) continue;

		h.upgradeRam(i, steps);
		changed = true;
		if (verbose) logUpgrade(ns, "ram", i, cur, target, cost);
	}
	return changed;
}

export function syncCores(ns: NS, target: number, verbose = true): boolean {
	const h = ns.hacknet;
	let changed = false;
	const money = ns.getServerMoneyAvailable("home");

	for (let i = 0; i < h.numNodes(); i++) {
		const cur = h.getNodeStats(i).cores;
		if (cur >= target) continue;

		const cost = h.getCoreUpgradeCost(i, target - cur);
		if (money < cost) continue;

		h.upgradeCore(i, target - cur);
		changed = true;
		if (verbose) logUpgrade(ns, "core", i, cur, target, cost);
	}
	return changed;
}

export function getFleetIncome(ns: NS): number {
	const h = ns.hacknet;
	let income = 0;
	for (let i = 0; i < h.numNodes(); i++) {
		income += h.getNodeStats(i).production;
	}
	return income;
}
