// lib/state.ts
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

export type PersistentState = {
	targets: Record<string, TargetState>
	servers: Record<string, ServerState>
	lastUpdated: number
}

const STATE_FILE = "/lib/db/state.json"

export class StateManager {
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
