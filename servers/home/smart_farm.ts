import {
	allocateThreads,
	deployScriptSet,
	Fleet,
	getFleet,
	runAllocations,
} from "./lib/fleet";
import { getTargetJobCounts } from "./lib/jobs";
import { log, tlog } from "./lib/log";
import { calcHackThreadsForPercent, calcPrepPlan } from "./lib/prep";
import { chooseBestTarget } from "./choose_best_target";
import { NetworkMap } from "./lib/network_map";
import { GROW, HACK, WEAKEN } from "./lib/paths";

export function autocomplete(
	data: AutocompleteData,
	args: ScriptArg[],
): string[] {
	const servers = data.servers;
	const srv_set = new Set(servers);
	for (const arg of args) {
		srv_set.delete(arg as string);
	}
	return [...srv_set];
}

function missing(wanted: number, active: number): number {
	return Math.max(0, wanted - active);
}

export async function main(ns: NS) {
	ns.disableLog("sleep");
	ns.disableLog("scp");
	ns.disableLog("exec");
	ns.disableLog("getServerUsedRam");
	ns.disableLog("getServerMaxRam");

	if (typeof ns.args[0] === "number" && ns.args.length >= 2) {
		const tmp = ns.args[1];
		ns.args[1] = ns.args[0];
		ns.args[0] = tmp;
	}
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

	ns.ui.setTailTitle(`smart_farm:${target}`);
	tlog(ns, `[SMART_FARM] target=${target} hackPct=${hackPct}`);
	const map = NetworkMap.build(ns);
	const FILES = [
		HACK,
		GROW,
		WEAKEN,
	];
	deployScriptSet(ns, FILES, map.hosts);
	const state = {
		target,
		hackPct,
		steps: 0,
		wgMem: 1.75,
		hMem: 1.7,
		minSec: ns.getServerMinSecurityLevel(target),
	};
	while (true) {
		await run_farm_step(ns, state);
		state.steps++;
	}
}

async function run_farm_step(
	ns: NS,
	s: {
		target: string;
		hackPct: number;
		steps: number;
		wgMem: number;
		hMem: number;
		minSec: number;
	},
) {
	const { target, hackPct, wgMem, hMem } = s;
	let can_run = true;
	const fleet = getFleet(ns);
	const jobs = getTargetJobCounts(ns, fleet, target);
	const prep = calcPrepPlan(ns, target);
	const sec = ns.getServerSecurityLevel(target);

	let hackThreads = calcHackThreadsForPercent(ns, target, hackPct);
	const hackSec = ns.hackAnalyzeSecurity(hackThreads, target);
	let hackWeaken = Math.ceil(hackSec / ns.weakenAnalyze(1));
	hackWeaken = Math.ceil(hackWeaken);

	const growFactor = 1 / Math.max(0.001, 1 - hackPct);
	let growThreads = ns.growthAnalyze(target, growFactor);
	growThreads = Math.ceil(growThreads);
	const growSec = ns.growthAnalyzeSecurity(growThreads);
	let growWeaken = growSec / ns.weakenAnalyze(1);
	growWeaken = Math.ceil(growWeaken);

	if (can_run && sec > s.minSec + 1.5) {
		const wantedW = hackWeaken + growWeaken + 20;
		let missingW = missing(wantedW, jobs.weaken);
		missingW = wantedW;

		const alloc = allocateThreads(fleet, wgMem, missingW);
		const launched = runAllocations(ns, WEAKEN, alloc, [target]);

		log(
			ns,
			`[STABILIZE] target=${target} sec=${sec.toFixed(2)} ` +
				`wantedW=${wantedW} activeW=${jobs.weaken} launchW=${launched}`,
		);

		can_run = false;
	}

	if (can_run && !prep.isPrepped) {
		const wantedWeaken = prep.totalWeaken;
		const wantedGrow = prep.needGrow;

		const missingWeaken = missing(wantedWeaken, jobs.weaken);
		const missingGrow = missing(wantedGrow, jobs.grow);

		let launchedW = 0;
		let launchedG = 0;

		if (missingWeaken > 0) {
			const weakenAlloc = allocateThreads(fleet, wgMem, missingWeaken);
			launchedW = runAllocations(ns, WEAKEN, weakenAlloc, [target]);
		}

		if (missingGrow > 0) {
			const fleetAfterW = getFleet(ns);
			const growAlloc = allocateThreads(fleetAfterW, wgMem, missingGrow);
			launchedG = runAllocations(ns, GROW, growAlloc, [target]);
		}

		log(
			ns,
			`[PREP] target=${target} ` +
				`needW=${prep.needWeaken} growW=${prep.needGrowWeaken} needG=${prep.needGrow} ` +
				`activeW=${jobs.weaken} activeG=${jobs.grow} ` +
				`launchW=${launchedW} launchG=${launchedG}`,
		);

		can_run = false;
	}

	const money = ns.getServerMoneyAvailable(target);
	const maxMoney = ns.getServerMaxMoney(target);

	if (can_run && money < maxMoney * 0.9) {
		const missingG = missing(growThreads, jobs.grow);
		const missingW = missing(growWeaken, jobs.weaken);

		const growAlloc = allocateThreads(fleet, wgMem, missingG);
		const launchedG = runAllocations(ns, GROW, growAlloc, [target]);

		const fleetAfterG = getFleet(ns);
		const weakAlloc = allocateThreads(fleetAfterG, wgMem, missingW);
		const launchedW = runAllocations(ns, WEAKEN, weakAlloc, [target]);

		log(
			ns,
			`[RECOVER] target=${target} money=${ns.format.number(money)}/${
				ns.format.number(maxMoney)
			} ` +
				`activeG=${jobs.grow} activeW=${jobs.weaken} ` +
				`launchG=${launchedG} launchW=${launchedW}`,
		);

		can_run = false;
	}

	if (can_run) {
		const wantedHack = hackThreads;
		const wantedGrow = growThreads;
		const wantedWeaken = hackWeaken + growWeaken;

		let missingHack = missing(wantedHack, jobs.hack);
		let missingGrow = missing(wantedGrow, jobs.grow);
		let missingWeaken = missing(wantedWeaken, jobs.weaken);

		missingHack = wantedHack;
		missingGrow = wantedGrow;
		missingWeaken = wantedWeaken;

		const hackAlloc = allocateThreads(fleet, hMem, missingHack);
		const launchedH = runAllocations(ns, HACK, hackAlloc, [target]);

		const weakAlloc = allocateThreads(fleet, wgMem, missingWeaken);
		const launchedW = runAllocations(ns, WEAKEN, weakAlloc, [target]);

		const growAlloc = allocateThreads(fleet, wgMem, missingGrow);
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
	}

	if (s.steps % 3 == 0) {
		await ns.sleep(20);
		ns.clearLog();
	}
}
