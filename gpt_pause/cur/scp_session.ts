export async function main(ns: NS) {
	const ip_path = `tmp/ip/${ns.args[0]}.txt`
	ns.scp(ip_path, "darkweb")
	const info = JSON.parse(ns.read(ip_path))
	ns.tprint(Object.keys(info))
}