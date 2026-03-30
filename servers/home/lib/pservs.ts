export type PurchasedServerInfo = {
	host: string;
	ram: number;
	usedRam: number;
	freeRam: number;
};

export function getPurchasedServersInfo(ns: NS): PurchasedServerInfo[] {
	return ns.cloud.getServerNames()
		.map((host) => {
			const ram = ns.getServerMaxRam(host);
			const usedRam = ns.getServerUsedRam(host);

			return {
				host,
				ram,
				usedRam,
				freeRam: ram - usedRam,
			};
		})
		.sort((a, b) => a.ram - b.ram);
}

export function maxPurchasedServerRam(ns: NS): number {
	return ns.cloud.getRamLimit();
}

export function purchasedServerLimit(ns: NS): number {
	return ns.cloud.getServerLimit();
}

export function purchasedServerCost(ns: NS, ram: number): number {
	return ns.cloud.getServerCost(ram);
}

export function nextAffordableRam(
	ns: NS,
	budget: number,
	minRam = 8,
	maxRam = ns.cloud.getRamLimit(),
): number {
	let ram = minRam;
	let best = 0;

	while (ram <= maxRam) {
		const cost = ns.cloud.getServerCost(ram);
		if (cost > budget) break;
		best = ram;
		ram *= 2;
	}

	return best;
}

export function nextAffordableRamUpgrade(
	ns: NS,
	host: string,
	budget: number,
	minRam = 8,
	maxRam = maxPurchasedServerRam(ns),
): number {
	let ram = minRam;
	let best = 0;

	while (ram <= maxRam) {
		const cost = ns.cloud.getServerUpgradeCost(host, ram);
		if (cost > budget) break;
		best = ram;
		ram *= 2;
	}

	return best;
}

export function worstPurchasedServer(ns: NS): PurchasedServerInfo | null {
	return getPurchasedServersInfo(ns)[0] ?? null;
}

export function bestPurchasedServer(ns: NS): PurchasedServerInfo | null {
	const list = getPurchasedServersInfo(ns);
	return list[list.length - 1] ?? null;
}
