import { DarknetServer } from "./darknet/misc";
import { DarknetServerInfo } from "./darknet/types";
import { ScriptPort } from "./type/ScriptPort";
import { write_info_to_fs_db } from "./write_ip_db";

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
	const db_host_files = ns.ls("home", "tmp/host/");
	for (const file of db_host_files) {
		if (file.includes(":")) {
			ns.tprint("remove file invalid in ntfs ", file);
			ns.rm(file);
		}
		if (file.match(/[-:;^&@%$]/)) {
			ns.rm(file);
		}
		if (file.includes("🅱️")) {
			ns.rm(file);
		}
	}
	const ip_db_files = ns.ls("home", "tmp/ip/");
	for (const file of ip_db_files) {
		const file_data = ns.read(file);
		const info: DarknetServerInfo = JSON.parse(file_data);
		const oSrv = info.server;
		if (oSrv === void 0) {
			ns.tprint("missing info.server field ", file);
			ns.rm(file);
			continue;
		}
		const host = oSrv.hostname;
		if (!host) {
			ns.tprint("missing hostname field ", oSrv);
			continue;
		}
		const srv = ns.getServer(info.server.ip) as DarknetServer;
		if (!srv.isOnline) {
			ns.tprint("server offline ", host, "(", oSrv.ip, ")");
			oSrv.isOnline = false;
			write_info_to_fs_db(ns, info);
			continue;
		}
		info.server = srv;
		write_info_to_fs_db(ns, info);
	}
}
