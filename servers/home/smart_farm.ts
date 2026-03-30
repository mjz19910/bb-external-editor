import {
	allocateThreads,
	deployScriptSet,
	getFleet,
	runAllocations,
	totalThreadsForScript,
} from "./lib/fleet";
import { chooseBestTarget } from "./lib/targeting";
import { calcHackThreadsForPercent, calcPrepPlan } from "./lib/prep";
import { log, tlog } from "./lib/log";

const HACK = "hack_worker.ts";
const GROW = "grow_worker.ts";
const WEAKEN = "weaken_worker.ts";
const FILES = [HACK, GROW, WEAKEN];

export async function main(ns: NS) {
	let target = String(ns.args[0] ?? "");
	const hackPct = Number(ns.args[1] ?? 0.1);

	if (!target) {
		const best = chooseBestTarget(ns);
		if (!best) {
			ns.tprint("No farmable target found.");
			return;
		}
		target = best.host;
	}

	tlog(ns, `[SMART_FARM] target=${target} hackPct=${hackPct}`);

	while (true) {
		const fleet = getFleet(ns);
		await deployScriptSet(ns, FILES, fleet.hosts.map((h) => h.host));

		const prep = calcPrepPlan(ns, target);

		if (!prep.isPrepped) {
			const weakenCap = totalThreadsForScript(ns, fleet, WEAKEN);
			const growCap = totalThreadsForScript(ns, fleet, GROW);

			const weakenWanted = Math.min(prep.totalWeaken, weakenCap);
			const growWanted = Math.min(prep.needGrow, growCap);

			let launchedW = 0;
			let launchedG = 0;

			if (prep.needWeaken > 0 || prep.needGrowWeaken > 0) {
				const weakenAlloc = allocateThreads(
					ns,
					fleet,
					WEAKEN,
					weakenWanted,
				);
				launchedW = runAllocations(ns, WEAKEN, weakenAlloc, [target]);
			}

			if (prep.needGrow > 0) {
				const fleetAfterW = getFleet(ns);
				const growAlloc = allocateThreads(
					ns,
					fleetAfterW,
					GROW,
					growWanted,
				);
				launchedG = runAllocations(ns, GROW, growAlloc, [target]);
			}

			log(
				ns,
				`[PREP] target=${target} ` +
					`needW=${prep.needWeaken} growW=${prep.needGrowWeaken} needG=${prep.needGrow} ` +
					`launchedW=${launchedW} launchedG=${launchedG}`,
			);

			await ns.sleep(Math.max(5000, ns.getWeakenTime(target) * 0.25));
			continue;
		}

		const sec = ns.getServerSecurityLevel(target);
		const minSec = ns.getServerMinSecurityLevel(target);
		const money = ns.getServerMoneyAvailable(target);
		const maxMoney = ns.getServerMaxMoney(target);

		const hackThreads = calcHackThreadsForPercent(ns, target, hackPct);
		const hackSec = ns.hackAnalyzeSecurity(hackThreads, target);
		const hackWeaken = Math.ceil(hackSec / ns.weakenAnalyze(1));

		const growFactor = 1 / Math.max(0.001, 1 - hackPct);
		const growThreads = Math.ceil(ns.growthAnalyze(target, growFactor));
		const growSec = ns.growthAnalyzeSecurity(growThreads, target);
		const growWeaken = Math.ceil(growSec / ns.weakenAnalyze(1));

		let launched = 0;

		if (sec > minSec + 1.5) {
			const alloc = allocateThreads(
				ns,
				fleet,
				WEAKEN,
				hackWeaken + growWeaken + 20,
			);
			launched = runAllocations(ns, WEAKEN, alloc, [target]);

			log(
				ns,
				`[STABILIZE] target=${target} sec=${
					sec.toFixed(2)
				} launchedW=${launched}`,
			);
			await ns.sleep(Math.max(3000, ns.getWeakenTime(target) * 0.2));
			continue;
		}

		if (money < maxMoney * 0.9) {
			const growAlloc = allocateThreads(ns, fleet, GROW, growThreads);
			const launchedG = runAllocations(ns, GROW, growAlloc, [target]);

			const fleetAfterG = getFleet(ns);
			const weakAlloc = allocateThreads(
				ns,
				fleetAfterG,
				WEAKEN,
				growWeaken,
			);
			const launchedW = runAllocations(ns, WEAKEN, weakAlloc, [target]);

			log(
				ns,
				`[RECOVER] target=${target} money=${ns.format.number(money)}/${
					ns.format.number(maxMoney)
				} ` +
					`launchedG=${launchedG} launchedW=${launchedW}`,
			);

			await ns.sleep(Math.max(3000, ns.getGrowTime(target) * 0.2));
			continue;
		}

		const hackAlloc = allocateThreads(ns, fleet, HACK, hackThreads);
		const launchedH = runAllocations(ns, HACK, hackAlloc, [target]);

		const fleetAfterH = getFleet(ns);
		const weakAllocH = allocateThreads(ns, fleetAfterH, WEAKEN, hackWeaken);
		const launchedWH = runAllocations(ns, WEAKEN, weakAllocH, [target]);

		const fleetAfterWH = getFleet(ns);
		const growAlloc = allocateThreads(ns, fleetAfterWH, GROW, growThreads);
		const launchedG = runAllocations(ns, GROW, growAlloc, [target]);

		const fleetAfterG = getFleet(ns);
		const weakAllocG = allocateThreads(ns, fleetAfterG, WEAKEN, growWeaken);
		const launchedWG = runAllocations(ns, WEAKEN, weakAllocG, [target]);

		launched = launchedH + launchedWH + launchedG + launchedWG;

		log(
			ns,
			`[CYCLE] target=${target} ` +
				`money=${ns.format.number(money)}/${
					ns.format.number(maxMoney)
				} ` +
				`sec=${sec.toFixed(2)}/${minSec.toFixed(2)} ` +
				`hack=${launchedH} weakH=${launchedWH} grow=${launchedG} weakG=${launchedWG} total=${launched}`,
		);

		await ns.sleep(Math.max(5000, ns.getHackTime(target) * 0.3));
	}
}
