import { DarknetServerInfo } from "./darknet/types";

export function write_info_to_fs_db(ns: NS, info: DarknetServerInfo) {
	const srv = info.server;
	if (srv.ip === void 0 || srv.ip === "") {
		ns.tprint("missing ip field on srv.ip ", info);
		return;
	}
	const new_content = JSON.stringify(info, void 0, "\t");
	if (srv.isOnline) {
		const ip_save_path = `tmp/ip/${srv.ip}.txt`;
		ns.write(ip_save_path, new_content, "w");
	}
	const host = info.server.hostname;
	if (host === void 0 || host === "") {
		ns.tprint("missing hostname for ", info.server.ip);
		return;
	}
	let nt_ok_path = host.replaceAll(/[-:;^&@%$]/g, "_");
	nt_ok_path = nt_ok_path.replaceAll(/__+/g, "_");
	nt_ok_path = nt_ok_path.replaceAll("🅱️", "b");
	const host_save_path = `tmp/host/${nt_ok_path}.txt`;
	ns.write(host_save_path, new_content, "w");
}
