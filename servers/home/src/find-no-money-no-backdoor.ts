/** backdoor-targets.ts */

export async function main(ns: NS) {
	const visited = new Set<string>()
	const queue: string[] = ["home"]

	const targets: string[] = []

	while (queue.length > 0) {
		const host = queue.shift()!
		if (visited.has(host)) continue
		visited.add(host)

		for (const n of ns.scan(host)) {
			if (!visited.has(n)) queue.push(n)
		}

		if (host === "home") continue

		const s = ns.getServer(host)
		if ("depth" in s) continue
		if (s.purchasedByPlayer) continue

		if (
			s.moneyMax === 0 &&
			!s.backdoorInstalled &&
			ns.hasRootAccess(host) &&
			ns.getHackingLevel() >= s.requiredHackingSkill!
		) {
			targets.push(host)
		}
	}

	if (targets.length === 0) {
		return
	}

	for (const t of targets) {
		ns.tprint(`connect ${t}; backdoor\n`)
	}
}