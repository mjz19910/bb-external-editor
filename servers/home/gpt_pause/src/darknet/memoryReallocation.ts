import { NS } from "../@ns";

export async function main(ns: NS) {
	const [runner, threads, port] = ns.args as [string, number, number];
	const result = await ns.dnet.memoryReallocation(runner);
	ns.writePort(port, {
		type: "darknet.memoryReallocation",
		runner,
		threads,
		result,
	});
}
