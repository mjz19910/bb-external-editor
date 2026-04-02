import { ScriptPort } from "./ScriptPort"
import { deployScriptSet } from "./lib/fleet"
import { tlog } from "./lib/log"
import { NetworkMap } from "./lib/network_map"
import { HACK, GROW, WEAKEN } from "./lib/paths"
import { MultiTargetFarm } from "./smart_farm"

type FarmLogEvent = {
	target: string
	phase: string
	hackThreads: number
	growThreads: number
	weakenThreads: number
}

type TargetActivity = {
	target: string
	lastSeen: number
	eventCount: number
	hackThreads: number
	growThreads: number
	weakenThreads: number
	lastPhase: string
}

class RoundRobinTargetLogger {
	private readonly ns: NS
	private readonly intervalMs: number
	private readonly staleMs: number

	private readonly byTarget = new Map<string, TargetActivity>()
	private readonly rrOrder: string[] = []
	private rrIdx = 0
	private stopped = false

	constructor(ns: NS, intervalMs = 10_000, staleMs = 5 * 60_000) {
		this.ns = ns
		this.intervalMs = intervalMs
		this.staleMs = staleMs
		this.start()
	}

	public log(ev: FarmLogEvent) {
		const now = Date.now()
		let row = this.byTarget.get(ev.target)
		if (!row) {
			row = {
				target: ev.target,
				lastSeen: now,
				eventCount: 0,
				hackThreads: 0,
				growThreads: 0,
				weakenThreads: 0,
				lastPhase: ev.phase,
			}
			this.byTarget.set(ev.target, row)
			this.rrOrder.push(ev.target)
		}

		row.lastSeen = now
		row.eventCount += 1
		row.hackThreads += ev.hackThreads
		row.growThreads += ev.growThreads
		row.weakenThreads += ev.weakenThreads
		row.lastPhase = ev.phase
	}

	public shutdown() {
		this.stopped = true
	}

	private start() {
		(async () => {
			while (!this.stopped) {
				await this.ns.asleep(this.intervalMs)
				if (this.stopped) break
				this.flushOne()
			}
		})()
	}

	private flushOne() {
		if (this.rrOrder.length === 0) return

		const now = Date.now()

		// normal round-robin candidate
		const rrTarget = this.nextRoundRobinTarget()
		if (!rrTarget) return

		const rrActivity = this.byTarget.get(rrTarget)
		if (!rrActivity) return

		let chosen = rrActivity

		// If the RR target is stale, choose the most active target instead
		if (now - rrActivity.lastSeen > this.staleMs) {
			const hottest = this.chooseMostActive()
			if (hottest) chosen = hottest
		}

		const age = now - chosen.lastSeen
		tlog(
			this.ns,
			[
				`[Farm Activity]`,
				`target=${chosen.target}`,
				`phase=${chosen.lastPhase}`,
				`events=${chosen.eventCount}`,
				`hack=${chosen.hackThreads}`,
				`grow=${chosen.growThreads}`,
				`weaken=${chosen.weakenThreads}`,
				`lastSeen=${this.ns.format.time(age)} ago`,
			].join(" ")
		)

		// reset counters after reporting, but keep lastSeen/lastPhase
		chosen.eventCount = 0
		chosen.hackThreads = 0
		chosen.growThreads = 0
		chosen.weakenThreads = 0
	}

	private nextRoundRobinTarget(): string | null {
		if (this.rrOrder.length === 0) return null

		let tries = this.rrOrder.length
		while (tries-- > 0) {
			if (this.rrIdx >= this.rrOrder.length) this.rrIdx = 0
			const target = this.rrOrder[this.rrIdx++]
			if (this.byTarget.has(target)) return target
		}
		return null
	}

	private chooseMostActive(): TargetActivity | null {
		let best: TargetActivity | null = null

		for (const row of this.byTarget.values()) {
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

	const logger = new RoundRobinTargetLogger(ns, 30_000, 60_000)

	const farms: MultiTargetFarm[] = []
	for (let i = 0; i < 60; i++) {
		const farm = new MultiTargetFarm(ns, hackPct, map)
		farm.setLogger(logger)
		farms.push(farm)
	}
	ns.atExit(() => {
		for (const farm of farms) {
			farm.shutdown()
		}
	})

	const port = new ScriptPort<{ msg: true }>(ns, 1)
	const raceArr = []
	raceArr.push((async () => {
		for (const [idx, farm] of farms.entries()) {
			raceArr.push((async () => {
				tlog(ns, `[Farm;id=${idx + 1}] Starting`)
				return await farm.runForever()
			})())
		}
	})())
	raceArr.push(port.nextWrite().then(() => port))
	for (; ;) {
		const [idx, results]: [number, ScriptPort<{ msg: true }> | void] = await Promise.race(raceArr.map(async (v, i) => [i, await v] as [number, Awaited<typeof v>]))
		raceArr.splice(idx, 1)
		if (results instanceof ScriptPort) {
			const msgs = results.readAll()
			ns.tprint("got messages ", msgs)
			const nextWriteResult = results.nextWrite()
			raceArr.push((async () => {
				for (const _msg of msgs) {
					raceArr.push((async () => {
						const farm = new MultiTargetFarm(ns, hackPct, map)
						farm.setLogger(logger)
						farms.push(farm)
						tlog(ns, `[Farm;id=${farms.length}] Starting`)
						return await farm.runForever()
					})())
				}
				raceArr.push(nextWriteResult.then(() => results))
			})())
		}
	}
}
