import {
	allocateThreadsWithPlan,
	deployScriptSet,
	Fleet,
	getFleet,
	runAllocationsTracked,
} from "./lib/fleet"
import { log } from "./lib/log"
import { calcHackThreadsForPercent, calcPrepPlanV1 } from "./lib/prep"
import { NetworkMap } from "./lib/network_map"
import { GROW, HACK, WEAKEN } from "./lib/paths"

type LaunchOrder = { hack: number; grow: number; weaken: number }
type CyclePlan = { hackThreads: number; growThreads: number; hackWeaken: number; growWeaken: number }
type PrepPlan = ReturnType<typeof calcPrepPlanV1>

type TargetState = {
	host: string
	hackPct: number
	minSec: number
	moneyMax: number
	plan: CyclePlan
	prep: PrepPlan
}

type FarmLogger = {
	log(a: {
		target: string,
		phase: string,
		hackThreads: number,
		growThreads: number,
		weakenThreads: number,
	}): void
}

export class MultiTargetFarm {
	hasErrors() {
		return this.errorCount > 0
	}
	private logger: FarmLogger
	setLogger(logger: FarmLogger) {
		this.logger = logger
	}

	static disableLogs(ns: NS) {
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
	}

	shutdown() {
		this.cleanupWorkers()
		this.disabled = true
	}

	workerPids: Map<number, number>
	jobsPerHost: Map<string, number>
	hMem: number
	gMem: number
	wMem: number
	hackingLevel: number

	errorCount: number
	disabled: boolean

	constructor(public ns: NS, public hackPct: number, public map: NetworkMap) {
		this.disabled = false
		this.errorCount = 0
		this.workerPids = new Map()
		this.jobsPerHost = new Map()
		this.hMem = ns.getScriptRam(HACK)
		this.gMem = ns.getScriptRam(GROW)
		this.wMem = ns.getScriptRam(WEAKEN)
		this.hackingLevel = ns.getHackingLevel()

		this.logger = {
			log(a) {
				log(ns, `[MULTI_FARM] target=${a.target} phase=${a.phase} h=${a.hackThreads} g=${a.growThreads} w=${a.weakenThreads}`)
			}
		}
	}

	/** Initialize all target states */
	private initTargets(): TargetState[] {
		const ns = this.ns
		return this.map.allHosts
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
				const prep: PrepPlan = calcPrepPlanV1(ns, host)
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

	private getOrInsertJob(host: string, newValue: number) {
		if (this.jobsPerHost.has(host)) {
			return this.jobsPerHost.get(host)!
		}
		this.jobsPerHost.set(host, newValue)
		return newValue
	}

	private getJob(host: string) {
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
		let pids: number[] = []
		let myErrors = 0
		duration += 50
		this.ns.asleep(duration).then(() => {
			if (this.disabled) return
			pids.forEach(pid => this.workerPids.delete(pid))
			this.finishJobOnHost(target)
			this.errorCount -= myErrors
		})
		this.addJobToHost(target)
		const plan = allocateThreadsWithPlan(fleet, memPerThread, threads)
		const { allocations: alloc } = plan
		if (!plan.fitAll) {
			myErrors++
			this.errorCount += myErrors

			log(this.ns,
				`[MULTI_FARM] alloc_failed target=${target} script=${script} ` +
				`wanted=${plan.requestedThreads} allocated=${plan.allocatedThreads} missing=${plan.missingThreads}`
			)

			return { threads: 0, pids: [], endTime: 0 }
		}
		const res = runAllocationsTracked(this.ns, script, alloc, [target])
		pids = res.pids
		myErrors += res.failedAllocs.length
		this.errorCount += myErrors
		const endTime = Date.now() + duration
		for (const pid of res.pids) if (pid > 0) this.workerPids.set(pid, endTime)
		return { ...res, endTime }
	}

	private addJobToHost(host: string) {
		const curCount = this.getOrInsertJob(host, 0)
		this.jobsPerHost.set(host, curCount + 1)
	}

	private finishJobOnHost(host: string) {
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
	private async runOnce() {
		const ns = this.ns
		const fleet = getFleet(ns)
		const targetStates = this.initTargets()

		for (const target of targetStates) {
			const phase = this.getPhase(target)
			if (phase === "idle") continue
			const order = this.planPhaseWork(target, phase)
			const launched = this.launchThreads(fleet, order, target.host)
			if (launched.hack + launched.grow + launched.weaken > 0) {
				this.logger.log({
					target: target.host,
					phase,
					hackThreads: launched.hack,
					growThreads: launched.grow,
					weakenThreads: launched.weaken,
				})
			}
		}

		await ns.asleep(this.getNextSleep())
	}

	/** Kill all tracked workers on exit */
	private cleanupWorkers() {
		for (const pid of this.workerPids.keys()) this.ns.kill(pid)
		this.workerPids.clear()
	}

	async runForever() {
		for (; ;) {
			await this.runOnce()
		}
	}
}
