type AuthResult = {
	success: never;
	code: never;
	message: string;
};
export async function main(ns: NS) {
	const [h, w] = ns.args as [string, string]
	const result = await ns.dnet.authenticate(h, w) as AuthResult
	switch (result.code) {
		default:
			ns.tprint("auth result unknown ", result)
			break
	}
	if (result.success) {
		ns.scp("api/dnet/first.ts", h, "home")
		ns.exec("api/dnet/first.ts", h)
	}
	ns.writePort(1, {
		type: "dnet.authenticate",
		host: h,
		password: w,
		result,
	})
}