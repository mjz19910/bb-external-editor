import { HostInfoDB } from "../type/HostInfoDB";
export function main() {
	const db = new HostInfoDB();
	db.save();
}
