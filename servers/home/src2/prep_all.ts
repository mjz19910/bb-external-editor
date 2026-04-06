/** prep_all_class_main.ts
 * Class-based server prep: weaken then grow to max money
 * Usage:
 *   run prep_all_class_main.ts
 *   run prep_all_class_main.ts --reserve 32
 */
import { NetworkMap } from "./NetworkMap"
import { StateManager } from "./StateManager"

const GROW = "lib/prep_grow.ts"
const WEAK = "lib/prep_weak.ts"
const all_scripts = [GROW, WEAK]

class PrepAll {
	private map: NetworkMap
	private hosts: string[]
	private targets: string[]
	private srvMaxMoney = new Map<string, number>()
	private srvMinSec = new Map<string, number>()
	private maxRamByHost = new Map<string, number>()
	private scriptRamMap = new Map<string, number>()

	constructor(public ns: NS, public sm: StateManager, public reserve: number = 32) {
		this.map = NetworkMap.build(ns)
		this.hosts = this.map.allHosts.filter(h => ns.hasRootAccess(h))
		this.targets = this.hosts.filter(h => h !== "home")
		for (const host of this.hosts) this.maxRamByHost.set(host, ns.getServerMaxRam(host))
		for (const target of this.targets) {
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

	threadsNeeded(target: string, script: string): number {
		if (script === WEAK) {
			const sec = this.ns.getServerSecurityLevel(target)
			const minSec = this.srvMinSec.get(target)!
			if (sec <= minSec) return 0
			return Math.ceil((sec - minSec) / this.ns.weakenAnalyze(1))
		} else if (script === GROW) {
			const money = Math.max(1, this.ns.getServerMoneyAvailable(target))
			const maxMoney = this.srvMaxMoney.get(target)!
			if (money >= maxMoney) return 0
			return Math.ceil(this.ns.growthAnalyze(target, maxMoney / money))
		}
		return 0
	}

	async copyScripts() {
		for (const host of this.hosts) {
			if (host !== "home") this.ns.scp(all_scripts, host)
		}
	}

	// Launch a stage (weaken or grow)
	async launchStage(script: string) {
		const jobsEndTimes: Map<string, number[]> = new Map()

		if (script === WEAK) {
			this.targets.sort((a, b) => this.ns.getWeakenTime(a) - this.ns.getWeakenTime(b))
		} else {
			this.targets.sort((a, b) => this.ns.getGrowTime(a) - this.ns.getGrowTime(b))
		}

		for (const target of this.targets) {
			const threads = this.threadsNeeded(target, script)
			if (threads <= 0) continue

			if (!this.scriptRamMap.has(script)) this.scriptRamMap.set(script, this.ns.getScriptRam(script))
			const ramPerThread = this.scriptRamMap.get(script)!

			let threadsLeft = threads
			const sortedHosts = this.map.allHosts.toSorted((a, b) => this.maxRamByHost.get(b)! - this.maxRamByHost.get(a)!)

			for (const host of sortedHosts) {
				if (threadsLeft <= 0) break
				const maxRam = this.maxRamByHost.get(host)!
				const usedRam = this.ns.getServerUsedRam(host)
				const freeRam = host === "home" ? Math.max(0, maxRam - usedRam - this.reserve) : Math.max(0, maxRam - usedRam)

				const hostThreads = Math.min(Math.floor(freeRam / ramPerThread), threadsLeft)
				if (hostThreads <= 0) continue

				const pid = this.ns.exec(script, host, hostThreads, target, hostThreads)
				if (pid !== 0) {
					threadsLeft -= hostThreads
					const duration = script === WEAK ? this.ns.getWeakenTime(target) : this.ns.getGrowTime(target)
					if (!jobsEndTimes.has(target)) jobsEndTimes.set(target, [])
					jobsEndTimes.get(target)!.push(Date.now() + duration)
					this.log(`${target}: launched ${script} x${hostThreads}, ETA ${this.ns.format.time(duration)}`)
				}
			}
		}

		// Wait for all jobs in this stage
		while (jobsEndTimes.size > 0) {
			const nextEnd = Math.min(...[...jobsEndTimes.values()].flat())
			const sleepMs = Math.max(0, nextEnd - Date.now() + 50)

			// Log which jobs we're waiting for
			for (const [target, jobs] of jobsEndTimes.entries()) {
				for (const end of jobs) {
					if (end === nextEnd) {
						this.log(`${target}: waiting ${this.ns.format.time(sleepMs)} for ${script} on ${target}`)
					}
				}
			}

			await this.ns.sleep(sleepMs)

			// Remove finished
			for (const [target, ends] of [...jobsEndTimes.entries()]) {
				const remaining = ends.filter(t => t > Date.now())
				if (remaining.length === 0) jobsEndTimes.delete(target)
				else jobsEndTimes.set(target, remaining)
			}
		}
	}

	showFinalStatus() {
		for (const target of this.targets) {
			const money = this.ns.getServerMoneyAvailable(target)
			const maxMoney = this.srvMaxMoney.get(target)!
			const sec = this.ns.getServerSecurityLevel(target)
			const minSec = this.srvMinSec.get(target)!
			this.log(`${target}: READY (${this.formatMoney(money)} / ${this.formatMoney(maxMoney)}, sec ${sec.toFixed(2)} / ${minSec.toFixed(2)})`)

			const tState = this.sm.getTarget(target)
			tState.isPrepped = true
		}
		this.sm.saveState()
	}
}

// -----------------------
// Main entry point
// -----------------------
export async function main(ns: NS) {
	ns.disableLog("ALL")
	ns.clearLog()

	const reserve = ns.args.includes("--reserve") ? Number(ns.args[ns.args.indexOf("--reserve") + 1] ?? 32) : 32
	const sm = new StateManager(ns)
	const prep = new PrepAll(ns, sm, reserve)

	await prep.copyScripts()

	prep.log("=== Stage 1: Weakening servers ===")
	await prep.launchStage(WEAK)

	prep.log("=== Stage 2: Growing servers ===")
	await prep.launchStage(GROW)

	// Final status
	prep.showFinalStatus()

	prep.log("All servers prepped.")
}
