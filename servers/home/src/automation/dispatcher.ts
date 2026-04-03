import { CONFIG } from "../core/config"
import { ActionPlan, DispatchResult, ServerState } from "../core/types"
import { dispatchScript, ensureWorkerScripts, getExecutionHosts, killManagedScripts } from "../services/executor"

export function executePlan(
	ns: NS,
	plan: ActionPlan,
	rootedServers: ServerState[]
): DispatchResult | null {
	if (!plan.target) return null

	const hosts = getExecutionHosts(ns, rootedServers)
	if (hosts.length === 0) return null

	ensureWorkerScripts(
		ns,
		hosts.map((h) => h.hostname)
	)

	killManagedScripts(
		ns,
		hosts.map((h) => h.hostname)
	)

	switch (plan.type) {
		case "hack":
			return dispatchScript(ns, CONFIG.workerScripts.hack, plan.target, hosts)

		case "grow":
			return dispatchScript(ns, CONFIG.workerScripts.grow, plan.target, hosts)

		case "weaken":
			return dispatchScript(ns, CONFIG.workerScripts.weaken, plan.target, hosts)

		default:
			return null
	}
}
