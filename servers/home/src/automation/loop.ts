import { collectGameState } from "../core/state"
import { getRunningFleetState } from "../services/jobs"
import { buildDesiredWorkloads } from "../automation/planner"
import { reconcileFleetWorkloads } from "../automation/reconciler"
import {
	getTargetRegistry,
	setTargetRegistry,
	loadTargetRegistry,
	saveTargetRegistry,
} from "../core/registry"
import { reconcileTargetRegistry } from "../services/targetLifecycle"

export async function runAutomationLoop(ns: NS): Promise<void> {
	ns.disableLog("ALL")
	ns.ui.openTail()

	loadTargetRegistry(ns)

	while (true) {
		const state = collectGameState(ns)
		const runningFleet = getRunningFleetState(ns, state.rootedServers)

		const priorRegistry = getTargetRegistry()
		const nextRegistry = reconcileTargetRegistry(
			state.targetStates,
			priorRegistry,
			state.timestamp
		)
		setTargetRegistry(nextRegistry)

		const desiredWorkloads = buildDesiredWorkloads(ns, state, nextRegistry)
		const reconcile = await reconcileFleetWorkloads(
			ns,
			desiredWorkloads,
			runningFleet,
			state.rootedServers
		)

		saveTargetRegistry(ns)

		ns.clearLog()
		ns.print(`Mode: ${state.mode}`)
		ns.print(`Rooted: ${state.rootedServers.length}/${state.servers.length}`)
		ns.print(`Hackable Targets: ${state.hackableTargets.length}`)
		ns.print(`Best Target: ${state.bestTarget?.hostname ?? "none"}`)
		ns.print(`Active Farm: ${nextRegistry.activeFarmTarget ?? "none"}`)
		ns.print(`Desired Workloads: ${desiredWorkloads.length}`)
		ns.print(`Running Workloads: ${runningFleet.workloads.length}`)
		ns.print(`Running Allocations: ${runningFleet.allocations.length}`)
		ns.print(`Changed: ${reconcile.changed ? "yes" : "no"}`)
		ns.print(`Reconcile: ${reconcile.reason}`)
		ns.print(`Threads: ${reconcile.totalThreads}`)
		ns.print(`Hosts Used: ${reconcile.hostsUsed}`)
		ns.print(`Processes Launched: ${reconcile.launchedProcesses}`)
		ns.print(`Scheduled Allocations: ${reconcile.scheduledAllocations}`)
		ns.print("--- DESIRED ---")

		for (const workload of desiredWorkloads.slice(0, 8)) {
			ns.print(
				`D: ${workload.action} ${workload.target} ${workload.desiredThreads}t p=${workload.priority.toFixed(1)}`
			)
		}

		ns.print("--- TRACKED TARGETS ---")
		for (const target of Object.values(nextRegistry.byHostname)
			.sort((a, b) => b.score - a.score)
			.slice(0, 10)) {
			ns.print(
				`T: ${target.hostname} lifecycle=${target.lifecycle} observed=${target.observedLifecycle} active=${target.isActiveFarm ? "yes" : "no"} readyStreak=${target.readyStreak} transitions=${target.transitions}`
			)
		}

		await ns.sleep(2000)
	}
}
