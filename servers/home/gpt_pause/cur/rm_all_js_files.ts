
export async function main(ns: NS) {
	const files = ns.ls(ns.getHostname(), ".js");
	for (const file of files) {
		ns.rm(file);
	}
}
