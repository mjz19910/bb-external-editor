/** /cloud/upgrade.ts */
export async function main(ns: NS) {
	ns.disableLog("ALL");
	ns.ui.openTail();

	const BOOTSTRAP_SCRIPT = "/cloud/bootstrap_cloud.ts";
	const CATCHUP_BUDGET_RATIO = 0.01; // 1%

	let hosts = ns.cloud.getServerNames();
	if (hosts.length === 0) {
		ns.print("no servers found, spawning bootstrap");
		ns.spawn(BOOTSTRAP_SCRIPT, 1);
		return;
	}

	const ramSizes: Record<string, number> = {};
	for (const host of hosts) {
		ramSizes[host] = ns.getServerMaxRam(host);
	}

	const sortHosts = () =>
		hosts.sort((a, b) => ramSizes[a] - ramSizes[b] || a.localeCompare(b));

	sortHosts();

	const calcWidth = (chars: number) => chars * (16 / 2.5) + 3;
	const calcHeight = (lines: number) => 35 + 24 * lines;
	const width = calcWidth(63) + 61.185;
	const maxHeight = Math.max(220, ns.ui.windowSize()[1] - 160);

	let lines = 1;
	ns.print("-".repeat(47));
	ns.ui.resizeTail(width, Math.min(maxHeight, calcHeight(lines)));
	ns.ui.moveTail(280, 70);

	const getMinRam = () => {
		let min = Infinity;
		for (const host of hosts) {
			const ram = ramSizes[host];
			if (ram < min) min = ram;
		}
		return min;
	};

	const getTierTargets = (targetRam: number) =>
		hosts.filter((host) => ramSizes[host] < targetRam);

	const getTierCost = (targetRam: number) => {
		let total = 0;
		for (const host of hosts) {
			if (ramSizes[host] >= targetRam) continue;
			const cost = ns.cloud.getServerUpgradeCost(host, targetRam);
			if (cost < 0) return -1;
			total += cost;
		}
		return total;
	};

	const startingMoney = ns.getServerMoneyAvailable("home");
	const catchupBudget = Math.max(0, startingMoney * CATCHUP_BUDGET_RATIO);

	let reqRam = getMinRam() * 2;
	let spent = 0;
	let tiersTouched = 0;

	ns.print("starting money ", ns.format.number(startingMoney));
	lines++;
	ns.print("catch-up budget ", ns.format.number(catchupBudget));
	lines++;
	ns.print("starting target tier ", ns.format.ram(reqRam));
	lines++;

	wl: while (true) {
		sortHosts();

		const tierTargets = getTierTargets(reqRam);
		if (tierTargets.length === 0) {
			reqRam *= 2;
			await ns.sleep(50);
			continue;
		}

		const tierCost = getTierCost(reqRam);
		if (tierCost < 0) {
			ns.print("neg tier cost ", ns.format.ram(reqRam));
			lines++;
			break;
		}

		const budgetLeft = catchupBudget - spent;
		if (budgetLeft <= 0) {
			ns.print("budget exhausted");
			lines++;
			break;
		}

		ns.print(
			"tier ",
			ns.format.ram(reqRam),
			" total ",
			ns.format.number(tierCost),
			" budget left ",
			ns.format.number(budgetLeft),
		);
		lines++;

		let upgradedThisTier = 0;

		// Case 1: Full tier fits in remaining budget
		if (tierCost <= budgetLeft) {
			for (const host of hosts) {
				if (ramSizes[host] >= reqRam) continue;

				const ramUpgradeCost = ns.cloud.getServerUpgradeCost(
					host,
					reqRam,
				);
				if (ramUpgradeCost < 0) {
					ns.print("neg cost ", [host, reqRam, ramSizes[host]]);
					lines++;
					break wl;
				}

				const liveMoney = ns.getServerMoneyAvailable("home");
				if (liveMoney < ramUpgradeCost) {
					ns.print("not enough live money for ", host);
					lines++;
					break wl;
				}

				ns.print(
					host,
					" upgrade cost ",
					ns.format.number(ramUpgradeCost),
				);
				lines++;

				const ok = ns.cloud.upgradeServer(host, reqRam);
				if (!ok) {
					ns.print("upgrade failed ", [host, reqRam]);
					lines++;
					break wl;
				}

				ramSizes[host] = reqRam;
				spent += ramUpgradeCost;
				upgradedThisTier++;

				ns.print(host, " upgraded to ", ns.format.ram(reqRam));
				lines++;
			}

			if (upgradedThisTier > 0) {
				tiersTouched++;
				reqRam *= 2;
				await ns.sleep(50);
				continue;
			}

			break;
		}

		// Case 2: Full tier does NOT fit -> partial lowest-tier catch-up
		ns.print("partial tier upgrade mode");
		lines++;

		for (const host of hosts) {
			if (ramSizes[host] >= reqRam) continue;

			const ramUpgradeCost = ns.cloud.getServerUpgradeCost(host, reqRam);
			if (ramUpgradeCost < 0) {
				ns.print("neg cost ", [host, reqRam, ramSizes[host]]);
				lines++;
				break wl;
			}

			if (spent + ramUpgradeCost > catchupBudget) continue;

			const liveMoney = ns.getServerMoneyAvailable("home");
			if (liveMoney < ramUpgradeCost) {
				ns.print("not enough live money for ", host);
				lines++;
				break wl;
			}

			ns.print(
				host,
				" partial upgrade cost ",
				ns.format.number(ramUpgradeCost),
			);
			lines++;

			const ok = ns.cloud.upgradeServer(host, reqRam);
			if (!ok) {
				ns.print("upgrade failed ", [host, reqRam]);
				lines++;
				break wl;
			}

			ramSizes[host] = reqRam;
			spent += ramUpgradeCost;
			upgradedThisTier++;

			ns.print(host, " upgraded to ", ns.format.ram(reqRam));
			lines++;
		}

		if (upgradedThisTier > 0) {
			tiersTouched++;
		}

		// after a partial tier, stop this run
		break;
	}

	if (spent > 0) {
		ns.print("spent ", ns.format.number(spent));
		lines++;
	}
	if (tiersTouched > 0) {
		ns.print("tiers touched ", tiersTouched);
		lines++;
	}

	ns.ui.moveTail(280, 70);
	ns.ui.resizeTail(width, Math.min(maxHeight, calcHeight(lines)));
}
