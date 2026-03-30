import { NS } from "./@ns";
import { buildNetworkMap } from "./lib/network_map";

export type NetworkRamInfo = {
	total: number;
	used: number;
	available: number;
	hosts: {
		host: string;
		total: number;
		used: number;
		available: number;
	}[];
};

export function getNetworkAvailableRam(
	ns: NS,
	opts?: {
		includeHome?: boolean;
		homeReserveFrac?: number;
		homeReserveAbs?: number;
	},
): NetworkRamInfo {
	const map = buildNetworkMap(ns);

	const includeHome = opts?.includeHome ?? true;
	const homeReserveFrac = opts?.homeReserveFrac ?? 0;
	const homeReserveAbs = opts?.homeReserveAbs ?? 0;

	const hosts = map.hosts
		.filter((host) => ns.hasRootAccess(host))
		.filter((host) => includeHome || host !== "home")
		.filter((host) => map.ramSizes[host] > 0)
		.map((host) => {
			const total = map.ramSizes[host];
			const used = ns.getServerUsedRam(host);

			let available = Math.max(0, total - used);

			if (host === "home") {
				const reserve = Math.max(
					total * homeReserveFrac,
					homeReserveAbs,
				);
				available = Math.max(0, total - used - reserve);
			}

			return {
				host,
				total,
				used,
				available,
			};
		});

	const total = hosts.reduce((a, h) => a + h.total, 0);
	const used = hosts.reduce((a, h) => a + h.used, 0);
	const available = hosts.reduce((a, h) => a + h.available, 0);

	return {
		total,
		used,
		available,
		hosts,
	};
}

export async function main(ns: NS) {
	const ram = getNetworkAvailableRam(ns, {
		includeHome: true,
		homeReserveFrac: 0.02,
	});

	ns.tprint(`network total ram: ${ns.format.ram(ram.total)}`);
	ns.tprint(`network used ram: ${ns.format.ram(ram.used)}`);
	ns.tprint(`network available ram: ${ns.format.ram(ram.available)}`);
}
