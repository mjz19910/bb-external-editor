import {
	allocateThreads,
	deployScriptSet,
	Fleet,
	getFleet,
	runAllocationsTracked,
} from "./lib/fleet"
import { getTargetJobCounts, TargetJobCounts } from "./lib/jobs"
import { log } from "./lib/log"
import { calcHackThreadsForPercent, calcPrepPlan } from "./lib/prep"
import { NetworkMap } from "./lib/network_map"
import { GROW, HACK, WEAKEN } from "./lib/paths"

type LaunchOrder = { hack: number; grow: number; weaken: number }
type CyclePlan = { hackThreads: number; growThreads: number; hackWeaken: number; growWeaken: number }
type PrepPlan = ReturnType<typeof calcPrepPlan>

type TargetState = {
	host: string
	hackPct: number
	minSec: number
	moneyMax: number
	plan: CyclePlan
	prep: PrepPlan
	jobs: TargetJobCounts
}

class MultiTargetFarm {
	workerPids = new Map<number, number>() // pid -> expected end time
	hMem: number
	gMem: number
	wMem: number

	constructor(public ns: NS, public hackPct: number, public targets: string[]) {
		this.hMem = ns.getScriptRam(HACK)
		this.gMem = ns.getScriptRam(GROW)
		this.wMem = ns.getScriptRam(WEAKEN)
	}

	/** Initialize all target states */
	private initTargets(): TargetState[] {
		const ns = this.ns
		return this.targets
			.filter(host => ns.getServerMaxMoney(host) > 0) // skip servers with 0 money
			.map(host => {
				const minSec = ns.getServerMinSecurityLevel(host)
				const moneyMax = ns.getServerMaxMoney(host)
				const plan: CyclePlan = this.calcCyclePlan(host)
				const prep: PrepPlan = calcPrepPlan(ns, host)
				const jobs = getTargetJobCounts(ns, getFleet(ns), host)
				return { host, hackPct: this.hackPct, minSec, moneyMax, plan, prep, jobs }
			})
	}

	/** Calculate cycle plan for a target with safety checks */
	private calcCyclePlan(target: string): CyclePlan {
		const ns = this.ns
		const hackPct = Math.max(0, Math.min(this.hackPct, 1)) // clamp 0..1
		const maxMoney = ns.getServerMaxMoney(target)
		const availMoney = ns.getServerMoneyAvailable(target)

		if (maxMoney <= 0 || availMoney <= 0) {
			return { hackThreads: 0, growThreads: 0, hackWeaken: 0, growWeaken: 0 }
		}

		const hackThreads = Math.max(0, Math.ceil(calcHackThreadsForPercent(ns, target, hackPct)))
		const hackSec = hackThreads > 0 ? ns.hackAnalyzeSecurity(hackThreads, target) : 0
		const hackWeaken = hackSec > 0 ? Math.ceil(hackSec / ns.weakenAnalyze(1)) : 0

		const growFactor = 1 / Math.max(0.001, 1 - hackPct)
		if (Number.isNaN(growFactor)) {
			ns.print("grow factor is NaN, hackPct=", hackPct)
			return { hackThreads: 0, growThreads: 0, hackWeaken: 0, growWeaken: 0 }
		}
		const growThreads = Math.max(0, Math.ceil(ns.growthAnalyze(target, growFactor)))
		const growSec = growThreads > 0 ? ns.growthAnalyzeSecurity(growThreads) : 0
		const growWeaken = growSec > 0 ? Math.ceil(growSec / ns.weakenAnalyze(1)) : 0

		return { hackThreads, growThreads, hackWeaken, growWeaken }
	}

	/** Determine phase for a target */
	private getPhase(target: TargetState): "stabilize" | "prep" | "cycle" | "idle" {
		if (this.ns.getServerSecurityLevel(target.host) >= target.minSec + 1.5) return "stabilize"
		if (!target.prep.isPrepped) return "prep"
		const order = this.planCycle(target)
		if (order.hack + order.grow + order.weaken > 0) return "cycle"
		return "idle"
	}

	/** Plan launch order per phase */
	private planPhaseWork(target: TargetState, phase: string): LaunchOrder {
		switch (phase) {
			case "stabilize":
				const wantedW = target.plan.hackWeaken + target.plan.growWeaken + 20
				return { hack: 0, grow: 0, weaken: Math.max(0, wantedW - target.jobs.weaken) }
			case "prep":
				return { hack: 0, grow: Math.max(0, target.prep.needGrow - target.jobs.grow), weaken: Math.max(0, target.prep.totalWeaken - target.jobs.weaken) }
			case "cycle":
				return this.planCycle(target)
			case "idle":
			default:
				return { hack: 0, grow: 0, weaken: 0 }
		}
	}

	/** Plan cycle order for a target */
	private planCycle(target: TargetState): LaunchOrder {
		return {
			hack: Math.max(0, target.plan.hackThreads - target.jobs.hack),
			grow: Math.max(0, target.plan.growThreads - target.jobs.grow),
			weaken: Math.max(0, target.plan.hackWeaken + target.plan.growWeaken - target.jobs.weaken),
		}
	}

	/** Launch threads for a target, respecting memory limits */
	private launchThreads(fleet: Fleet, order: LaunchOrder, target: string): LaunchOrder {
		const h = this.launchOne(fleet, target, HACK, this.hMem, order.hack, this.ns.getHackTime(target))
		const g = this.launchOne(fleet, target, GROW, this.gMem, order.grow, this.ns.getGrowTime(target))
		const w = this.launchOne(fleet, target, WEAKEN, this.wMem, order.weaken, this.ns.getWeakenTime(target))
		return { hack: h.threads, grow: g.threads, weaken: w.threads }
	}

	/** Launch a single script with memory allocation */
	private launchOne(fleet: Fleet, target: string, script: string, memPerThread: number, threads: number, duration: number) {
		if (threads <= 0) return { threads: 0, pids: [], endTime: 0 }
		const alloc = allocateThreads(fleet, memPerThread, threads)
		const res = runAllocationsTracked(this.ns, script, alloc, [target])
		const endTime = Date.now() + duration
		for (const pid of res.pids) if (pid > 0) this.workerPids.set(pid, endTime)
		this.ns.asleep(duration).then(() => res.pids.forEach(pid => this.workerPids.delete(pid)))
		return { ...res, endTime }
	}

	/** Calculate how long until next worker finishes */
	private getNextSleep(): number {
		if (this.workerPids.size === 0) return 50
		const now = Date.now()
		let minRemaining = Infinity
		for (const endTime of this.workerPids.values()) {
			const remaining = endTime - now
			if (remaining > 0 && remaining < minRemaining) minRemaining = remaining
		}
		return Math.max(1, minRemaining)
	}

	/** Run one iteration for all targets */
	async runOnce() {
		const ns = this.ns
		const fleet = getFleet(ns)
		const targetStates = this.initTargets()

		for (const target of targetStates) {
			const phase = this.getPhase(target)
			if (phase === "idle") continue
			const order = this.planPhaseWork(target, phase)
			const launched = this.launchThreads(fleet, order, target.host)
			if (launched.hack + launched.grow + launched.weaken > 0) {
				log(ns, `[MULTI_FARM] target=${target.host} phase=${phase} h=${launched.hack} g=${launched.grow} w=${launched.weaken}`)
			}
		}

		await ns.asleep(this.getNextSleep())
	}

	/** Kill all tracked workers on exit */
	cleanupWorkers() {
		for (const pid of this.workerPids.keys()) this.ns.kill(pid)
		this.workerPids.clear()
	}
}

/** Main entry point */
export async function main(ns: NS) {
	ns.disableLog("ALL")

	const hackPct = Number(ns.args[0] ?? 0.1)

	// Get all hackable targets with money
	const allTargets = ns.scan()
		.filter(s => ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel())
		.filter(s => ns.getServerMaxMoney(s) > 0)

	if (allTargets.length === 0) {
		ns.tprint("No hackable targets found.")
		return
	}

	ns.ui.setTailTitle(`multi_farm:${hackPct}`)
	log(ns, `[MULTI_FARM] targets=${allTargets.length} hackPct=${hackPct}`)

	const map = NetworkMap.build(ns)
	deployScriptSet(ns, [HACK, GROW, WEAKEN], map.hosts)

	const farm = new MultiTargetFarm(ns, hackPct, allTargets)
	ns.atExit(() => farm.cleanupWorkers())

	while (true) {
		await farm.runOnce()
	}
}
