import { NS } from "./@ns";
import { nextAffordableRamUpgrade, worstPurchasedServer } from "./lib/pservs";

export async function main(ns: NS) {
	const reserve = Number(ns.args[0] ?? 0);
	const minRam = Number(ns.args[1] ?? 8);

	const money = ns.getServerMoneyAvailable("home");
	const budget = Math.max(0, money - reserve);

	const worst = worstPurchasedServer(ns);
	if (!worst) {
		ns.tprint("No purchased servers found.");
		return;
	}

	const ram = nextAffordableRamUpgrade(ns, worst.host, budget, minRam);
	if (ram <= 0) {
		ns.tprint("Cannot afford any upgrade.");
		return;
	}

	if (ram <= worst.ram) {
		ns.tprint(
			`No worthwhile upgrade. Worst=${worst.host} ${worst.ram}GB, affordable=${ram}GB`,
		);
		return;
	}

	const cost = ns.cloud.getServerUpgradeCost(worst.host, ram);
	ns.tprint(
		`Upgrading ${worst.host} from ${worst.ram}GB -> ${ram}GB for ${
			ns.format.number(cost)
		}`,
	);

	const succuss = ns.cloud.upgradeServer(worst.host, ram);
	if (!succuss) {
		ns.tprint(`[FAIL] Could not upgrade ${worst.host} to ${ram}GB`);
		return;
	}

	ns.tprint(`[UPGRADED] ${succuss} now ${ram}GB`);
}
