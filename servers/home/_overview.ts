interface Module {
	name: string
	type: "script" | "library" | "utility" | "test"
	isEmpty?: boolean
	dependsOn?: string[] // names of other modules this one depends on
}

// List of all modules with dependencies
export const modules: Module[] = [
	// User Scripts / Orchestrators
	{ name: "orchestrator.ts", type: "script", dependsOn: ["farm_manager.ts", "auto_hack.ts", "manage_empire.ts"] },
	{ name: "manage_empire.ts", type: "script", dependsOn: ["buy_servers.ts", "upgrade_servers.ts", "lib/fleet.ts"] },

	// Farming Manager
	{ name: "farm_manager.ts", type: "script", dependsOn: ["farm_all.ts", "retarget_farm.ts", "target_pool.ts"] },
	{ name: "farm_all.ts", type: "script", dependsOn: ["lib/fleet.ts", "prep_all.ts"] },
	{ name: "retarget_farm.ts", type: "script", dependsOn: ["best_target.ts", "target_pool.ts"] },

	// Hacking
	{ name: "auto_hack.ts", type: "script", dependsOn: ["prep_all.ts", "lib/fleet.ts"] },
	{ name: "prep_all.ts", type: "script", dependsOn: ["prep.ts", "prep_grow.ts", "prep_weak.ts"] },

	// Target Selection
	{ name: "best_target.ts", type: "script", dependsOn: ["score_target.ts", "choose_best_target.ts", "sim_target.ts"] },
	{ name: "choose_best_target.ts", type: "script", dependsOn: ["target_pool.ts"] },
	{ name: "score_target.ts", type: "script", dependsOn: ["sim_target.ts"] },
	{ name: "sim_target.ts", type: "script", dependsOn: [] },
	{ name: "target_pool.ts", type: "library", dependsOn: [] },
	{ name: "targeting.ts", type: "library", dependsOn: ["target_pool.ts"] },

	// Prep / Execution
	{ name: "prep.ts", type: "library", dependsOn: [] },
	{ name: "prep_grow.ts", type: "library", dependsOn: ["grow.ts"] },
	{ name: "prep_weak.ts", type: "library", dependsOn: ["weaken.ts"] },
	{ name: "hack.ts", type: "library" },
	{ name: "grow.ts", type: "library" },
	{ name: "weaken.ts", type: "library" },

	// Fleet / RAM
	{ name: "lib/fleet.ts", type: "library", dependsOn: ["lib/pservs.ts", "lib/ram_allocator.ts", "lib/run_alloc.ts"] },
	{ name: "lib/pservs.ts", type: "library" },
	{ name: "lib/ram_allocator.ts", type: "library" },
	{ name: "lib/run_alloc.ts", type: "library" },
	{ name: "buy_servers.ts", type: "script", dependsOn: ["lib/fleet.ts"] },
	{ name: "upgrade_servers.ts", type: "script", dependsOn: ["lib/fleet.ts"] },

	// Network
	{ name: "analyze_network.ts", type: "script", dependsOn: ["lib/network_map.ts"] },
	{ name: "connect_path.ts", type: "script", dependsOn: ["lib/network_map.ts"] },
	{ name: "reset_map.ts", type: "script", dependsOn: ["lib/network_map.ts"] },
	{ name: "lib/network_map.ts", type: "library", dependsOn: ["lib/db/network_map.json"] },
	{ name: "lib/db/network_map.json", type: "utility" },

	// Jobs / Logging
	{ name: "jobs_report.ts", type: "script", dependsOn: ["RoundRobinTargetLogger.ts", "ScriptPort.ts"] },
	{ name: "kill_all_workers.ts", type: "script" },
	{ name: "kill_target_jobs.ts", type: "script" },
	{ name: "RoundRobinTargetLogger.ts", type: "library" },
	{ name: "ScriptPort.ts", type: "library" },

	// Contracts
	{ name: "contracts_scan.ts", type: "script", dependsOn: ["contracts_solve.ts"] },
	{ name: "contracts_solve.ts", type: "script", dependsOn: ["lib/contracts/solvers/algo_stock_trade.ts"] },

	// Corp / Stock
	{ name: "corp_manager.ts", type: "script", isEmpty: true, dependsOn: ["lib/stocks.ts"] },
	{ name: "stock_manager.ts", type: "script", isEmpty: true, dependsOn: ["lib/stocks.ts"] },
	{ name: "lib/stocks.ts", type: "library" },

	// Dashboard / Utilities
	{ name: "dashboard.ts", type: "script", isEmpty: true, dependsOn: ["lib/config_helpers.ts", "lib/events.ts", "lib/state.ts", "ram_widget.ts"] },
	{ name: "ram_widget.ts", type: "script" },
	{ name: "recovery.ts", type: "script" },
	{ name: "lib/config_helpers.ts", type: "library" },
	{ name: "lib/events.ts", type: "library" },
	{ name: "lib/state.ts", type: "library" },

	// Tests
	{ name: "test/ram_alloc_test.ts", type: "test", dependsOn: ["lib/ram_allocator.ts"] },
	{ name: "test/score_targets_test.ts", type: "test", dependsOn: ["score_target.ts"] },
	{ name: "timing_test.ts", type: "test", dependsOn: ["lib/timing.ts"] },
]
