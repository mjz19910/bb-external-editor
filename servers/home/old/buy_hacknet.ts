type State = {
	width: number
	height: number
	prev_width: number
	prev_height: number

	waiting: boolean

	ns: NS;
	stats: NodeStats[]
	n: number;

	render(): void
	dashboard_active: boolean
}

type NodeStats = ReturnType<NS["hacknet"]["getNodeStats"]>

export async function main(ns: NS): Promise<void> {
	const s: State = {
		ns,
		stats: getAllStats(ns),
		n: 1,
		height: 1,
		width: 1,
		prev_width: 2,
		prev_height: 2,
		render() {
			if (this.prev_width === this.width && this.prev_height === this.height) return
			ns.ui.resizeTail(this.width * 9.64, 34 + this.height * 24)
			this.prev_width = this.width
			this.prev_height = this.height
		},
		dashboard_active: false,
		waiting: false,
	}

	const reserveMoney = 200_000

	ns.disableLog("ALL")
	ns.ui.openTail()
	await ns.sleep(500)

	if (ns.hacknet.numNodes() === 0) {
		while (!canSpend(ns, reserveMoney) || ns.hacknet.getPurchaseNodeCost() > ns.getServerMoneyAvailable("home")) {
			ns.clearLog()
			ns.print("Waiting to purchase first Hacknet node...")
			ns.print(`Cost: ${ns.format.number(ns.hacknet.getPurchaseNodeCost())}`)
			ns.print(`Money: ${ns.format.number(ns.getServerMoneyAvailable("home"))}`)

			await ns.sleep(100)
		}

		ns.hacknet.purchaseNode()
	}

	while (ns.hacknet.numNodes() > 0) {
		renderWaiting(s)
		while (canSpend(ns, reserveMoney)) {
			const upgraded = upgradeAll(s)

			// If we upgraded, stats are stale anyway → recompute before render
			if (upgraded) {
				s.stats = getAllStats(ns)
				renderDashboard(s)
				await ns.sleep(100)
				continue
			}

			const purchased = handleNodePurchasing(s)

			if (purchased) {
				s.stats = getAllStats(ns)
				renderDashboard(s)
				await ns.sleep(100)
				continue
			}

			renderWaiting(s)

			await ns.sleep(100)
		}
		await ns.sleep(100)
	}
}

/* ---------------- helpers ---------------- */

const canSpend = (ns: NS, reserve: number) =>
	ns.getServerMoneyAvailable("home") >= reserve

const getAllStats = (ns: NS): NodeStats[] =>
	Array.from({ length: ns.hacknet.numNodes() }, (_, i) =>
		ns.hacknet.getNodeStats(i)
	)

function upgradeAll(s: State) {
	let changed = false

	for (let i = 0; i < s.stats.length; i++) {
		while (s.ns.hacknet.upgradeLevel(i, s.n)) changed = true
		while (s.ns.hacknet.upgradeRam(i, s.n)) changed = true
		while (s.ns.hacknet.upgradeCore(i, s.n)) changed = true
	}

	return changed
}

function handleNodePurchasing({ ns, stats, n }: State): boolean {
	const last = stats.length - 1
	const purchaseCost = ns.hacknet.getPurchaseNodeCost()

	const levelCost = ns.hacknet.getLevelUpgradeCost(last, n)
	const ramCost = ns.hacknet.getRamUpgradeCost(last, n)
	const coreCost = ns.hacknet.getCoreUpgradeCost(last, n)

	const fullyUpgraded =
		levelCost === Infinity &&
		ramCost === Infinity &&
		coreCost === Infinity

	const upgradesMoreExpensive =
		levelCost > purchaseCost &&
		ramCost > purchaseCost &&
		coreCost > purchaseCost

	if ((fullyUpgraded || upgradesMoreExpensive) && stats.length < 23) {
		const result = ns.hacknet.purchaseNode()
		if (result < 0) return false
		return true
	}

	return false
}

function getNextUpgradeCost(ns: NS, stats: NodeStats[], n: number): number {
	const last = stats.length - 1
	const levelCost = ns.hacknet.getLevelUpgradeCost(last, n)
	const ramCost = ns.hacknet.getRamUpgradeCost(last, n)
	const coreCost = ns.hacknet.getCoreUpgradeCost(last, n)
	const purchaseCost = ns.hacknet.getPurchaseNodeCost()

	return Math.min(levelCost, ramCost, coreCost, purchaseCost)
}

function getNextUpgradeETA(ns: NS, stats: NodeStats[], n: number, nextCost: number): number {
	const totalProd = stats.reduce((a, n) => a + n.production, 0)
	const money = ns.getServerMoneyAvailable("home")

	const remaining = Math.max(0, nextCost - money)
	return remaining / totalProd
}

function renderInfo({ ns, stats, n }: State) {
	const nodeCount = stats.length
	const maxNodes = nodeCount < 23 ? 23 : Infinity
	const totalProd = stats.reduce((a, n) => a + n.production, 0)
	const totalProduced = stats.reduce((a, n) => a + n.totalProduction, 0)
	const nextCost = getNextUpgradeCost(ns, stats, n)
	const eta = getNextUpgradeETA(ns, stats, n, nextCost)
	const r_eta = ns.format.time(eta * 1000, true)
	const cost = ns.format.number(nextCost)

	ns.print(`Nodes: ${nodeCount} of ${maxNodes}`)
	ns.print(`Total Production: ${ns.format.number(totalProd)} /s`)
	ns.print(`Total Produced:   ${ns.format.number(totalProduced)}`)
	ns.print(`Next upgrade: $${cost} in ${r_eta}`)

	return { eta };
}

/* ---------------- rendering ---------------- */

function renderDashboard(s: State & { dashboard_active: boolean }) {
	const { ns } = s;

	s.dashboard_active = true

	ns.clearLog()
	renderInfo(s)
	ns.print("\n")

	const tableData = buildTableData(s)
	const { text, width, height } = renderTable(tableData)

	s.width = width
	s.height = 5 + height
	s.render()

	ns.print(text)
	ns.ui.renderTail()
}

function renderWaiting(s: State & { dashboard_active: boolean, timer_active?: boolean }) {
	if (s.waiting) return
	s.waiting = true
	const { ns, stats } = s;
	ns.clearLog()
	renderInfo(s)
	ns.print("\n".repeat(stats.length + 3))
	ns.ui.renderTail()
}

function buildTableData(s: State) {
	const stats = s.stats
	return {
		headers: ["Node", "Produced", "Production", "Lv", "RAM", "Cs"],
		columns: [
			stats.map((n) => n.name),
			stats.map((n) => s.ns.format.number(n.totalProduction)),
			stats.map((n) => `${s.ns.format.number(n.production)} /s`),
			stats.map((n) => String(n.level)),
			stats.map((n) => String(n.ram)),
			stats.map((n) => String(n.cores))
		]
	}
}

/* ---------------- table ---------------- */

function renderTable({
	headers,
	columns
}: {
	headers: string[]
	columns: string[][]
}) {
	const widths = headers.map((h, i) =>
		Math.max(h.length, ...columns[i].map((c) => c.length))
	)

	let width = 0
	let out = ""

	// header
	headers.forEach((h, i) => {
		out += ` ${h.padEnd(widths[i] + 1)}|`
	})

	out += "\n"

	// separator
	widths.forEach((w) => {
		out += `${"".padEnd(w + 2, "=")}|`
		width += w + 3
	})

	out += "\n"

	// rows
	const rows = columns[0]?.length ?? 0

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < columns.length; c++) {
			out += ` ${columns[c][r].padEnd(widths[c] + 1)}|`
		}
		out += "\n"
	}

	return { text: out, width, height: 2 + rows }
}