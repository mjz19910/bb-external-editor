import { DarknetServer } from "./darknet/misc";
import { ScriptPort } from "./type/ScriptPort";

export async function main(ns: NS) {
	const port = new ScriptPort(ns, 1);
	const port2 = new ScriptPort(ns, 2);
	const res = port2.readOpt<string>();
	if (res.type === "None") {
		return ns.tprint("port(2): nothing to query");
	}
	const { value: query_str } = res;
	const [query_cmd, query_arg] = query_str.split(" ");
	const args = query_arg.split(",");
	switch (query_cmd) {
		case "online_check": {
			ns.tprint("query getting server auth details");
			const servers: DarknetServer[] = [];
			const alt_servers: Server[] = [];
			for (const ip of args) {
				const srv = ns.getServer(ip);
				if ("isOnline" in srv) servers.push(srv);
				else alt_servers.push(srv);
			}
			port.write({
				type: "online_servers",
				result: {
					darkweb: servers,
					normal: alt_servers,
				},
			});
			break;
		}
	}
}
