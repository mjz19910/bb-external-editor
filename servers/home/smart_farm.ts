import {
	allocateThreads,
	deployScriptSet,
	Fleet,
	getFleet,
	runAllocationsTracked,
} from "./lib/fleet";
import { getTargetJobCounts, TargetJobCounts } from "./lib/jobs";
import { tlog } from "./lib/log";
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
	return Math.max(0, Math.ceil(wanted) - active);
}

type LaunchOrder = {
	hack: number;
	grow: number;
	weaken: number;
};

type CyclePlan = {
	hackThreads: number;
	growThreads: number;
	hackWeaken: number;
	growWeaken: number;
};

type PrepPlan = ReturnType<typeof calcPrepPlan>;

type StepCtx = {
	fleet: Fleet;
	jobs: TargetJobCounts;
	sec: number;
	money: number;
	plan: CyclePlan;
	prep: PrepPlan;
};

type FarmPhase = "stabilize" | "prep" | "cycle" | "idle";

class SmartFarm {
	minSec: number;
	moneyMax: number;

	steps = 0;
	launch_counter = 0;
	hMem = 1.7;
	wgMem = 1.75;

	workerPids = new Set<number>();

	constructor(public ns: NS, public target: string, public hackPct: number) {
		this.minSec = ns.getServerMinSecurityLevel(target);
		this.moneyMax = ns.getServerMaxMoney(target);
	}

	private initStep(): StepCtx {
		const ns = this.ns;
		const target = this.target;

		const fleet = getFleet(ns);
		const jobs = getTargetJobCounts(ns, fleet, target);
		const sec = ns.getServerSecurityLevel(target);
		const money = ns.getServerMoneyAvailable(target);
		const plan = this.calcCyclePlan(ns);
		const prep = calcPrepPlan(ns, target);

		return {
			fleet,
			jobs,
			sec,
			money,
			plan,
			prep,
		};
	}

	private finalizeStep() {
		const ns = this.ns;

		if (this.steps % 20 === 0) {
			return ns.asleep(50);
		} else if (this.launch_counter === 0) {
			return ns.asleep(80);
		} else if (this.steps % 4 === 0) {
			this.launch_counter = 0;
		}

		this.steps++;
	}

	private calcCyclePlan(ns: NS): CyclePlan {
		const hackThreads = Math.ceil(
			calcHackThreadsForPercent(ns, this.target, this.hackPct),
		);

		const hackSec = ns.hackAnalyzeSecurity(hackThreads, this.target);
		const hackWeaken = Math.ceil(hackSec / ns.weakenAnalyze(1));

		const growFactor = 1 / Math.max(0.001, 1 - this.hackPct);
		const growThreads = Math.ceil(
			ns.growthAnalyze(this.target, growFactor),
		);
		const growSec = ns.growthAnalyzeSecurity(growThreads);
		const growWeaken = Math.ceil(growSec / ns.weakenAnalyze(1));

		return {
			hackThreads,
			growThreads,
			hackWeaken,
			growWeaken,
		};
	}

	private getPhase(ctx: StepCtx): FarmPhase {
		if (ctx.sec >= this.minSec + 1.5) {
			return "stabilize";
		}

		if (!ctx.prep.isPrepped) {
			return "prep";
		}

		const order = this.planCycle(ctx);
		if (this.hasWork(order)) {
			return "cycle";
		}

		return "idle";
	}

	private planPhaseWork(ctx: StepCtx, phase: FarmPhase): LaunchOrder {
		switch (phase) {
			case "stabilize":
				return this.planStabilize(ctx);
			case "prep":
				return this.planPrep(ctx);
			case "cycle":
				return this.planCycle(ctx);
			case "idle":
				return this.emptyOrder();
		}
	}

	private runLaunchOrder(ctx: StepCtx, order: LaunchOrder): boolean {
		if (!this.hasWork(order)) {
			return false;
		}
		const launched = this.launchThreads(ctx.fleet, order);
		return launched.hack > 0 || launched.grow > 0 || launched.weaken > 0;
	}

	private notifyEndPids(pids: number[]) {
		for (const pid of pids) {
			this.workerPids.delete(pid);
		}
	}

	private get hackTime() {
		return this.ns.getHackTime(this.target) + 50;
	}

	private get growTime() {
		return this.ns.getGrowTime(this.target) + 50;
	}

	private get weakenTime() {
		return this.ns.getWeakenTime(this.target) + 50;
	}

	private launchThreads(
		fleet: Fleet,
		order: LaunchOrder,
	): LaunchOrder {
		const ns = this.ns;
		const { target } = this;

		let launchedH = 0;
		let launchedG = 0;
		let launchedW = 0;

		if (order.hack > 0) {
			const alloc = allocateThreads(fleet, this.hMem, order.hack);
			const res = runAllocationsTracked(ns, HACK, alloc, [target]);
			launchedH = res.threads;
			this.trackPids(res.pids);
			const cb = this.notifyEndPids.bind(this, res.pids);
			ns.asleep(this.hackTime).then(cb);
		}

		if (order.grow > 0) {
			const alloc = allocateThreads(fleet, this.wgMem, order.grow);
			const res = runAllocationsTracked(ns, GROW, alloc, [target]);
			launchedG = res.threads;
			this.trackPids(res.pids);
			const cb = this.notifyEndPids.bind(this, res.pids);
			ns.asleep(this.growTime).then(cb);
		}

		if (order.weaken > 0) {
			const alloc = allocateThreads(fleet, this.wgMem, order.weaken);
			const res = runAllocationsTracked(ns, WEAKEN, alloc, [target]);
			launchedW = res.threads;
			this.trackPids(res.pids);
			const cb = this.notifyEndPids.bind(this, res.pids);
			ns.asleep(this.weakenTime).then(cb);
		}

		this.launch_counter += launchedH + launchedG + launchedW;

		return {
			hack: launchedH,
			grow: launchedG,
			weaken: launchedW,
		};
	}

	private planStabilize(ctx: StepCtx): LaunchOrder {
		const wantedW = ctx.plan.hackWeaken + ctx.plan.growWeaken + 20;
		return {
			hack: 0,
			grow: 0,
			weaken: missing(wantedW, ctx.jobs.weaken),
		};
	}

	private planPrep(ctx: StepCtx): LaunchOrder {
		return {
			hack: 0,
			grow: missing(ctx.prep.needGrow, ctx.jobs.grow),
			weaken: missing(ctx.prep.totalWeaken, ctx.jobs.weaken),
		};
	}

	private planCycle(ctx: StepCtx): LaunchOrder {
		return {
			hack: missing(ctx.plan.hackThreads, ctx.jobs.hack),
			grow: missing(ctx.plan.growThreads, ctx.jobs.grow),
			weaken: missing(
				ctx.plan.hackWeaken + ctx.plan.growWeaken,
				ctx.jobs.weaken,
			),
		};
	}

	private hasWork(order: LaunchOrder): boolean {
		return order.hack > 0 || order.grow > 0 || order.weaken > 0;
	}

	private emptyOrder(): LaunchOrder {
		return { hack: 0, grow: 0, weaken: 0 };
	}

	runOnce() {
		const ctx = this.initStep();
		const phase = this.getPhase(ctx);
		const order = this.planPhaseWork(ctx, phase);
		this.runLaunchOrder(ctx, order);
		return this.finalizeStep();
	}

	private trackPids(pids: number[]) {
		for (const pid of pids) {
			if (pid > 0) {
				this.workerPids.add(pid);
			}
		}
	}

	cleanupWorkers() {
		const ns = this.ns;

		for (const pid of this.workerPids) {
			ns.kill(pid);
		}
	}
}

export async function main(ns: NS) {
	ns.disableLog("disableLog");
	ns.disableLog("scp");
	ns.disableLog("exec");
	ns.disableLog("scan");
	ns.disableLog("kill");
	ns.disableLog("sleep");
	ns.disableLog("asleep");
	ns.disableLog("isRunning");
	ns.disableLog("getServerMaxRam");
	ns.disableLog("getServerUsedRam");
	ns.disableLog("getServerMaxMoney");
	ns.disableLog("getServerSecurityLevel");
	ns.disableLog("getServerMoneyAvailable");
	ns.disableLog("getServerMinSecurityLevel");

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
	const FILES = [HACK, GROW, WEAKEN];
	deployScriptSet(ns, FILES, map.hosts);

	const state = new SmartFarm(ns, target, hackPct);
	ns.atExit(() => state.cleanupWorkers());

	for (;;) {
		const p = state.runOnce();
		if (p) await p;
	}
}
