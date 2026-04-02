// stock_manager.ts
export class StockManager {
	ns: NS
	trackedSymbols: string[]

	constructor(ns: NS) {
		this.ns = ns
		// Track all stocks by default
		this.trackedSymbols = this.ns.stock.getSymbols()
	}

	/** Get all tracked stock symbols */
	getTrackedStocks(): string[] {
		return this.trackedSymbols
	}

	/** Get current stock price */
	getPrice(symbol: string): number {
		return this.ns.stock.getPrice(symbol)
	}

	/** Get forecast (0-1) for a stock */
	getForecast(symbol: string): number {
		return this.ns.stock.getForecast(symbol)
	}

	/** Get maximum shares available for a stock */
	getMaxShares(symbol: string): number {
		return this.ns.stock.getMaxShares(symbol)
	}

	/** Get number of shares owned for a stock */
	getShares(symbol: string): number {
		return this.ns.stock.getPosition(symbol)[0]
	}

	/** Buy shares of a stock */
	buy(symbol: string, shares: number, allowMargin = false): number {
		const cost = this.ns.stock.getPrice(symbol) * shares
		const funds = this.ns.getServerMoneyAvailable("home")
		if (cost > funds && !allowMargin) return 0

		return this.ns.stock.buyStock(symbol, shares)
	}

	/** Sell shares of a stock */
	sell(symbol: string, shares: number): number {
		const owned = this.getShares(symbol)
		if (shares > owned) shares = owned
		return this.ns.stock.sellStock(symbol, shares)
	}

	/** Simple strategy: buy if forecast > 0.6, sell if < 0.5 */
	simpleTradeLoop(intervalMs: number = 5000) {
		const ns = this.ns
		const loop = async () => {
			while (true) {
				for (const sym of this.trackedSymbols) {
					const forecast = this.getForecast(sym)
					const owned = this.getShares(sym)

					// Buy if forecast strong and not already maxed
					if (forecast > 0.6 && owned < this.getMaxShares(sym)) {
						const toBuy = Math.floor(this.getMaxShares(sym) - owned)
						if (toBuy > 0) this.buy(sym, toBuy)
						ns.print(`[stock_manager] Buying ${toBuy} shares of ${sym} (forecast ${forecast.toFixed(2)})`)
					}

					// Sell if forecast weak
					if (forecast < 0.5 && owned > 0) {
						this.sell(sym, owned)
						ns.print(`[stock_manager] Selling ${owned} shares of ${sym} (forecast ${forecast.toFixed(2)})`)
					}
				}
				await ns.sleep(intervalMs)
			}
		}

		loop()
	}
}
