export type RunningWorkloadState = {
	action: "hack" | "grow" | "weaken" | null
	target: string | null
	totalThreads: number
	processes: RunningJobProcess[]
}

export type AutomationMode =
	| "bootstrap"
	| "income"
	| "prep"
	| "batch"
	| "expansion"

export type ServerState = {
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

export type PlayerState = {
	hackingLevel: number
	money: number
}

export type GameState = {
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

export type ActionPlan = {
	type: ActionType
	target?: string
	reason: string
}

export type ExecutionHost = {
	hostname: string
	freeRam: number
}

export type DispatchResult = {
	script: string
	target: string
	totalThreads: number
	launchedProcesses: number
	hostsUsed: number
}

export type DesiredWorkload = {
	action: "hack" | "grow" | "weaken"
	target: string
	desiredThreads: number
	priority: number
	reason: string
}

export type ScheduledAllocation = {
	hostname: string
	action: "hack" | "grow" | "weaken"
	target: string
	threads: number
}

export type RunningJobProcess = {
	hostname: string
	script: string
	target: string
	threads: number
	pid: number
}

export type RunningWorkloadGroup = {
	action: "hack" | "grow" | "weaken"
	target: string
	totalThreads: number
	processes: RunningJobProcess[]
}

export type RunningFleetState = {
	processes: RunningJobProcess[]
	workloads: RunningWorkloadGroup[]
	allocations: ScheduledAllocation[]
}

export type AllocationDiff = {
	keep: ScheduledAllocation[]
	start: ScheduledAllocation[]
	stop: ScheduledAllocation[]
}

export type ReconcileResult = {
	changed: boolean
	reason: string
	totalThreads: number
	hostsUsed: number
	launchedProcesses: number
	scheduledAllocations: number
}
