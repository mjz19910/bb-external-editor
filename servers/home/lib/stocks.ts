// lib/stocks.ts
/** 
 * Stocks utility library for Bitburner
 * Provides functions for:
 *  - Reading stock info
 *  - Calculating risk/reward
 *  - Basic buy/sell wrappers
 */

export type StockInfo = {
	symbol: string
	position: {
		shares: number
		avgPrice: number
	}
	forecast: number
	volatility: number
	maxShares: number
}

export class StockLib {
	ns: NS

	constructor(ns: NS) {
		this.ns = ns
	}

	/** Get info for all stocks */
	getAllStocks(): StockInfo[] {
		const symbols = this.ns.stock.getSymbols()
		return symbols.map((sym) => {
			const shares = this.ns.stock.getPosition(sym)
			return {
				symbol: sym,
				position: {
					shares: shares[0],
					avgPrice: shares[1],
				},
				forecast: this.ns.stock.getForecast(sym),
				volatility: this.ns.stock.getVolatility(sym),
				maxShares: this.ns.stock.getMaxShares(sym),
			}
		})
	}

	/** Calculate expected profit for buying N shares at current price */
	expectedProfit(symbol: string, shares: number): number {
		const price = this.ns.stock.getAskPrice(symbol)
		const forecast = this.ns.stock.getForecast(symbol)
		// forecast: probability of going up; simple expected value
		return (forecast - 0.5) * 2 * price * shares
	}

	/** Buy a stock with optional max cap */
	buyStock(symbol: string, shares: number, maxSpend?: number): number {
		const price = this.ns.stock.getAskPrice(symbol)
		if (maxSpend && price * shares > maxSpend) {
			shares = Math.floor(maxSpend / price)
		}
		if (shares <= 0) return 0
		return this.ns.stock.buyStock(symbol, shares)
	}

	/** Sell a stock (all or partial) */
	sellStock(symbol: string, shares?: number): number {
		const position = this.ns.stock.getPosition(symbol)
		const ownedShares = position[0]
		if (!shares || shares > ownedShares) shares = ownedShares
		if (shares <= 0) return 0
		return this.ns.stock.sellStock(symbol, shares)
	}

	/** Get best long candidates based on forecast */
	getTopLongs(minForecast = 0.55): StockInfo[] {
		return this.getAllStocks().filter((s) => s.forecast >= minForecast)
	}

	/** Get best short candidates based on forecast */
	getTopShorts(maxForecast = 0.45): StockInfo[] {
		return this.getAllStocks().filter((s) => s.forecast <= maxForecast)
	}

	/** Display summary table for debugging */
	printStockSummary(): void {
		const stocks = this.getAllStocks()
		this.ns.tprint("SYMBOL  FORECAST  VOLATILITY  SHARES  AVG PRICE  MAX SHARES")
		for (const s of stocks) {
			this.ns.tprint(
				`${s.symbol.padEnd(6)}  ${s.forecast.toFixed(2)}      ${s.volatility.toFixed(2)}        ${s.position.shares.toString().padEnd(5)}  ${s.position.avgPrice.toFixed(2).padEnd(9)}  ${s.maxShares}`
			)
		}
	}
}
