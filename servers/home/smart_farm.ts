import {
	allocateThreads,
	deployScriptSet,
	Fleet,
	getFleet,
	runAllocationsTracked,
} from "./lib/fleet"
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
}

class MultiTargetFarm {
	workerPids = new Map<number, number>() // pid -> expected end time
	jobsPerHost = new Map<string, number>();
	hMem: number
	gMem: number
	wMem: number
	hackingLevel: number

	constructor(public ns: NS, public hackPct: number, public map: NetworkMap) {
		this.hMem = ns.getScriptRam(HACK)
		this.gMem = ns.getScriptRam(GROW)
		this.wMem = ns.getScriptRam(WEAKEN)
		this.hackingLevel = ns.getHackingLevel()
	}

	/** Initialize all target states */
	private initTargets(): TargetState[] {
		const ns = this.ns
		return this.map.hosts
			.filter(host => {
				if (!ns.hasRootAccess(host)) return false
				if (ns.getServerMaxMoney(host) <= 0) return false
				if (ns.getServerRequiredHackingLevel(host) > this.hackingLevel) return false
				return true
			})
			.map(host => {
				const minSec = ns.getServerMinSecurityLevel(host)
				const moneyMax = ns.getServerMaxMoney(host)
				const plan: CyclePlan = this.calcCyclePlan(host)
				const prep: PrepPlan = calcPrepPlan(ns, host)
				return { host, hackPct: this.hackPct, minSec, moneyMax, plan, prep }
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

	getOrInsertJob(host: string, newValue: number) {
		if (this.jobsPerHost.has(host)) {
			return this.jobsPerHost.get(host)!
		}
		this.jobsPerHost.set(host, newValue)
		return newValue
	}

	getJob(host: string) {
		return this.jobsPerHost.get(host)!
	}

	/** Determine phase for a target */
	private getPhase(target: TargetState): "stabilize" | "prep" | "cycle" | "idle" {
		if (this.getOrInsertJob(target.host, 0) != 0) return "idle"

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
				return { hack: 0, grow: 0, weaken: Math.max(0, wantedW) }
			case "prep":
				return { hack: 0, grow: Math.max(0, target.prep.needGrow), weaken: Math.max(0, target.prep.totalWeaken) }
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
			hack: Math.max(0, target.plan.hackThreads),
			grow: Math.max(0, target.plan.growThreads),
			weaken: Math.max(0, target.plan.hackWeaken + target.plan.growWeaken),
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
		const endTime = Date.now() + duration / 3
		for (const pid of res.pids) if (pid > 0) this.workerPids.set(pid, endTime)
		this.ns.asleep(duration).then(() => {
			if (this.disabled) return
			res.pids.forEach(pid => this.workerPids.delete(pid))
			this.finishJobOnHost(target)
		})
		this.addJobToHost(target)
		return { ...res, endTime }
	}

	addJobToHost(host: string) {
		const curCount = this.getOrInsertJob(host, 0)
		this.jobsPerHost.set(host, curCount + 1)
	}

	finishJobOnHost(host: string) {
		if (this.jobsPerHost.has(host)) {
			let curCount = this.getJob(host)
			this.jobsPerHost.set(host, curCount - 1)
		}
	}

	/** Calculate how long until next worker finishes */
	private getNextSleep(): number {
		if (this.workerPids.size === 0) return 0
		const now = Date.now()
		let minRemaining = Infinity
		for (const endTime of this.workerPids.values()) {
			const remaining = endTime - now
			if (remaining > 0 && remaining < minRemaining) minRemaining = remaining
		}
		return Math.max(0, minRemaining)
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
		this.disabled = true
	}

	disabled = false;
}

/** Main entry point */
export async function main(ns: NS) {
	ns.disableLog("disableLog")
	ns.disableLog("exec")
	ns.disableLog("kill")
	ns.disableLog("getServerUsedRam")
	ns.disableLog("getServerSecurityLevel")
	ns.disableLog("asleep")
	ns.disableLog("getServerMaxRam")
	ns.disableLog("getServerMaxMoney")
	ns.disableLog("getServerMinSecurityLevel")
	ns.disableLog("getServerMoneyAvailable")
	ns.disableLog("scan")
	ns.disableLog("scp")
	ns.disableLog("getHackingLevel")
	ns.disableLog("getServerRequiredHackingLevel")

	const hackPct = Number(ns.args[0] ?? 0.1)
	const map = NetworkMap.build(ns)

	ns.ui.setTailTitle(`multi_farm:${hackPct}`)
	log(ns, `[MULTI_FARM] hackPct=${hackPct}`)
	deployScriptSet(ns, [HACK, GROW, WEAKEN], map.hosts)

	const farm = new MultiTargetFarm(ns, hackPct, map)
	ns.atExit(() => farm.cleanupWorkers())

	while (true) {
		await farm.runOnce()
	}
}
