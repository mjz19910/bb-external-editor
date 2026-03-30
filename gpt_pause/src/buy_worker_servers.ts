
/* buy_worker_servers.ts */
export async function main(ns: NS) {
	const limit = ns.cloud.getServerLimit()
	const names = ns.cloud.getServerNames()
	const money = ns.getServerMoneyAvailable("home")

	const gb_cost = 55000
	ns.tprint(`Cloud server limit: ${limit}, currently owned: ${names.length}`)

	// Compute max affordable power-of-2 RAM
	function maxAffordableRam(ns: NS, money: number): number {
		const maxRam = ns.cloud.getRamLimit()
		let ram = 1
		while (ram * 2 <= maxRam && ram * 2 * gb_cost <= money) {
			ram *= 2
		}
		return ram
	}

	let moneyLeft = money

	// Buy numbered worker servers
	for (let index = 1; names.length < limit; index++) {
		const ram = maxAffordableRam(ns, moneyLeft / (limit - names.length))
		if (ram === 0) {
			ns.tprint("Not enough money to buy more workers")
			break
		}

		const host = ns.cloud.purchaseServer(`worker-${(index + "").padStart(2, "0")}`, ram)
		moneyLeft -= ram * gb_cost
		ns.tprint(`Purchased ${host} with ${ram}GB RAM`)

		names.push(host)
		index++
	}

	ns.tprint(`Total cloud servers: ${names.length}`)
}