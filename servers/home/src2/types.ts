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

export type FarmLogEvent = {
	target: string
	phase: string
	hackThreads: number
	growThreads: number
	weakenThreads: number
}

export type TargetActivity = {
	key: `${string}:${string}`
	target: string
	lastSeen: number
	eventCount: number
	hackThreads: number
	growThreads: number
	weakenThreads: number
	phase: string
}

export type PrepPlanV1 = {
	needWeaken: number
	needGrow: number
	needGrowWeaken: number
	totalWeaken: number
	isPrepped: boolean
}

export interface PrepPlanOptions {
	growThreshold?: number    // e.g., 0.98 -> grow until 98% max money
	weakenThreshold?: number  // e.g., 1.02 -> weaken until security <= 2% above min
}

export interface PrepPlan {
	growThreads: number
	weakenThreads: number
}
