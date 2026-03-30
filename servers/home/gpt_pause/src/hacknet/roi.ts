import { NS } from "../../../@ns";
import {
	totalCoreUpgradeCost,
	totalCostForNewNodeToMatch,
	totalLevelUpgradeCost,
	totalRamUpgradeCost,
} from "./costs";

/** Simple heuristic: production ~ level * sqrt(ram) * sqrt(cores) */
export function prod(level: number, ram: number, cores: number) {
	return level * Math.sqrt(ram) * Math.sqrt(cores);
}

export function estimateLevelROI(ns: NS, lvls: number) {
	const h = ns.hacknet;
	let gain = 0;
	for (let i = 0; i < h.numNodes(); i++) {
		const s = h.getNodeStats(i);
		gain += prod(s.level + lvls, s.ram, s.cores) -
			prod(s.level, s.ram, s.cores);
	}
	return gain / totalLevelUpgradeCost(ns, lvls);
}

export function estimateRamROI(ns: NS, steps: number) {
	const h = ns.hacknet;
	let gain = 0;
	for (let i = 0; i < h.numNodes(); i++) {
		const s = h.getNodeStats(i);
		gain += prod(s.level, s.ram * (2 ** steps), s.cores) -
			prod(s.level, s.ram, s.cores);
	}
	return gain / totalRamUpgradeCost(ns, steps);
}

export function estimateCoreROI(ns: NS, gain: number) {
	const h = ns.hacknet;
	let totalGain = 0;
	for (let i = 0; i < h.numNodes(); i++) {
		const s = h.getNodeStats(i);
		totalGain += prod(s.level, s.ram, s.cores + gain) -
			prod(s.level, s.ram, s.cores);
	}
	return totalGain / totalCoreUpgradeCost(ns, gain);
}

export function estimateNewNodeROI(
	ns: NS,
	fleet: { level: number; ram: number; cores: number },
) {
	return prod(fleet.level, fleet.ram, fleet.cores) /
		totalCostForNewNodeToMatch(ns, fleet.level, fleet.ram, fleet.cores);
}
