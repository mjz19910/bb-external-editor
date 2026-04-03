import { deployScriptSet } from "./fleet"
import { tlog } from "./log"
import { NetworkMap } from "./network_map"
import { HACK, GROW, WEAKEN } from "./paths"
import { MultiTargetFarm } from "./MultiTargetFarm"
import { RoundRobinTargetLogger } from "./RoundRobinTargetLogger"

const Null = "NULL PORT DATA" as const
type Null = typeof Null

function readPort<T>(port: NetscriptPort): T | Null {
	return port.read() as T | Null
}

function fromRaw<U>(value: U | Null): U | undefined {
	return value === Null ? undefined : value
}

function assertNotNull<U>(value: U | Null): U {
	if (value === Null) throw new Error("Invalid state")
	return value
}

function peekPort<T>(port: NetscriptPort): T | Null {
	return port.peek() as T | Null
}

export function rawRead<T>(port: NetscriptPort): T | undefined {
	return fromRaw(readPort(port))
}

function mustRead<T>(port: NetscriptPort): T {
	return assertNotNull(readPort(port))
}

function mustPeek<T>(port: NetscriptPort): T {
	return assertNotNull(peekPort(port))
}

type OptNone = { type: "None" }
type OptSome<T> = { type: "Some"; value: T }
type Optional<T> = OptNone | OptSome<T>

function optFromRaw<U>(value: U | Null): Optional<U> {
	return value === Null ? { type: "None" } : { type: "Some", value }
}

function rawReadOpt<T>(port: NetscriptPort): Optional<T> {
	return optFromRaw<T>(readPort(port))
}

function writePort<TIn, TOut = TIn>(port: NetscriptPort, input: TIn): TOut | Null {
	return port.write(input) as TOut | Null
}

function rawWrite<TIn, TOut = TIn>(port: NetscriptPort, input: TIn): TOut | undefined {
	return fromRaw(writePort(port, input))
}

function rawWriteOpt<TIn, TOut = TIn>(port: NetscriptPort, input: TIn): Optional<TOut> {
	return optFromRaw<TOut>(writePort(port, input))
}

class ScriptPort<BaseType> {
	static open_api_port(ns: NS) {
		return new ScriptPort<{ msgType: "api" }>(ns, 1)
	}

	static open_reply_port(ns: NS) {
		return new ScriptPort<{ msgType: "reply" }>(ns, 2)
	}

	static open_request_port(ns: NS) {
		return new ScriptPort<{ msgType: "request" }>(ns, 3)
	}

	readonly ns: NS
	readonly port_id: number
	readonly #port: NetscriptPort

	constructor(ns: NS, port_id: number) {
		this.ns = ns
		this.port_id = port_id
		this.#port = ns.getPortHandle(port_id)
	}

	peek<T extends BaseType = BaseType>(): T {
		return mustPeek<T>(this.#port)
	}

	read<T extends BaseType = BaseType>(): T {
		return mustRead<T>(this.#port)
	}

	tryRead<T extends BaseType = BaseType>(): T | undefined {
		return rawRead<T>(this.#port)
	}

	readOpt<T extends BaseType = BaseType>(): Optional<T> {
		return rawReadOpt<T>(this.#port)
	}

	readAll<T extends BaseType = BaseType>(): T[] {
		const results: T[] = []
		for (; ;) {
			const data = rawRead<T>(this.#port)
			if (data === void 0) break
			results.push(data)
		}
		return results
	}

	write<T extends BaseType = BaseType>(data: T) {
		return rawWrite<T, Null>(this.#port, data)
	}

	writePrev<T extends BaseType = BaseType>(data: T): T | undefined {
		return fromRaw(rawWrite<T>(this.#port, data))
	}

	writePrevOpt<T extends BaseType = BaseType>(data: T): Optional<T> {
		return rawWriteOpt<T>(this.#port, data)
	}

	tryWrite<T extends BaseType = BaseType>(data: T): boolean {
		return this.#port.tryWrite(data)
	}

	nextWrite() { return this.#port.nextWrite() }
	full() { return this.#port.full() }
	empty() { return this.#port.empty() }
	clear() { this.#port.clear() }
}


/** Main entry point */
export async function main(ns: NS) {
	ns.disableLog("disableLog")
	MultiTargetFarm.disableLogs(ns)

	const hackPct = Number(ns.args[0] ?? 0.1)
	const map = NetworkMap.build(ns)

	ns.ui.setTailTitle(`Farm Manager hackPercent=${hackPct}`)
	tlog(ns, `[Farm Manager] hackPercent=${hackPct}`)
	deployScriptSet(ns, [HACK, GROW, WEAKEN], map.allHosts)

	const logger = new RoundRobinTargetLogger(ns, map.allHosts)
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
		for (let i = 0; i < 20; i++) {
			addFarm(farms, hackPct, logger)
		}

		let hadAnyErrors = false
		// 1 = 131.04TB + 216.96TB
		// 2 = 38% of pserv-01
		// 3 = 1.26PB
		// 4 =
		// 40 = 11
		for (let i = 0; i < 18; i++) {
			addFarm(farms, hackPct, logger)
			ns.print("added farm id=", farms.length)
			do {
				await ns.asleep(5_500)
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
			ns.print("added farm id=", farms.length)
			await ns.asleep(5_500)
			const errs = farms.filter(v => v.hasErrors())
			if (errs.length > 0) {
				ns.tprint("farms that have errors ", errs.map(v => farms.indexOf(v)))
			}
		}
	}
}
