export type HacknetUpgradeKind =
	| "new"
	| "level"
	| "ram"
	| "core"
	| "cache"

export type HacknetOption = {
	kind: HacknetUpgradeKind
	node: number // -1 for new node
	cost: number
	gain: number // estimated production gain/sec
	roi: number // gain / cost
	label: string
}

export type HacknetNodeInfo = {
	index: number
	stats: NodeStats
}

export class HacknetManager {
	private readonly ns: NS
	private nodes: HacknetNodeInfo[] = []

	constructor(ns: NS) {
		this.ns = ns
		this.refresh()
	}

	refresh(): HacknetNodeInfo[] {
		const out: HacknetNodeInfo[] = []
		const count = this.ns.hacknet.numNodes()

		for (let i = 0; i < count; i++) {
			out.push({
				index: i,
				stats: this.ns.hacknet.getNodeStats(i),
			})
		}

		this.nodes = out
		return this.nodes
	}

	getNodes(): HacknetNodeInfo[] {
		return this.nodes
	}

	count(): number {
		return this.nodes.length
	}

	totalProduction(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.production, 0)
	}

	totalLevel(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.level, 0)
	}

	totalRam(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.ram, 0)
	}

	totalCores(): number {
		return this.nodes.reduce((sum, node) => sum + node.stats.cores, 0)
	}

	private estimateGainFromLevel(i: number, amount = 1): number {
		const s = this.ns.hacknet.getNodeStats(i)
		const before = s.production
		const after = before * ((s.level + amount) / Math.max(1, s.level))
		return Math.max(0, after - before)
	}

	private estimateGainFromRam(i: number, amount = 1): number {
		const s = this.ns.hacknet.getNodeStats(i)
		const before = s.production
		const afterRam = s.ram * Math.pow(2, amount)
		const ratio = afterRam / Math.max(1, s.ram)
		const after = before * ratio
		return Math.max(0, after - before)
	}

	private estimateGainFromCore(i: number, amount = 1): number {
		const s = this.ns.hacknet.getNodeStats(i)
		const before = s.production
		const after = before * ((s.cores + amount + 4) / (s.cores + 4))
		return Math.max(0, after - before)
	}

	private estimateGainFromCache(_i: number, _amount = 1): number {
		return 0
	}

	getOptions(): HacknetOption[] {
		const options: HacknetOption[] = []
		const count = this.count()

		const newCost = this.ns.hacknet.getPurchaseNodeCost()
		if (isFinite(newCost) && newCost > 0) {
			const estimatedGain = count > 0
				? Math.max(0.001, this.nodes[0]?.stats.production ?? 1)
				: 1

			options.push({
				kind: "new",
				node: -1,
				cost: newCost,
				gain: estimatedGain,
				roi: estimatedGain / newCost,
				label: "new node",
			})
		}

		for (const node of this.nodes) {
			const i = node.index

			const levelCost = this.ns.hacknet.getLevelUpgradeCost(i, 1)
			if (isFinite(levelCost) && levelCost > 0) {
				const gain = this.estimateGainFromLevel(i, 1)
				options.push({
					kind: "level",
					node: i,
					cost: levelCost,
					gain,
					roi: gain / levelCost,
					label: `node ${i} +1 level`,
				})
			}

			const ramCost = this.ns.hacknet.getRamUpgradeCost(i, 1)
			if (isFinite(ramCost) && ramCost > 0) {
				const gain = this.estimateGainFromRam(i, 1)
				options.push({
					kind: "ram",
					node: i,
					cost: ramCost,
					gain,
					roi: gain / ramCost,
					label: `node ${i} x2 ram`,
				})
			}

			const coreCost = this.ns.hacknet.getCoreUpgradeCost(i, 1)
			if (isFinite(coreCost) && coreCost > 0) {
				const gain = this.estimateGainFromCore(i, 1)
				options.push({
					kind: "core",
					node: i,
					cost: coreCost,
					gain,
					roi: gain / coreCost,
					label: `node ${i} +1 core`,
				})
			}

			const cacheCost = this.ns.hacknet.getCacheUpgradeCost(i, 1)
			if (isFinite(cacheCost) && cacheCost > 0) {
				const gain = this.estimateGainFromCache(i, 1)
				options.push({
					kind: "cache",
					node: i,
					cost: cacheCost,
					gain,
					roi: gain / Math.max(1, cacheCost),
					label: `node ${i} +1 cache`,
				})
			}
		}

		return options.filter((o) => isFinite(o.cost) && o.cost > 0)
	}

	getAffordableOptions(budget: number): HacknetOption[] {
		return this.getOptions()
			.filter((o) => o.cost <= budget)
			.sort((a, b) => b.roi - a.roi || a.cost - b.cost)
	}

	chooseBestOption(budget = Infinity): HacknetOption | null {
		const options = this.getAffordableOptions(budget)
			.filter((o) => o.gain > 0)

		return options[0] ?? null
	}

	applyOption(opt: HacknetOption): boolean {
		switch (opt.kind) {
			case "new":
				return this.ns.hacknet.purchaseNode() !== -1
			case "level":
				return this.ns.hacknet.upgradeLevel(opt.node, 1)
			case "ram":
				return this.ns.hacknet.upgradeRam(opt.node, 1)
			case "core":
				return this.ns.hacknet.upgradeCore(opt.node, 1)
			case "cache":
				return this.ns.hacknet.upgradeCache(opt.node, 1)
			default:
				return false
		}
	}
}
