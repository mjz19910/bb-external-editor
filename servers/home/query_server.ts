import { DarknetServer } from "./darknet/misc";
import { DarknetServerInfo } from "./darknet/types";
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
	if (!query_arg) return ns.tprint("port(2): nothing to query (empty ips)");
	const args = query_arg.split(",");
	switch (query_cmd) {
		case "online_check": {
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
	const ip_db_files = ns.ls("home", "tmp/ip/");
	for (const file of ip_db_files) {
		const content = ns.read(file);
		const info: DarknetServerInfo = JSON.parse(content);
		const oSrv = info.server;
		const host = oSrv.hostname;
		const srv = ns.getServer(info.server.ip) as DarknetServer;
		if (!srv.isOnline) {
			ns.tprint("server offline ", host, "(", oSrv.ip, ")");
			ns.rm(file);
			continue;
		}
		info.server = srv;
		const new_content = JSON.stringify(info, void 0, "\t");
		if (new_content != content) {
			ns.write(file, new_content, "w");
		} else {
			ns.tprint("data is still the same [", host, "](", srv.ip, ")");
		}
	}
}
