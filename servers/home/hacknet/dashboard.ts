import { getFleetIncome, getFleetStats } from "./fleet";
import {
	totalCoreUpgradeCost,
	totalCostForNewNodeToMatch,
	totalLevelUpgradeCost,
	totalRamUpgradeCost,
} from "./costs";
import {
	estimateCoreROI,
	estimateLevelROI,
	estimateNewNodeROI,
	estimateRamROI,
} from "./roi";
import { formatNumber, formatTime } from "./format";

/** Display hacknet fleet diagnostics and compute upgrade ROI */
export function dashboard(ns: NS) {
	const money = ns.getServerMoneyAvailable("home");
	const h = ns.hacknet;
	const n = h.numNodes();
	const fleet = getFleetStats(ns);
	const income = getFleetIncome(ns) || 1;

	// Compute costs
	const lvlCost = totalLevelUpgradeCost(ns, 1);
	const ramCost = totalRamUpgradeCost(ns, 1);
	const coreCost = totalCoreUpgradeCost(ns, 1);
	const newNodeCost = totalCostForNewNodeToMatch(
		ns,
		fleet.level,
		fleet.ram,
		fleet.cores,
	);

	ns.clearLog();
	ns.print(`--- Hacknet Fleet Dashboard ---`);
	ns.print(`Nodes: ${n}`);
	ns.print(
		`Fleet Target -> Level: ${fleet.level}, RAM: ${fleet.ram}, Cores: ${fleet.cores}`,
	);
	ns.print(`Money: ${formatNumber(ns, money)}`);
	ns.print(`Income/sec: ${formatNumber(ns, income)}`);

	// Upgrade info
	ns.print(
		`Level +1: ${formatNumber(ns, lvlCost)} | Time: ${
			formatTime((lvlCost - money) / income)
		}`,
	);
	ns.print(
		`RAM +1: ${formatNumber(ns, ramCost)} | Time: ${
			formatTime((ramCost - money) / income)
		}`,
	);
	ns.print(
		`Core +1: ${formatNumber(ns, coreCost)} | Time: ${
			formatTime((coreCost - money) / income)
		}`,
	);
	ns.print(
		`New Node: ${formatNumber(ns, newNodeCost)} | Time: ${
			formatTime((newNodeCost - money) / income)
		}`,
	);

	// ROI
	ns.print(`--- Estimated ROI (Production Gain / Cost) ---`);
	ns.print(`Level +1 ROI: ${estimateLevelROI(ns, 1).toFixed(4)}`);
	ns.print(`RAM +1 ROI: ${estimateRamROI(ns, 1).toFixed(4)}`);
	ns.print(`Core +1 ROI: ${estimateCoreROI(ns, 1).toFixed(4)}`);
	ns.print(`New Node ROI: ${estimateNewNodeROI(ns, fleet).toFixed(4)}`);
}
