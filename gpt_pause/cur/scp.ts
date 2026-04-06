export async function main(ns: NS) {
	const args = ns.args as [string, string, string]
	ns.scp(...args)
}