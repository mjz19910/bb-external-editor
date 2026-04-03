declare global {
	type AutomationMode =
		| "bootstrap"
		| "income"
		| "prep"
		| "batch"
		| "expansion"

	interface ServerState {
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
	interface PlayerState {
		hackingLevel: number
		money: number
	}
	interface GameState {
		timestamp: number
		mode: AutomationMode
		player: PlayerState
		servers: ServerState[]
		rootedServers: ServerState[]
		hackableTargets: ServerState[]
		bestTarget: ServerState | null
	}

	type ActionType =
		| "hack"
		| "grow"
		| "weaken"
		| "root"
		| "scan"
		| "idle"

	interface ActionPlan {
		type: ActionType
		target?: string
		reason: string
	}
	interface ExecutionHost {
		hostname: string
		freeRam: number
	}

	interface DispatchResult {
		script: string
		target: string
		totalThreads: number
		launchedProcesses: number
		hostsUsed: number
	}

	interface DesiredJobState {
		action: "hack" | "grow" | "weaken"
		target: string
	}

	interface RunningJobProcess {
		hostname: string
		script: string
		target: string
		threads: number
		pid: number
	}

	interface RunningJobState {
		action: "hack" | "grow" | "weaken" | null
		target: string | null
		processes: RunningJobProcess[]
	}

	interface ReconcileResult {
		changed: boolean
		reason: string
		totalThreads: number
		hostsUsed: number
		launchedProcesses: number
	}

	interface RunningWorkloadState {
		action: "hack" | "grow" | "weaken" | null
		target: string | null
		totalThreads: number
		processes: RunningJobProcess[]
	}
}
