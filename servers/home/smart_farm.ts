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
	let steps = 0;
	const state = {
		target,
		hackPct,
		steps,
		wgMem: 1.75,
		hMem: 1.7,
	};
	while (true) {
		ns.clearLog();
		await run_farm_step(ns, state);
		steps++;
	}
}

async function run_farm_step(
	ns: NS,
	state: {
		target: string;
		hackPct: number;
		steps: number;
		wgMem: number;
		hMem: number;
	},
) {
	const { target, hackPct, wgMem, hMem } = state;
	const fleet = getFleet(ns);
	const jobs = getTargetJobCounts(ns, fleet, target);

	const sec = ns.getServerSecurityLevel(target);
	const minSec = ns.getServerMinSecurityLevel(target);
	const money = ns.getServerMoneyAvailable(target);
	const maxMoney = ns.getServerMaxMoney(target);

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
			`money=${ns.format.number(money)}/${ns.format.number(maxMoney)} ` +
			`sec=${sec.toFixed(2)}/${minSec.toFixed(2)} ` +
			`wanted(h/g/w)=${wantedHack}/${wantedGrow}/${wantedWeaken} ` +
			`active(h/g/w)=${jobs.hack}/${jobs.grow}/${jobs.weaken} ` +
			`launch(h/g/w)=${launchedH}/${launchedG}/${launchedW}`,
	);
	if (state.steps % 7 == 0) {
		await ns.sleep(0);
	}
}
