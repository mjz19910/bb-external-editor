import { CONFIG } from "../core/config"
import { discoverAllServers, collectGameState } from "../core/state"
import { getRunningJobState } from "../services/jobs"
import { tryRootAll } from "../services/network"
import { buildPlan, planToDesiredJobState } from "./planner"
import { reconcileDesiredJobState } from "./reconciler"

export async function runAutomationLoop(ns: NS): Promise<void> {
	ns.disableLog("ALL")

	while (true) {
		const allHosts = discoverAllServers(ns)
		tryRootAll(ns, allHosts)

		const state = collectGameState(ns)
		const plan = buildPlan(state)
		const desired = planToDesiredJobState(plan)
		const running = getRunningJobState(ns, state.rootedServers)

		const reconcile = await reconcileDesiredJobState(
			ns,
			desired,
			running,
			state.rootedServers
		)

		ns.clearLog()
		ns.print(`Mode: ${state.mode}`)
		ns.print(`Rooted: ${state.rootedServers.length}/${state.servers.length}`)
		ns.print(`Hackable Targets: ${state.hackableTargets.length}`)
		ns.print(`Best Target: ${state.bestTarget?.hostname ?? "none"}`)
		ns.print(`Plan: ${plan.type} ${plan.target ?? ""}`)
		ns.print(`Reason: ${plan.reason}`)
		ns.print(
			`Running: ${running.action ?? "none"} ${running.target ?? ""}`.trim()
		)
		ns.print(`Changed: ${reconcile.changed ? "yes" : "no"}`)
		ns.print(`Reconcile: ${reconcile.reason}`)
		ns.print(`Threads: ${reconcile.totalThreads}`)
		ns.print(`Hosts Used: ${reconcile.hostsUsed}`)
		ns.print(`Processes: ${reconcile.launchedProcesses}`)

		await ns.sleep(CONFIG.loopIntervalMs)
	}
}
