/**
 * Centralized logging for Hacknet upgrades
 * @param ns NS instance
 * @param type "level" | "ram" | "core"
 * @param nodeId node index
 * @param before value before upgrade
 * @param after value after upgrade
 * @param cost upgrade cost
 */
export function logUpgrade(
	ns: NS,
	type: "level" | "ram" | "core",
	nodeId: number,
	before: number,
	after: number,
	cost: number,
) {
	let msg = "";
	switch (type) {
		case "level":
			msg =
				`Node #${nodeId} level upgraded ${before} -> ${after} (cost: ${cost})`;
			break;
		case "ram":
			msg =
				`Node #${nodeId} RAM upgraded ${before} -> ${after} (cost: ${cost})`;
			break;
		case "core":
			msg =
				`Node #${nodeId} cores upgraded ${before} -> ${after} (cost: ${cost})`;
			break;
	}
	ns.print(msg);
}
