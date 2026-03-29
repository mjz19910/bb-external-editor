export type NetworkRamInfo = {
	total: number
	used: number
	available: number
	hosts: {
		host: string
		total: number
		used: number
		available: number
	}[]
}

export function scanAll(ns: NS, start = "home"): string[] {
	const seen = new Set<string>()
	const q = [start]

	while (q.length > 0) {
		const host = q.shift()!
		if (seen.has(host)) continue
		seen.add(host)

		for (const n of ns.scan(host)) {
			if (!seen.has(n)) q.push(n)
		}
	}

	return [...seen]
}

export function getNetworkAvailableRam(
	ns: NS,
	opts?: {
		includeHome?: boolean
		homeReserveFrac?: number
		homeReserveAbs?: number
	}
): NetworkRamInfo {
	const includeHome = opts?.includeHome ?? true
	const homeReserveFrac = opts?.homeReserveFrac ?? 0
	const homeReserveAbs = opts?.homeReserveAbs ?? 0

	const hosts = scanAll(ns)
		.filter(host => ns.hasRootAccess(host))
		.filter(host => includeHome || host !== "home")
		.filter(host => ns.getServerMaxRam(host) > 0)
		.map(host => {
			const total = ns.getServerMaxRam(host)
			const used = ns.getServerUsedRam(host)

			let available = Math.max(0, total - used)

			if (host === "home") {
				const reserve = Math.max(total * homeReserveFrac, homeReserveAbs)
				available = Math.max(0, total - used - reserve)
			}

			return {
				host,
				total,
				used,
				available,
			}
		})

	const total = hosts.reduce((a, h) => a + h.total, 0)
	const used = hosts.reduce((a, h) => a + h.used, 0)
	const available = hosts.reduce((a, h) => a + h.available, 0)

	return {
		total,
		used,
		available,
		hosts,
	}
}

export async function main(ns: NS) {
	const ram = getNetworkAvailableRam(ns, {
		includeHome: true,
		homeReserveFrac: 0.02,
	})

	ns.tprint(`network total ram: ${ns.format.ram(ram.total)}`)
	ns.tprint(`network used ram: ${ns.format.ram(ram.used)}`)
	ns.tprint(`network available ram: ${ns.format.ram(ram.available)}`)
}
