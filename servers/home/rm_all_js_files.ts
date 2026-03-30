export async function main(ns: NS) {
	const files = ns.ls("home", ".js");
	for (const file of files) {
		ns.rm(file, "home");
	}
}