// network_map.ts
const DB_PATH = "lib/db/network_map.json"

type NetworkNode = {
	host: string
	parent: string | null
	depth: number
	neighbors: string[]
}

class NetworkMap {
	static loadFromDisk(ns: NS, DB_PATH: string): NetworkMap | null {
		if (!ns.fileExists(DB_PATH)) {
			return null
		}

		const json_txt = ns.read(DB_PATH)
		const net_map: NetworkMap = JSON.parse(json_txt)

		if (!("ramSizes" in net_map)) {
			return null
		}

		const newMap = new NetworkMap()

		newMap.allHosts = net_map.allHosts

		// upgrade the schema
		if ("hosts" in net_map) {
			newMap.allHosts = net_map.hosts as string[]
		}

		newMap.nodes = net_map.nodes
		newMap.ramSizes = net_map.ramSizes

		return newMap
	}
	constructor(
		public allHosts: string[] = [],
		public nodes: Record<string, NetworkNode> = {},
		public ramSizes: Record<string, number> = {},
	) { }
	getRamInfo(ns: NS, host: string) {
		const maxRam = this.ramSizes[host]
		const usedRam = ns.getServerUsedRam(host)
		const free = maxRam - usedRam
		return {
			host,
			maxRam,
			usedRam,
			freeRam: free,
		}
	}
	findBestTarget(ns: NS) {
		const myHacking = ns.getHackingLevel()
		const map = this

		let best = null
		let bestValue = 0

		for (const s of map.allHosts) {
			if (s === "home") continue
			if (!ns.hasRootAccess(s)) continue
			if (ns.getServerRequiredHackingLevel(s) > (myHacking / 2) + 2) {
				continue
			}

			const maxMoney = ns.getServerMaxMoney(s)
			if (maxMoney <= 0) continue

			const reqHack = ns.getServerRequiredHackingLevel(s)
			const minSec = ns.getServerMinSecurityLevel(s)
			const growth = ns.getServerGrowth(s)
			const score = (maxMoney * growth) / Math.max(1, minSec * reqHack)

			if (score > bestValue) {
				bestValue = score
				best = s
			}
		}

		return best
	}
	addNodes(ns: NS, parent: string, hosts: string[]) {
		const pn = this.nodes[parent]
		for (const host of hosts) {
			this.nodes[host] = {
				host,
				parent,
				depth: pn.depth + 1,
				neighbors: ns.scan(host),
			}
			this.allHosts.push(host)
			this.ramSizes[host] = ns.getServerMaxRam(host)
		}
		const json_txt = JSON.stringify(this, void 0, "\t")
		ns.write(DB_PATH, json_txt, "w")
	}
	static build(ns: NS, start = "home") {
		return buildNetworkMap(ns, start)
	}
	update_single_host(ns: NS, host: string) {
		this.ramSizes[host] = ns.getServerMaxRam(host)
	}
}

let saved_map_invalid = false
let network_map: NetworkMap | null = null

function buildNetworkMap(ns: NS, start = "home"): NetworkMap {
	x: if (network_map) {
		const hosts = network_map.allHosts
		const nodes = network_map.nodes
		const hosts_len = hosts.length
		const recheck_idx = Math.floor(Math.random() * hosts_len)
		const check_host = hosts[recheck_idx]
		const scan_results = ns.scan(check_host)
		const nn = nodes[check_host]
		if (scan_results.length != nn.neighbors.length) {
			network_map = null
			saved_map_invalid = true
			break x
		}
		for (let i = 0; i < 3; i++) {
			const idx = Math.floor(Math.random() * hosts_len)
			network_map.update_single_host(ns, hosts[idx])
		}
		return network_map
	}
	if (!saved_map_invalid) {
		network_map = NetworkMap.loadFromDisk(ns, DB_PATH)
		if (network_map) return network_map
	}
	const nodes: Record<string, NetworkNode> = {}
	const queue: string[] = [start]
	const seen = new Set<string>([start])

	nodes[start] = {
		host: start,
		parent: null,
		depth: 0,
		neighbors: ns.scan(start),
	}

	while (queue.length > 0) {
		const host = queue.shift()!
		const depth = nodes[host].depth

		for (const next of ns.scan(host)) {
			if (seen.has(next)) continue
			seen.add(next)

			nodes[next] = {
				host: next,
				parent: host,
				depth: depth + 1,
				neighbors: ns.scan(next),
			}

			queue.push(next)
		}
	}

	const hosts = Object.keys(nodes)
	const ramSizes: Record<string, number> = {}
	for (const host of hosts) {
		ramSizes[host] = ns.getServerMaxRam(host)
	}
	network_map = new NetworkMap(hosts, nodes, ramSizes)
	const json_txt = JSON.stringify(network_map, void 0, "\t")
	ns.write(DB_PATH, json_txt, "w")
	return network_map
}

function pathTo(map: NetworkMap, target: string): string[] {
	if (!map.nodes[target]) return []

	const path: string[] = []
	let cur: string | null = target

	while (cur !== null) {
		path.push(cur)
		cur = map.nodes[cur]?.parent ?? null
	}

	return path.reverse()
}

type ServerClass = "farmable" | "rootable" | "future" | "useless"

function countPortOpeners(ns: NS): number {
	let count = 0
	if (ns.fileExists("BruteSSH.exe", "home")) count++
	if (ns.fileExists("FTPCrack.exe", "home")) count++
	if (ns.fileExists("relaySMTP.exe", "home")) count++
	if (ns.fileExists("HTTPWorm.exe", "home")) count++
	if (ns.fileExists("SQLInject.exe", "home")) count++
	return count
}

// lib/state.ts
const STATE_FILE = "/lib/db/state.json"

type TargetState = {
	name: string
	moneyPercent: number
	security: number
	lastPrep: number
	isPrepped: boolean
	activeBatches: number
}

type ServerState = {
	hostname: string
	maxRam: number
	usedRam: number
	activeJobs: string[]
}

type PersistentState = {
	targets: Record<string, TargetState>
	servers: Record<string, ServerState>
	lastUpdated: number
}

class StateManager {
	ns: NS
	state: PersistentState

	constructor(ns: NS) {
		this.ns = ns
		this.state = this.loadState()
	}

	loadState(): PersistentState {
		try {
			const data = this.ns.read(STATE_FILE)
			if (!data) throw new Error("No state file")
			return JSON.parse(data) as PersistentState
		} catch {
			return { targets: {}, servers: {}, lastUpdated: Date.now() }
		}
	}

	saveState(): void {
		this.state.lastUpdated = Date.now()
		const saveData = JSON.stringify(this.state, void 0, "\t")
		this.ns.write(STATE_FILE, saveData, "w")
	}

	getTarget(name: string): TargetState {
		if (!this.state.targets[name]) {
			this.state.targets[name] = {
				name,
				moneyPercent: 100,
				security: 0,
				lastPrep: 0,
				isPrepped: false,
				activeBatches: 0,
			}
		}
		return this.state.targets[name]
	}

	updateTarget(name: string, updates: Partial<TargetState>) {
		const t = this.getTarget(name)
		Object.assign(t, updates)
		this.saveState()
	}

	getServer(hostname: string): ServerState {
		if (!this.state.servers[hostname]) {
			const maxRam = this.ns.getServerMaxRam(hostname)
			this.state.servers[hostname] = { hostname, maxRam, usedRam: 0, activeJobs: [] }
		}
		return this.state.servers[hostname]
	}

	updateServer(hostname: string, updates: Partial<ServerState>) {
		const s = this.getServer(hostname)
		Object.assign(s, updates)
		this.saveState()
	}
}

/** prep_all_class_main.ts
 * Class-based server prep: weaken then grow to max money
 * Usage:
 *   run prep_all_class_main.ts
 *   run prep_all_class_main.ts --reserve 32
 */
const GROW = "lib/prep_grow.ts"
const WEAK = "lib/prep_weak.ts"
const all_scripts = [GROW, WEAK]

class PrepAll {
	private map: ReturnType<typeof buildNetworkMap>
	private hosts: string[]
	private targets: string[]
	private srvMaxMoney = new Map<string, number>()
	private srvMinSec = new Map<string, number>()
	private maxRamByHost = new Map<string, number>()
	private scriptRamMap = new Map<string, number>()

	constructor(public ns: NS, public sm: StateManager, public reserve: number = 32) {
		this.map = buildNetworkMap(ns)
		this.hosts = this.map.allHosts.filter(h => ns.hasRootAccess(h))
		this.targets = this.hosts.filter(h => h !== "home")
		for (const host of this.hosts) this.maxRamByHost.set(host, this.map.ramSizes[host])
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
