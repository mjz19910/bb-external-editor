import { NS } from "../../../@ns";
import {
	totalCoreUpgradeCost,
	totalCostForNewNodeToMatch,
	totalLevelUpgradeCost,
	totalRamUpgradeCost,
} from "./costs";
import { syncFleet } from "./fleet";
import {
	estimateCoreROI,
	estimateLevelROI,
	estimateNewNodeROI,
	estimateRamROI,
} from "./roi";

/** Pick best ROI and apply upgrade */
export function applyBestUpgrade(
	ns: NS,
	fleet: { level: number; ram: number; cores: number },
) {
	const h = ns.hacknet;
	const money = ns.getServerMoneyAvailable("home");
	const n = h.numNodes();
	const options: { type: string; cost: number; roi: number }[] = [];

	// Add affordable upgrades
	const lvlCost = totalLevelUpgradeCost(ns, 1);
	const ramCost = totalRamUpgradeCost(ns, 1);
	const coreCost = totalCoreUpgradeCost(ns, 1);
	const newNodeCost = totalCostForNewNodeToMatch(
		ns,
		fleet.level,
		fleet.ram,
		fleet.cores,
	);

	if (lvlCost <= money * 0.25) {
		options.push({
			type: "level",
			cost: lvlCost,
			roi: estimateLevelROI(ns, 1),
		});
	}
	if (ramCost <= money * 0.5) {
		options.push({
			type: "ram",
			cost: ramCost,
			roi: estimateRamROI(ns, 1),
		});
	}
	if (coreCost <= money * 0.5) {
		options.push({
			type: "core",
			cost: coreCost,
			roi: estimateCoreROI(ns, 1),
		});
	}
	if (newNodeCost <= money * 0.25) {
		options.push({
			type: "newNode",
			cost: newNodeCost,
			roi: estimateNewNodeROI(ns, fleet),
		});
	}

	if (options.length === 0) return;

	// Apply best ROI
	options.sort((a, b) => b.roi - a.roi);
	const best = options[0];
	switch (best.type) {
		case "level":
			for (let i = 0; i < n; i++) h.upgradeLevel(i, 1);
			ns.print("Upgraded all nodes +1 level");
			break;
		case "ram":
			for (let i = 0; i < n; i++) h.upgradeRam(i, 1);
			ns.print("Upgraded all nodes +1 RAM");
			break;
		case "core":
			for (let i = 0; i < n; i++) h.upgradeCore(i, 1);
			ns.print("Upgraded all nodes +1 Core");
			break;
		case "newNode":
			const idx = h.purchaseNode();
			if (idx !== -1) {
				ns.print(`Bought new node #${idx}`);
				syncFleet(ns, fleet);
			}
			break;
	}
}
