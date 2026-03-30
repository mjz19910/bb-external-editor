import { HostInfoDB } from "./HostInfoDB";

export async function main(ns: NS) {
	const find_key = ns.args[0];
	if (typeof find_key != "string") {
		return ns.tprint("find_key must be a string");
	}
	const db = new HostInfoDB(ns);
	const info = db.query(find_key);
	if (!info) {
		return ns.tprint("find_key ", JSON.stringify(find_key), " not found.");
	}
	ns.tprint(`find_key="${find_key}";`, JSON.stringify(info, void 0, "\t"));
}
