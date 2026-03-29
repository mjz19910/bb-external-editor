export async function main(ns: NS) {
	ns.getPortHandle(3).write("stop")
}