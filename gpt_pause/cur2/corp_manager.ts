// corp_manager.ts
import { Events } from "./lib/events"
import { StockManager } from "./stock_manager"

export async function main(ns: NS) {
	ns.disableLog("ALL")

	// const state = new StateManager(ns)
	const stockMgr = new StockManager(ns)

	const CORP_NAME = "MyCorp" // TODO: make configurable

	// Check if corporation exists, create if not
	if (!ns.corporation.hasCorporation()) {
		ns.corporation.createCorporation(CORP_NAME)
		ns.tprint(`[corp_manager] Created corporation: ${CORP_NAME}`)
		Events.emit("SERVER_PURCHASED", { corpCreated: true }) // optional event
	}

	// Main loop
	while (true) {
		try {
			// --- Monitor divisions ---
			const divs = ns.corporation.getCorporation().divisions
			for (const div of divs) {
				const stats = ns.corporation.getDivision(div)
				ns.print(`[corp_manager] Division: ${div} | Revenue last cycle: $${stats.lastCycleRevenue} | Products: ${stats.products.length}`)
			}

			// --- Example: check investment opportunities ---
			const stockSymbols = stockMgr.getTrackedStocks()
			for (const sym of stockSymbols) {
				const price = stockMgr.getPrice(sym)
				ns.print(`[corp_manager] Stock: ${sym} | Price: ${price}`)
			}

			// Optionally: reinvest corp funds into production, expansion, or stocks

		} catch (err) {
			ns.print(`[corp_manager] Error: ${err}`)
		}

		await ns.sleep(10000) // adjust loop interval as needed
	}
}
