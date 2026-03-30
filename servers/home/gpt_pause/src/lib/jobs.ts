import { NS, ProcessInfo } from "./@ns";
import { getFleet } from "./fleet";
import { NetworkMap } from "./network_map";

export type TargetJobCounts = {
	target: string;
	hack: number;
	grow: number;
	weaken: number;
	total: number;
};

export type JobSnapshot = {
	byTarget: Record<string, TargetJobCounts>;
	totalHack: number;
	totalGrow: number;
	totalWeaken: number;
	totalJobs: number;
};

const HACK = "hack_worker.ts";
const GROW = "grow_worker.ts";
const WEAKEN = "weaken_worker.ts";

function ensureTarget(
	out: Record<string, TargetJobCounts>,
	target: string,
): TargetJobCounts {
	if (!out[target]) {
		out[target] = {
			target,
			hack: 0,
			grow: 0,
			weaken: 0,
			total: 0,
		};
	}
	return out[target];
}

function firstArgString(p: ProcessInfo): string {
	return String(p.args?.[0] ?? "");
}

export function getJobSnapshot(ns: NS): JobSnapshot {
	const fleet = getFleet(ns);
	const byTarget: Record<string, TargetJobCounts> = {};

	let totalHack = 0;
	let totalGrow = 0;
	let totalWeaken = 0;
	let totalJobs = 0;

	for (const host of fleet.hosts) {
		for (const p of ns.ps(host.host)) {
			const file = p.filename;
			if (file !== HACK && file !== GROW && file !== WEAKEN) continue;

			const target = firstArgString(p);
			if (!target) continue;

			const t = ensureTarget(byTarget, target);
			const threads = p.threads ?? 1;

			if (file === HACK) {
				t.hack += threads;
				totalHack += threads;
			} else if (file === GROW) {
				t.grow += threads;
				totalGrow += threads;
			} else if (file === WEAKEN) {
				t.weaken += threads;
				totalWeaken += threads;
			}

			t.total += threads;
			totalJobs += threads;
		}
	}

	return {
		byTarget,
		totalHack,
		totalGrow,
		totalWeaken,
		totalJobs,
	};
}

export function getTargetJobCounts(
	ns: NS,
	target: string,
): TargetJobCounts {
	const snap = getJobSnapshot(ns);
	return snap.byTarget[target] ?? {
		target,
		hack: 0,
		grow: 0,
		weaken: 0,
		total: 0,
	};
}

export function countTargetScriptThreads(
	ns: NS,
	target: string,
	script: string,
): number {
	const fleet = getFleet(ns);
	let total = 0;

	for (const host of fleet.hosts) {
		for (const p of ns.ps(host.host)) {
			if (p.filename !== script) continue;
			if (String(p.args?.[0] ?? "") !== target) continue;
			total += p.threads ?? 1;
		}
	}

	return total;
}
