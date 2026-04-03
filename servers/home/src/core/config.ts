export const CONFIG = {
	loopIntervalMs: 2000,

	weakenThreshold: 5,
	growThresholdRatio: 0.75,

	reservedHomeRam: 32,

	workerScripts: {
		hack: "/src/scripts/hack.ts",
		grow: "/src/scripts/grow.ts",
		weaken: "/src/scripts/weaken.ts",
	},

	scriptRamCost: {
		hack: 1.7,
		grow: 1.75,
		weaken: 1.75,
	},
} as const
