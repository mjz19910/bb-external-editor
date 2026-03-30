export async function main(ns: NS) {
	const [target, path, port] = ns.args as [string, string, number]
	let data = ns.read(path)
	ns.writePort(port, {
		type: "read",
		host: target,
		path,
		data
	})
}