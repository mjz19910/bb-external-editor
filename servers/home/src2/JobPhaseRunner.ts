import { NetworkMap } from "./NetworkMap"
import { StateManager } from "./StateManager"
import { JobPhase } from "./types"

const HACK_SCRIPT = "lib/task_hack.ts"
const GROW_SCRIPT = "lib/task_grow.ts"
const WEAK_SCRIPT = "lib/task_weak.ts"
const WORKER_SCRIPTS = [GROW_SCRIPT, WEAK_SCRIPT, HACK_SCRIPT]

export class JobPhaseRunner {
	private map: NetworkMap
	private workerHosts: string[]
	private jobTargets: string[]
	private srvMaxMoney = new Map<string, number>()
	private srvMinSec = new Map<string, number>()
	private maxRamByHost = new Map<string, number>()
	private scriptRamMap = new Map<string, number>()

	constructor(
		public ns: NS,
		public sm: StateManager,
		public reserve: number = 32,
	) {
		this.map = NetworkMap.build(ns)
		this.workerHosts = this.map.allHosts.filter(h => ns.hasRootAccess(h))
		this.jobTargets = this.workerHosts.filter(h => h !== "home")

		for (const host of this.workerHosts) {
			this.maxRamByHost.set(host, this.map.ramSizes[host])
		}

		for (const target of this.jobTargets) {
			this.srvMaxMoney.set(target, ns.getServerMaxMoney(target))
			this.srvMinSec.set(target, ns.getServerMinSecurityLevel(target))
		}
	}

	log(...args: any[]) {
		this.ns.tprint(...args)
		this.ns.print(...args)
	}

	formatMoney(n: number) {
		return "$" + this.ns.format.number(n, 2)
	}

	private getPhaseScript(phase: JobPhase): string {
		switch (phase) {
			case "weaken": return WEAK_SCRIPT
			case "grow": return GROW_SCRIPT
			case "hack": return HACK_SCRIPT
		}
	}

	private getPhaseDuration(target: string, phase: JobPhase): number {
		switch (phase) {
			case "weaken": return this.ns.getWeakenTime(target)
			case "grow": return this.ns.getGrowTime(target)
			case "hack": return this.ns.getHackTime(target)
		}
	}

	private sortTargetsForPhase(phase: JobPhase) {
		switch (phase) {
			case "weaken":
				this.jobTargets.sort((a, b) => this.ns.getWeakenTime(a) - this.ns.getWeakenTime(b))
				break
			case "grow":
				this.jobTargets.sort((a, b) => this.ns.getGrowTime(a) - this.ns.getGrowTime(b))
				break
			case "hack":
				this.jobTargets.sort((a, b) => this.ns.getHackTime(a) - this.ns.getHackTime(b))
				break
		}
	}

	private calculateThreadsNeeded(target: string, phase: JobPhase): number {
		if (phase === "weaken") {
			const sec = this.ns.getServerSecurityLevel(target)
			const minSec = this.srvMinSec.get(target)!
			if (sec <= minSec) return 0
			return Math.ceil((sec - minSec) / this.ns.weakenAnalyze(1))
		}

		if (phase === "grow") {
			const money = Math.max(1, this.ns.getServerMoneyAvailable(target))
			const maxMoney = this.srvMaxMoney.get(target)!
			if (money >= maxMoney) return 0
			return Math.ceil(this.ns.growthAnalyze(target, maxMoney / money))
		}

		if (phase === "hack") {
			const maxMoney = this.srvMaxMoney.get(target)!
			if (maxMoney <= 0) return 0

			// Hack 25% of max money by default
			const targetHackFraction = 0.25
			const hackPercentPerThread = this.ns.hackAnalyze(target)

			if (hackPercentPerThread <= 0) return 0

			return Math.max(1, Math.ceil(targetHackFraction / hackPercentPerThread))
		}

		return 0
	}

	copyScripts() {
		for (const host of this.workerHosts) {
			if (host == "home") continue
			this.ns.scp(WORKER_SCRIPTS, host)
		}
	}

	async runPhase(phase: JobPhase) {
		const script = this.getPhaseScript(phase)
		const jobsEndTimes: Map<string, number[]> = new Map()

		this.sortTargetsForPhase(phase)

		for (const target of this.jobTargets) {
			const threads = this.calculateThreadsNeeded(target, phase)
			if (threads <= 0) continue

			if (!this.scriptRamMap.has(script)) {
				this.scriptRamMap.set(script, this.ns.getScriptRam(script))
			}

			const ramPerThread = this.scriptRamMap.get(script)!
			let threadsLeft = threads

			const sortedHosts = this.workerHosts.toSorted(
				(a, b) => this.maxRamByHost.get(b)! - this.maxRamByHost.get(a)!
			)

			for (const host of sortedHosts) {
				if (threadsLeft <= 0) break

				const maxRam = this.maxRamByHost.get(host)!
				const usedRam = this.ns.getServerUsedRam(host)
				const freeRam = host === "home"
					? Math.max(0, maxRam - usedRam - this.reserve)
					: Math.max(0, maxRam - usedRam)

				const hostThreads = Math.min(
					Math.floor(freeRam / ramPerThread),
					threadsLeft,
				)

				if (hostThreads <= 0) continue

				const pid = this.ns.exec(script, host, hostThreads, target, hostThreads)
				if (pid !== 0) {
					threadsLeft -= hostThreads

					const duration = this.getPhaseDuration(target, phase)
					if (!jobsEndTimes.has(target)) jobsEndTimes.set(target, [])
					jobsEndTimes.get(target)!.push(Date.now() + duration)

					this.log(
						`${target}: launched ${phase} x${hostThreads}, ETA ${this.ns.format.time(duration)}`
					)
				}
			}

			if (threadsLeft > 0) {
				this.log(`${target}: partial ${phase}, missing ${threadsLeft} threads`)
			}
		}

		while (jobsEndTimes.size > 0) {
			const nextEnd = Math.min(...[...jobsEndTimes.values()].flat())
			const sleepMs = Math.max(0, nextEnd - Date.now() + 50)

			for (const [target, jobs] of jobsEndTimes.entries()) {
				for (const end of jobs) {
					if (end === nextEnd) {
						this.log(`${target}: waiting ${this.ns.format.time(sleepMs)} for ${phase}`)
					}
				}
			}

			await this.ns.sleep(sleepMs)

			for (const [target, ends] of [...jobsEndTimes.entries()]) {
				const remaining = ends.filter(t => t > Date.now())
				if (remaining.length === 0) jobsEndTimes.delete(target)
				else jobsEndTimes.set(target, remaining)
			}
		}
	}

	showStatus() {
		for (const target of this.jobTargets) {
			const money = this.ns.getServerMoneyAvailable(target)
			const maxMoney = this.srvMaxMoney.get(target)!
			const sec = this.ns.getServerSecurityLevel(target)
			const minSec = this.srvMinSec.get(target)!

			this.log(
				`${target}: STATUS (${this.formatMoney(money)} / ${this.formatMoney(maxMoney)}, sec ${sec.toFixed(2)} / ${minSec.toFixed(2)})`
			)

			const tState = this.sm.getTarget(target)
			tState.isPrepped = money >= maxMoney && sec <= minSec + 0.01
		}

		this.sm.saveState()
	}
}
