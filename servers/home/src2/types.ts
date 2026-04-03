export type ServerClass = "farmable" | "rootable" | "future" | "useless"
export type JobPhase = "weaken" | "grow" | "hack"

export type TargetState = {
	name: string
	moneyPercent: number
	security: number
	lastPrep: number
	isPrepped: boolean
	activeBatches: number
}

export type ServerState = {
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

export type NetworkNode = {
	host: string
	parent: string | null
	depth: number
	neighbors: string[]
}
