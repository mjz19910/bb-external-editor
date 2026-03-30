import { DarknetServerInfo } from "./darknet/types";

export function write_info_to_fs_db(ns: NS, info: DarknetServerInfo) {
	if (info.server.ip === void 0) {
		ns.tprint("missing ip field on srv.ip ", info);
		return;
	}
	ns.write(
		`tmp/ip/${info.server.ip}.txt`,
		JSON.stringify(info, void 0, "\t"),
		"w",
	);
	ns.write(
		`tmp/ip/${info.server.ip}.txt`,
		JSON.stringify(info, void 0, "\t"),
		"w",
	);
}
