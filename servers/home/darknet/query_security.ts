import { ScriptPort } from "../type/ScriptPort";

export async function main(ns: NS) {
	const com_port = new ScriptPort(ns, 3);
	const res = com_port.readOpt<string>();
	if (res.type === "None") {
		return ns.tprint("port(3): nothing to query");
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
