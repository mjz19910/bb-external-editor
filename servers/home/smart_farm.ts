import { NS } from "./@ns";
import {
	allocateThreads,
	deployScriptSet,
	getFleet,
	runAllocations,
} from "./gpt_pause/src/lib/fleet";
import { getTargetJobCounts } from "./gpt_pause/src/lib/jobs";
import { log, tlog } from "./gpt_pause/src/lib/log";
import {
	calcHackThreadsForPercent,
	calcPrepPlan,
} from "./gpt_pause/src/lib/prep";
import { chooseBestTarget } from "./gpt_pause/cur/choose_best_target";
const HACK = "gpt_pause/src/hack_worker.ts";
const GROW = "gpt_pause/src/grow_worker.ts";
const WEAKEN = "gpt_pause/src/weaken_worker.ts";
const FILES = [
	HACK,
	GROW,
	WEAKEN,
	"@ns.ts",
	"gpt_pause/src/@ns.ts",
	"gpt_pause/cur/@ns.ts",
];

function missing(wanted: number, active: number): number {
	return Math.max(0, wanted - active);
}

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

		const jobs = getTargetJobCounts(ns, target);
		const prep = calcPrepPlan(ns, target);

		if (!prep.isPrepped) {
			const wantedWeaken = prep.totalWeaken;
			const wantedGrow = prep.needGrow;

			const missingWeaken = missing(wantedWeaken, jobs.weaken);
			const missingGrow = missing(wantedGrow, jobs.grow);

			let launchedW = 0;
			let launchedG = 0;

			if (missingWeaken > 0) {
				const weakenAlloc = allocateThreads(
					ns,
					fleet,
					WEAKEN,
					missingWeaken,
				);
				launchedW = runAllocations(ns, WEAKEN, weakenAlloc, [target]);
			}

			if (missingGrow > 0) {
				const fleetAfterW = getFleet(ns);
				const growAlloc = allocateThreads(
					ns,
					fleetAfterW,
					GROW,
					missingGrow,
				);
				launchedG = runAllocations(ns, GROW, growAlloc, [target]);
			}

			log(
				ns,
				`[PREP] target=${target} ` +
					`needW=${prep.needWeaken} growW=${prep.needGrowWeaken} needG=${prep.needGrow} ` +
					`activeW=${jobs.weaken} activeG=${jobs.grow} ` +
					`launchW=${launchedW} launchG=${launchedG}`,
			);

			await ns.sleep(Math.max(4000, ns.getWeakenTime(target) * 0.2));
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
		const growSec = ns.growthAnalyzeSecurity(growThreads);
		const growWeaken = Math.ceil(growSec / ns.weakenAnalyze(1));

		if (sec > minSec + 1.5) {
			const wantedW = hackWeaken + growWeaken + 20;
			const missingW = missing(wantedW, jobs.weaken);

			const alloc = allocateThreads(ns, fleet, WEAKEN, missingW);
			const launched = runAllocations(ns, WEAKEN, alloc, [target]);

			log(
				ns,
				`[STABILIZE] target=${target} sec=${sec.toFixed(2)} ` +
					`wantedW=${wantedW} activeW=${jobs.weaken} launchW=${launched}`,
			);

			await ns.sleep(Math.max(3000, ns.getWeakenTime(target) * 0.2));
			continue;
		}

		if (money < maxMoney * 0.9) {
			const missingG = missing(growThreads, jobs.grow);
			const missingW = missing(growWeaken, jobs.weaken);

			const growAlloc = allocateThreads(ns, fleet, GROW, missingG);
			const launchedG = runAllocations(ns, GROW, growAlloc, [target]);

			const fleetAfterG = getFleet(ns);
			const weakAlloc = allocateThreads(
				ns,
				fleetAfterG,
				WEAKEN,
				missingW,
			);
			const launchedW = runAllocations(ns, WEAKEN, weakAlloc, [target]);

			log(
				ns,
				`[RECOVER] target=${target} money=${ns.format.number(money)}/${
					ns.format.number(maxMoney)
				} ` +
					`activeG=${jobs.grow} activeW=${jobs.weaken} ` +
					`launchG=${launchedG} launchW=${launchedW}`,
			);

			await ns.sleep(Math.max(3000, ns.getGrowTime(target) * 0.2));
			continue;
		}

		const wantedHack = hackThreads;
		const wantedGrow = growThreads;
		const wantedWeaken = hackWeaken + growWeaken;

		const missingHack = missing(wantedHack, jobs.hack);
		const missingGrow = missing(wantedGrow, jobs.grow);
		const missingWeaken = missing(wantedWeaken, jobs.weaken);

		const hackAlloc = allocateThreads(ns, fleet, HACK, missingHack);
		const launchedH = runAllocations(ns, HACK, hackAlloc, [target]);

		const fleetAfterH = getFleet(ns);
		const weakAlloc = allocateThreads(
			ns,
			fleetAfterH,
			WEAKEN,
			missingWeaken,
		);
		const launchedW = runAllocations(ns, WEAKEN, weakAlloc, [target]);

		const fleetAfterW = getFleet(ns);
		const growAlloc = allocateThreads(ns, fleetAfterW, GROW, missingGrow);
		const launchedG = runAllocations(ns, GROW, growAlloc, [target]);

		log(
			ns,
			`[CYCLE] target=${target} ` +
				`money=${ns.format.number(money)}/${
					ns.format.number(maxMoney)
				} ` +
				`sec=${sec.toFixed(2)}/${minSec.toFixed(2)} ` +
				`wanted(h/g/w)=${wantedHack}/${wantedGrow}/${wantedWeaken} ` +
				`active(h/g/w)=${jobs.hack}/${jobs.grow}/${jobs.weaken} ` +
				`launch(h/g/w)=${launchedH}/${launchedG}/${launchedW}`,
		);

		await ns.sleep(Math.max(4000, ns.getHackTime(target) * 0.25));
	}
}
