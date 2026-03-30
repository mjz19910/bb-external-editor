/** scan.ts */
import { Server } from "../NetscriptDefinitions";
import { DarknetServer } from "../type/helper";
import { HostInfoDB } from "./HostInfoDB";

export class ScanContext<T extends Server | DarknetServer> {
	queue: string[] = [];
	db: HostInfoDB<T>;

	constructor(public ns: NS, public get_node_data: (target: string) => T) {
		this.db = new HostInfoDB(this.ns);
	}

	get_node(host: string) {
		const existing = this.db.query(host);
		if (existing) return existing;

		const server = this.get_node_data(host);
		return this.db.push_server(server);
	}

	relax(parent: string, child: string) {
		const parentInfo = this.get_node(parent);
		const childInfo = this.get_node(child);

		const newDepth = parentInfo.depth + 1;

		if (
			childInfo.parent === null ||
			newDepth < childInfo.depth
		) {
			childInfo.parent = parent;
			childInfo.depth = newDepth;
			this.queue.push(child);
		}
	}

	scan_target(target: string) {
		const info = this.get_node(target);
		const neighbors = this.ns.scan(target);

		info.children = neighbors;

		for (let i = 0; i < neighbors.length; i++) {
			this.queue.push(neighbors[i]);
			this.relax(target, neighbors[i]);
		}
	}

	run(start: string) {
		this.queue.push(start);

		const root = this.get_node(start);
		root.parent = null;
		root.depth = 0;

		let head = 0;

		while (head < this.queue.length) {
			const current = this.queue[head++];
			this.ns.print("will process ", current);

			this.scan_target(current);
		}

		// If home was discovered anywhere, recompute BFS from home
		if (this.db.query("home")) {
			this.recompute_from_home();
		}

		// prune dead servers
		for (let i = this.db.data.length - 1; i >= 0; i--) {
			const { server: { hostname: host } } = this.db.data[i];
			if (!this.ns.serverExists(host)) {
				this.ns.tprint("removing host entry for ", host);
				this.db.data.splice(i, 1);
			}
		}

		this.db.update_index();
		this.db.save();
	}

	recompute_from_home() {
		const home = this.get_node("home");
		home.depth = 0;
		home.parent = null;

		let bfs_queue = ["home"];
		const visited = new Set<string>(["home"]);
		let head = 0;

		while (head < bfs_queue.length) {
			const current = bfs_queue[head++];
			const currentInfo = this.get_node(current);

			for (const neighbor of currentInfo.children) {
				const neighborInfo = this.get_node(neighbor);
				const newDepth = currentInfo.depth + 1;

				// relax if shorter path or never visited
				if (
					neighborInfo.parent === null ||
					newDepth < neighborInfo.depth
				) {
					neighborInfo.parent = current;
					neighborInfo.depth = newDepth;
					if (!visited.has(neighbor)) {
						visited.add(neighbor);
						bfs_queue.push(neighbor);
					}
				}
			}
		}
	}
}

function get_args_target_host(args: NS["args"]) {
	if (args.length === 0) return null;
	if (typeof args[0] !== "string") return null;
	return args[0];
}

export async function main(ns: NS) {
	ns.clearLog();
	ns.ui.openTail();
	const target = get_args_target_host(ns.args) ?? "home";
	new ScanContext(ns, ns.getServer).run(target);
}

export function autocomplete(data: { servers: string[] }) {
	return ["", ...data.servers];
}
