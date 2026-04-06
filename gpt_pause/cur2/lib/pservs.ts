type PurchasedServerInfo = {
	host: string
	ram: number
	usedRam: number
	freeRam: number
}

export class PurchasedServers {
	private readonly ns: NS
	private list: PurchasedServerInfo[] = []

	constructor(ns: NS) {
		this.ns = ns
		this.refresh()
	}

	refresh(): PurchasedServerInfo[] {
		this.list = this.ns.cloud.getServerNames()
			.map((host) => {
				const ram = this.ns.getServerMaxRam(host)
				const usedRam = this.ns.getServerUsedRam(host)

				return {
					host,
					ram,
					usedRam,
					freeRam: ram - usedRam,
				}
			})
			.sort((a, b) => a.ram - b.ram)

		return this.list
	}

	getInfo(): PurchasedServerInfo[] {
		return this.list
	}

	maxRam(): number {
		return this.ns.cloud.getRamLimit()
	}

	limit(): number {
		return this.ns.cloud.getServerLimit()
	}

	cost(ram: number): number {
		return this.ns.cloud.getServerCost(ram)
	}

	nextAffordableRam(
		budget: number,
		minRam = 8,
		maxRam = this.maxRam(),
	): number {
		let ram = minRam
		let best = 0

		while (ram <= maxRam) {
			const cost = this.ns.cloud.getServerCost(ram)
			if (cost > budget) break
			best = ram
			ram *= 2
		}

		return best
	}

	nextAffordableUpgrade(
		host: string,
		budget: number,
		minRam = 8,
		maxRam = this.maxRam(),
	): { best: number, nextCost: number } {
		let next = 0
		let ram = minRam
		let best = 0

		while (ram <= maxRam) {
			const cost = this.ns.cloud.getServerUpgradeCost(host, ram)
			if (cost > budget) {
				next = cost
				break
			}
			best = ram
			ram *= 2
		}

		return {
			best,
			nextCost: next,
		}
	}

	worst(): PurchasedServerInfo | null {
		return this.list[0] ?? null
	}

	best(): PurchasedServerInfo | null {
		return this.list[this.list.length - 1] ?? null
	}

	hasCapacity(): boolean {
		return this.list.length < this.limit()
	}

	totalRam(): number {
		return this.list.reduce((sum, server) => sum + server.ram, 0)
	}

	totalUsedRam(): number {
		return this.list.reduce((sum, server) => sum + server.usedRam, 0)
	}

	totalFreeRam(): number {
		return this.list.reduce((sum, server) => sum + server.freeRam, 0)
	}
}
