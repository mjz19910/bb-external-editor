import { CONFIG } from "../core/config"
import { discoverAllServers, collectGameState } from "../core/state"
import { getRunningFleetState } from "../services/jobs"
import { tryRootAll } from "../services/network"
import { buildDesiredWorkloads } from "./planner"
import { reconcileFleetWorkloads } from "./reconciler"

export async function runAutomationLoop(ns: NS): Promise<void> {
	ns.disableLog("ALL")

	while (true) {
		const allHosts = discoverAllServers(ns)
		tryRootAll(ns, allHosts)

		const state = collectGameState(ns)
		const desiredWorkloads = buildDesiredWorkloads(ns, state)
		const runningFleet = getRunningFleetState(ns, state.rootedServers)

		const reconcile = await reconcileFleetWorkloads(
			ns,
			desiredWorkloads,
			runningFleet,
			state.rootedServers
		)

		ns.clearLog()
		ns.print(`Mode: ${state.mode}`)
		ns.print(`Rooted: ${state.rootedServers.length}/${state.servers.length}`)
		ns.print(`Hackable Targets: ${state.hackableTargets.length}`)
		ns.print(`Best Target: ${state.bestTarget?.hostname ?? "none"}`)
		ns.print(`Desired Workloads: ${desiredWorkloads.length}`)
		ns.print(`Running Workloads: ${runningFleet.workloads.length}`)
		ns.print(`Changed: ${reconcile.changed ? "yes" : "no"}`)
		ns.print(`Reconcile: ${reconcile.reason}`)
		ns.print(`Threads: ${reconcile.totalThreads}`)
		ns.print(`Hosts Used: ${reconcile.hostsUsed}`)
		ns.print(`Processes: ${reconcile.launchedProcesses}`)
		ns.print(`Allocations: ${reconcile.scheduledAllocations}`)
		ns.print("---")

		for (const workload of desiredWorkloads.slice(0, 8)) {
			ns.print(
				`D: ${workload.action} ${workload.target} ${workload.desiredThreads}t p=${workload.priority.toFixed(1)}`
			)
		}

		ns.print("---")

		for (const workload of runningFleet.workloads.slice(0, 8)) {
			ns.print(
				`R: ${workload.action} ${workload.target} ${workload.totalThreads}t`
			)
		}

		await ns.sleep(CONFIG.loopIntervalMs)
	}
}
