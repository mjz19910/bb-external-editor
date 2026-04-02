// dashboard.ts
import { StateManager, TargetState, ServerState } from "./lib/state"
// import { Events } from "./lib/events"
import { getConfig } from "./lib/config_helpers"
import { StockManager } from "./stock_manager"
import { doc } from "./dom_helpers"

export async function main(ns: NS) {
	ns.disableLog("ALL")

	const state = new StateManager(ns)
	const stockMgr = new StockManager(ns)
	const widgetId = "dashboard-widget"

	// Remove old widget if present
	const old = doc.getElementById(widgetId)
	if (old) old.remove()

	const box = doc.createElement("div")
	box.id = widgetId
	Object.assign(box.style, {
		position: "fixed",
		top: "8px",
		left: "8px",
		zIndex: "1500",
		background: "rgba(20,20,20,0.95)",
		color: "#00ff9c",
		padding: "12px 16px",
		border: "1px solid #00ff9c",
		borderRadius: "10px",
		fontFamily: "monospace",
		fontSize: "13px",
		whiteSpace: "pre",
		boxShadow: "0 0 12px rgba(0,255,156,0.25)",
		maxHeight: "80vh",
		overflowY: "auto",
	})
	doc.body.appendChild(box)

	// --- Close button ---
	const closeBtn = doc.createElement("div")
	closeBtn.innerText = "✖"
	Object.assign(closeBtn.style, {
		position: "absolute",
		top: "4px",
		right: "6px",
		cursor: "pointer",
		color: "#ff4b4b",
		fontSize: "18px",
		fontWeight: "bold",
		userSelect: "none",
	})
	closeBtn.addEventListener("click", () => box.remove())
	box.appendChild(closeBtn)

	// --- Header ---
	const title = doc.createElement("div")
	title.innerText = "EMPIRE DASHBOARD"
	title.style.fontWeight = "bold"
	title.style.marginBottom = "4px"
	box.appendChild(title)

	const sep = doc.createElement("div")
	sep.innerText = "===================================="
	box.appendChild(sep)

	// --- Section containers ---
	const serversContainer = doc.createElement("div")
	const targetsContainer = doc.createElement("div")
	const stocksContainer = doc.createElement("div")
	box.appendChild(serversContainer)
	box.appendChild(targetsContainer)
	box.appendChild(stocksContainer)

	// --- Track rows for dynamic updates ---
	const serverRows: Record<string, HTMLDivElement> = {}
	const targetRows: Record<string, HTMLDivElement> = {}
	const stockRows: Record<string, HTMLDivElement> = {}

	const refreshMs = getConfig("dashboardRefreshMs", 500)
	let running = true

	while (running) {
		// --- Servers ---
		const servers = Object.values(state.state.servers)
		serversContainer.innerHTML = "SERVERS:\n"
		servers.forEach((s: ServerState) => {
			let row = serverRows[s.hostname]
			if (!row) {
				row = doc.createElement("div")
				serverRows[s.hostname] = row
				serversContainer.appendChild(row)
			}
			row.innerText = `${s.hostname.padEnd(12)} | RAM: ${s.usedRam.toFixed(1)}/${s.maxRam} | Jobs: ${s.activeJobs.length}`
		})

		// --- Targets ---
		const targets = Object.values(state.state.targets)
		targetsContainer.innerHTML = "\nTARGETS:\n"
		targets.forEach((t: TargetState) => {
			let row = targetRows[t.name]
			if (!row) {
				row = doc.createElement("div")
				targetRows[t.name] = row
				targetsContainer.appendChild(row)
			}
			row.innerText = `${t.name.padEnd(12)} | Money: ${(t.moneyPercent * 100).toFixed(1)}% | Security: ${t.security.toFixed(2)} | Prepped: ${t.isPrepped} | Active Batches: ${t.activeBatches}`
		})

		// --- Stocks ---
		const symbols = stockMgr.getTrackedStocks()
		stocksContainer.innerHTML = "\nSTOCKS:\n"
		symbols.forEach((sym) => {
			let row = stockRows[sym]
			if (!row) {
				row = doc.createElement("div")
				stockRows[sym] = row
				stocksContainer.appendChild(row)
			}
			const price = stockMgr.getPrice(sym)
			const forecast = stockMgr.getForecast(sym)
			const shares = stockMgr.getShares(sym)
			row.innerText = `${sym.padEnd(6)} | Price: $${price.toFixed(2)} | Forecast: ${forecast.toFixed(2)} | Shares: ${shares}`
		})

		await ns.sleep(refreshMs)
	}
}
