import { HostInfoDB } from "../src/HostInfoDB";
import { wv } from "../src/V";

export async function main(ns: NS) {
	const db = new HostInfoDB(ns);
	const info_arr = db.data.map((v) => {
		const host = v.server.hostname;
		return wv(host, ns.getHackTime(host));
	});
	info_arr.sort((a, b) => a.v - b.v);
	const arr1 = info_arr.filter((v) => v.t !== "home");
	ns.tprint(JSON.stringify(arr1.slice(0, 3), null, 2));
}
