import { ScriptPort } from "./ScriptPort"
import { deployScriptSet } from "./lib/fleet"
import { tlog } from "./lib/log"
import { NetworkMap } from "./lib/network_map"
import { HACK, GROW, WEAKEN } from "./lib/paths"
import { MultiTargetFarm } from "./MultiTargetFarm"

type FarmLogEvent = {
	target: string
	phase: string
	hackThreads: number
	growThreads: number
	weakenThreads: number
}

type TargetActivity = {
	key: `${string}:${string}`
	target: string
	lastSeen: number
	eventCount: number
	hackThreads: number
	growThreads: number
	weakenThreads: number
	phase: string
}

class RoundRobinTargetLogger {
	private readonly ns: NS
	private readonly intervalMs: number
	private readonly staleMs: number

	private readonly byKey = new Map<`${string}:${string}`, TargetActivity>()
	private readonly rrOrder: `${string}:${string}`[]
	private rrIdx = 0
	private stopped = false

	constructor(ns: NS, rrOrder: string[], intervalMs = 15_000, staleMs = 15 * 60_000) {
		this.ns = ns
		this.intervalMs = intervalMs
		this.staleMs = staleMs
		this.rrOrder = rrOrder.flatMap(v => [`${v}:stabilize`, `${v}:prep`, `${v}:cycle`] as const)
		this.start()
	}

	public log(ev: FarmLogEvent) {
		const now = Date.now()
		const key: `${string}:${string}` = `${ev.target}:${ev.phase}`
		let row = this.byKey.get(key)
		if (!row) {
			row = {
				key,
				target: ev.target,
				lastSeen: now,
				eventCount: 0,
				hackThreads: 0,
				growThreads: 0,
				weakenThreads: 0,
				phase: ev.phase,
			}
			this.byKey.set(key, row)
		}

		row.lastSeen = now
		row.eventCount += 1
		row.hackThreads += ev.hackThreads
		row.growThreads += ev.growThreads
		row.weakenThreads += ev.weakenThreads
		row.phase = ev.phase
	}

	public shutdown() {
		this.stopped = true
	}

	private start() {
		(async () => {
			await this.ns.asleep(250)
			while (!this.stopped) {
				await this.ns.asleep(this.intervalMs)
				if (this.stopped) break
				this.flushOne()
			}
		})()
	}

	private flushOne() {
		const now = Date.now()

		// normal round-robin candidate
		const rrTarget = this.nextRoundRobinTarget()
		if (!rrTarget) return

		const rrActivity = this.byKey.get(rrTarget)
		if (!rrActivity) return

		let chosen = rrActivity

		// If the RR target is stale, choose the most active target instead
		if (now - rrActivity.lastSeen > this.staleMs) {
			const hottest = this.chooseMostActive()
			if (hottest) chosen = hottest
		}

		const age = now - chosen.lastSeen
		this.ns.tprint(`[Farm Activity] target=${chosen.target} phase=${chosen.phase} events=${chosen.eventCount} hack=${chosen.hackThreads} grow=${chosen.growThreads} weaken=${chosen.weakenThreads} lastSeen=${this.ns.format.time(age)} ago`)

		// reset counters after reporting, but keep lastSeen/lastPhase
		chosen.eventCount = 0
		chosen.hackThreads = 0
		chosen.growThreads = 0
		chosen.weakenThreads = 0
	}

	private nextRoundRobinTarget() {
		let tries = this.rrOrder.length
		while (tries-- > 0) {
			if (this.rrIdx >= this.rrOrder.length) this.rrIdx = 0
			const target = this.rrOrder[this.rrIdx++]
			if (this.byKey.has(target)) return target
		}
		return null
	}

	private chooseMostActive(): TargetActivity | null {
		let best: TargetActivity | null = null

		for (const row of this.byKey.values()) {
			const score =
				row.eventCount * 1000 +
				row.hackThreads +
				row.growThreads +
				row.weakenThreads

			if (!best) {
				best = row
				continue
			}

			const bestScore =
				best.eventCount * 1000 +
				best.hackThreads +
				best.growThreads +
				best.weakenThreads

			if (score > bestScore) best = row
		}

		return best
	}
}

/** Main entry point */
export async function main(ns: NS) {
	ns.disableLog("disableLog")
	MultiTargetFarm.disableLogs(ns)

	const hackPct = Number(ns.args[0] ?? 0.1)
	const map = NetworkMap.build(ns)

	ns.ui.setTailTitle(`Farm Manager hackPercent=${hackPct}`)
	tlog(ns, `[Farm Manager] hackPercent=${hackPct}`)
	deployScriptSet(ns, [HACK, GROW, WEAKEN], map.hosts)

	const logger = new RoundRobinTargetLogger(ns, map.hosts)
	const raceArr: Promise<null | void>[] = []
	const farms: MultiTargetFarm[] = []
	let farmIdBase = 1

	function addFarm(arr: MultiTargetFarm[], hackPct: number, logger: RoundRobinTargetLogger, silent = false) {
		if (!silent) {
			tlog(ns, `[Farm;id=${farmIdBase}] Starting`)
		}
		const farm = new MultiTargetFarm(ns, hackPct, map)
		farm.setLogger(logger)
		arr.push(farm)
		raceArr.push(farm.runForever())
		farmIdBase++
		return farm
	}

	let running = true

	ns.atExit(() => {
		for (const farm of farms) {
			farm.shutdown()
		}
		logger.shutdown()
		running = false
	})

	const port = new ScriptPort<{
		msg: true
		hackPct?: number
	}>(ns, 1)
	raceArr.push(port.nextWrite().then(() => null))

	async function slowStart() {
		let hadAnyErrors = false
		// 1 = 131.04TB + 216.96TB
		// 2 = 38% of pserv-01
		// 3 = 1.26PB
		// 4 =
		// 40 = 11

		for (let i = 0; i < 55; i++) {
			addFarm(farms, hackPct, logger, true)
		}
		await ns.asleep(15_000)
		const errs = farms.filter(v => v.hasErrors())
		if (errs.length > 0) {
			ns.tprint("farms that have errors ", errs.map(v => farms.indexOf(v)))
			return
		}

		for (let i = 0; i < 25; i++) {
			addFarm(farms, hackPct, logger)
			do {
				await ns.asleep(4_000)
				if (!running) break
				const errs = farms.filter(v => v.hasErrors())
				if (errs.length > 0) {
					ns.tprint("farms that have errors ", errs.map(v => farms.indexOf(v)))
					hadAnyErrors = true
				}
			} while (farms.some(v => v.hasErrors()))
			if (hadAnyErrors) break
			if (!running) break
		}
		ns.tprint("[Farm Manager] ", farms.length, " farms are now running")
	}
	raceArr.push(slowStart())

	for (; ;) {
		const { idx, result } = await Promise.race(raceArr.map(async (promise, idx) => ({ idx, result: await promise })))
		raceArr.splice(idx, 1)
		if (result === void 0) continue
		const msgs = port.readAll()
		ns.tprint("got messages ", msgs)
		raceArr.push(port.nextWrite().then(() => null))
		for (const msg of msgs) {
			addFarm(farms, msg.hackPct ?? hackPct, logger)
		}
	}
}
