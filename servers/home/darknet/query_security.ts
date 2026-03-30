import { ScriptPort } from "../type/ScriptPort";

export async function main(ns: NS) {
	const port2 = new ScriptPort(ns, 2);
	const res = port2.readOpt<string>();
	if (res.type === "None") {
		return ns.tprint("port(2): nothing to query");
	}
	const { value: query_str } = res;
	const [query_cmd, query_arg] = query_str.split(" ");
	const args = query_arg.split(",");
	switch (query_cmd) {
		case "query_ips": {
			ns.tprint("query getting server auth details");
			for (const ip of args) {
				const ad = ns.dnet.getServerAuthDetails(ip);
				ns.tprint(ad);
			}
			break;
		}
	}
}
