export type AutomationMode =
	| "bootstrap"
	| "income"
	| "prep"
	| "batch"
	| "expansion"

export interface ServerState {
	hostname: string
	rooted: boolean
	requiredHackingLevel: number
	maxMoney: number
	currentMoney: number
	minSecurity: number
	currentSecurity: number
	maxRam: number
	usedRam: number
	hasBackdoor: boolean
	growth: number
}

export interface PlayerState {
	hackingLevel: number
	money: number
}

export interface GameState {
	timestamp: number
	mode: AutomationMode
	player: PlayerState
	servers: ServerState[]
	rootedServers: ServerState[]
	hackableTargets: ServerState[]
	bestTarget: ServerState | null
}

export type ActionType =
	| "hack"
	| "grow"
	| "weaken"
	| "root"
	| "scan"
	| "idle"

export interface ActionPlan {
	type: ActionType
	target?: string
	reason: string
}

export interface ExecutionHost {
	hostname: string
	freeRam: number
}

export interface DispatchResult {
	script: string
	target: string
	totalThreads: number
	launchedProcesses: number
	hostsUsed: number
}

export interface DesiredWorkload {
	action: "hack" | "grow" | "weaken"
	target: string
	desiredThreads: number
	priority: number
	reason: string
}

export interface ScheduledAllocation {
	hostname: string
	action: "hack" | "grow" | "weaken"
	target: string
	threads: number
}

export interface RunningJobProcess {
	hostname: string
	script: string
	target: string
	threads: number
	pid: number
}

export interface RunningWorkloadGroup {
	action: "hack" | "grow" | "weaken"
	target: string
	totalThreads: number
	processes: RunningJobProcess[]
}

export interface RunningFleetState {
	processes: RunningJobProcess[]
	workloads: RunningWorkloadGroup[]
	allocations: ScheduledAllocation[]
}

export interface AllocationDiff {
	keep: ScheduledAllocation[]
	start: ScheduledAllocation[]
	stop: ScheduledAllocation[]
}

export interface ReconcileResult {
	changed: boolean
	reason: string
	totalThreads: number
	hostsUsed: number
	launchedProcesses: number
	scheduledAllocations: number
}
