import { NS } from "../@ns";
import { HostInfoDB } from "./HostInfoDB";

/** Source info for a file copy */
interface CopySource {
	host: string;
}

/** Target info for a file copy */
interface CopyTarget {
	host: string;
	filesOnHost: string[];
}

/** Arguments for a copy operation */
interface CopyFileArgs {
	ns: NS;
	src: CopySource;
	dst: CopyTarget;
	file: string;
	new_copy_to_files: string[];
	new_copy_to_servers: string[];
}

/** Copy a file from src to dst, track files/servers updated */
function copy_file_to({
	ns,
	src,
	dst,
	file,
	new_copy_to_files,
	new_copy_to_servers,
}: CopyFileArgs) {
	const idx = dst.filesOnHost.indexOf(file);
	if (idx !== -1) {
		// file exists → overwrite
		dst.filesOnHost.splice(idx, 1);
		ns.rm(file, dst.host);
		ns.scp(file, dst.host, src.host);
	} else {
		// new copy
		ns.tprint("copy new ", file, " to ", dst.host);
		ns.scp(file, dst.host, src.host);

		if (!new_copy_to_servers.includes(dst.host)) {
			new_copy_to_servers.push(dst.host);
		}
		if (!new_copy_to_files.includes(file)) new_copy_to_files.push(file);
	}
}

export async function main(ns: NS) {
	const db = new HostInfoDB(ns);

	const rm_old_files: string[] = [];
	const rm_old_servers: string[] = [];
	const user_known_files: string[] = [];

	const new_copy_to_files: string[] = [];
	const new_copy_to_servers: string[] = [];

	const home_files = ns.ls("home");
	const lit_files = db.host_index.has("worker-1") ? ns.ls("worker-1") : [];

	for (const { server: srv } of db.data) {
		const host = srv.hostname;
		const files = ns.ls(host);
		const dstTarget: CopyTarget = { host, filesOnHost: files };

		let lit_files_cur = [];

		// Clean non-home servers
		if (host !== "home") {
			if (!srv!.purchasedByPlayer) {
				for (const file of files) {
					if (file.endsWith(".lit")) {
						lit_files_cur.push(file);
					}
					if (file.endsWith(".json") || file.startsWith("old/")) {
						ns.rm(file, host);
						if (!rm_old_servers.includes(host)) {
							rm_old_servers.push(host);
						}
						if (!rm_old_files.includes(file)) {
							rm_old_files.push(file);
						}
					} else if (!home_files.includes(file)) {
						if (file.endsWith(".ts") || file.endsWith(".js")) {
							ns.rm(file, host);
							if (!rm_old_servers.includes(host)) {
								rm_old_servers.push(host);
							}
							if (!rm_old_files.includes(file)) {
								rm_old_files.push(file);
							}
							continue;
						}
						if (!user_known_files.includes(file)) {
							user_known_files.push(file);
							ns.tprint("extra file ", file, " on ", host);
						}
					}
				}
			}

			const src: CopySource = { host: "home" };

			// Copy home files to remote server
			for (const file of home_files) {
				if (
					file.endsWith(".msg") ||
					file.endsWith(".lit") ||
					file.endsWith(".exe") ||
					file.startsWith("old/")
				) {
					continue;
				}

				if (file.endsWith(".json")) {
					if (srv!.purchasedByPlayer) {
						copy_file_to({
							ns,
							src,
							dst: dstTarget,
							file,
							new_copy_to_files,
							new_copy_to_servers,
						});
					}
					continue;
				}

				copy_file_to({
					ns,
					src,
					dst: dstTarget,
					file,
					new_copy_to_files,
					new_copy_to_servers,
				});
			}
		}

		if (db.host_index.has("worker-1")) {
			// Copy *.lit files to first worker server
			if (host !== "worker-1") {
				for (const file of files) {
					if (!file.endsWith(".lit")) continue;
					ns.tprint(
						"copy lit ",
						file,
						" from ",
						host,
						" to worker-1",
					);
					if (!lit_files.includes(file)) {
						ns.scp(file, host, "worker-1");
						ns.rm(file, host);
						lit_files.push(file);
					}
				}
			}
		}

		if (lit_files_cur.length > 0) {
			ns.scp(lit_files_cur, "home", host);
		}
	}

	if (rm_old_files.length > 0) {
		ns.tprint("removed files ", rm_old_files);
		ns.tprint("from these servers ", rm_old_servers);
	}
	if (new_copy_to_files.length > 0) {
		ns.tprint("copied scripts ", new_copy_to_files);
		ns.tprint("to these servers ", new_copy_to_servers);
	}
}
