import { DarknetServer, isDarknetServer2 } from "./darknet/misc";
import { Darknet, WithPort } from "./darknet_paths";
import { isNormalServer } from "./lib/helper";
import { Server } from "./NetscriptDefinitions.d";

class PortApi {
	constructor(public ns: NS) {}
	with_port_read(host: string, path: string, port: number = 1) {
		return this.ns.exec(WithPort.Read, host, 1, host, path, port);
	}
	darknet_open_cache(host: string, path: string, port: number = 1) {
		return this.ns.exec(Darknet.OpenCache, host, 1, host, path, port);
	}
	darknet_memory_reallocation(host: string, threads: number, port = 1) {
		return this.ns.exec(
			Darknet.MemoryReallocation,
			host,
			threads,
			host,
			threads,
			port,
		);
	}
}

export function tmp_data(ns: NS, host: string, srv: Server | DarknetServer) {
	const port_api = new PortApi(ns);
	const unk_files = [];
	const files = ns.ls(host);
	for (const fileName of files) {
		if (fileName.endsWith(".ts")) continue;
		if (fileName.endsWith(".cache")) {
			port_api.darknet_open_cache(host, fileName);
			continue;
		}
		if (fileName.endsWith(".data.txt")) {
			port_api.with_port_read(host, fileName);
			continue;
		}
		unk_files.push(fileName);
	}
	if (isNormalServer(srv)) return;
	if (!isDarknetServer2(srv)) return;
	if (srv.blockedRam > 0) {
		ns.tprint("blockedRam ", [
			srv.ramUsed,
			srv.blockedRam,
			srv.maxRam,
		]);
		const ram_left = srv.maxRam - srv.ramUsed - srv.blockedRam;
		if (ram_left > 2.6) {
			const tc = Math.floor(ram_left / 2.6);
			port_api.darknet_memory_reallocation(host, tc);
			srv.ramUsed += tc * 2.6;
		}
	}
}
