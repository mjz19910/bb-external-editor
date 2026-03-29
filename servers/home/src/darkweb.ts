export const deps = [
	"darkweb.ts",
];

export const factory_default_pws = [
	"admin",
	"password",
	"0000",
	"12345",
];

export async function main(ns: NS) {
	if (!ns.fileExists("DarkscapeNavigator.exe", "home")) {
		ns.tprint(`requires "DarkscapeNavigator.exe" on "home"`);
		return;
	}
	if (ns.args.length === 0) {
		ns.tprint("start darkweb.ts on home");
		ns.scp(deps, "darkweb", "home");
		ns.exec("darkweb.ts", "darkweb", 1, "darkweb");
		return;
	}
	if (ns.args[0] === "darkweb") {
		ns.ui.openTail();
		ns.tprint("start darkweb.ts on darkweb");
		const probe_results = ns.dnet.probe();
		ns.tprint("darknet dnet.probe() ", probe_results);
		ns.write("probe_tmp.txt", JSON.stringify(probe_results), "w");
		const pw_tries = ["", ...factory_default_pws];
		for (const hostname of probe_results) {
			const auth_details = ns.dnet.getServerAuthDetails(hostname);
			ns.tprint("auth ", hostname, " ", auth_details);
			let no_pw_auto_res;
			for (const pw of pw_tries) {
				no_pw_auto_res = await ns.dnet.authenticate(hostname, pw);
				if (!no_pw_auto_res.success) {
					continue;
				}
				break;
			}
			if (!no_pw_auto_res) {
				throw new Error("Invalid state");
			}
			if (!no_pw_auto_res.success) {
				ns.tprint(hostname, " auth failed ", no_pw_auto_res);
				continue;
			}
			ns.tprint(hostname, " auth result ", no_pw_auto_res);
			const files = ns.ls(hostname);
			if (files.length > 0) {
				ns.scp(deps, hostname);
				ns.exec("darkweb.ts", hostname, 1, "--ls", hostname);
				const wait_handle = ns.getPortHandle(1);
				await wait_handle.nextWrite();
				const wait_host = wait_handle.read();
				if (wait_host === hostname) {
					ns.tprint("done waiting for exec");
				}
			}
		}
		return;
	}
	if (ns.args[0] === "--ls") {
		const hostname = ns.args[1] as string;
		const files = ns.ls(hostname);
		ns.tprint(hostname, " files ", files);
		for (const file of files) {
			if (deps.includes(file)) continue;
			if (file.endsWith(".cache")) {
				ns.tprint(hostname, " cache ", file);
				const c_res = ns.dnet.openCache(file);
				ns.tprint(hostname, " openCache ", file, " ", c_res);
				continue;
			}
			ns.tprint(hostname, " file ", file);
			const content = ns.read(file);
			const file_lines = content.split("\n");
			let longest_line = 1;
			for (const line of file_lines) {
				if (line.length > longest_line) longest_line = line.length;
			}
			ns.tprint(
				file_lines.map((v) =>
					"|" + v + " ".repeat(longest_line - v.length) + "|"
				).join("\n"),
			);
		}
		const wait_handle = ns.getPortHandle(1);
		const full_data = wait_handle.write(hostname);
		if (full_data !== null) {
			ns.tprint("full result ", full_data);
		}
	}
	if (ns.args[0] === "digital::oasis") {
		const files = ns.ls(ns.args[0]);
		ns.tprint(ns.read(files[0]));
		return;
	}
}
