export const CONFIG = {
	loopIntervalMs: 2000,

	weakenThreshold: 5,
	growThresholdRatio: 0.75,

	reservedHomeRam: 32,

	prep: {
		maxWeakenThreads: 5000,
		maxGrowThreads: 5000,
		maxHackThreads: 5000,
		targetHackFraction: 0.25,
	},

	planner: {
		maxTargetsToEvaluate: 5,
		maxDesiredWorkloads: 6,
		maxActiveFarmTargets: 3,
		activeFarmScoreBias: 1.15,
		readyPromotionStreak: 3,
	},

	workloadTolerance: {
		minThreadDifferenceToRedeploy: 0.15, // 15%
	},

	workerScripts: {
		hack: "src/scripts/hack.ts",
		grow: "src/scripts/grow.ts",
		weaken: "src/scripts/weaken.ts",
	},

	scriptRamCost: {
		hack: 1.7,
		grow: 1.75,
		weaken: 1.75,
	},
} as const
