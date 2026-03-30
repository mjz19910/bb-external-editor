import { NS } from "../../../@ns";
import { dashboard } from "./dashboard";
import { getFleetStats, syncFleet } from "./fleet";
import { applyBestUpgrade } from "./upgrade";

export async function main(ns: NS) {
	ns.disableLog("sleep");
	ns.disableLog("getServerMoneyAvailable");

	while (true) {
		const fleet = getFleetStats(ns);
		// Sync nodes to fleet standard
		if (syncFleet(ns, fleet)) {
			await ns.sleep(200);
			continue;
		}

		// Show dashboard
		dashboard(ns);

		// Apply best ROI upgrade
		applyBestUpgrade(ns, fleet);

		await ns.sleep(2000);
	}
}
