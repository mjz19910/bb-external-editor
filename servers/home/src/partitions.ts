/**
 * Compute partition number p(n) using Euler's pentagonal number theorem
 *
 * p(n) = p(n-1) + p(n-2)
 *      - p(n-5) - p(n-7)
 *      + p(n-12) + p(n-15)
 *      - ...
 */
export function partitions(n: number): number {
	const memo: number[] = Array(n + 1).fill(0)

	memo[0] = 1 // base case: p(0) = 1

	for (let i = 1; i <= n; i++) {
		let sum = 0

		// k = 1,2,3,... generates pentagonal numbers
		for (let k = 1; ; k++) {
			// generalized pentagonal numbers:
			const g1 = (k * (3 * k - 1)) / 2  // k(3k-1)/2
			const g2 = (k * (3 * k + 1)) / 2  // k(3k+1)/2

			if (g1 > i) break // stop when terms exceed current i

			// sign pattern: + + − − + + ...
			const sign = k % 2 === 1 ? +1 : -1

			// p(i - g1)
			sum += sign * memo[i - g1]

			// p(i - g2) (only if valid)
			if (g2 <= i) {
				sum += sign * memo[i - g2]
			}
		}

		memo[i] = sum
	}

	return memo[n]
}

/**
 * Problem-specific answer:
 * number of ways to write n as sum of >= 2 positive integers
 */
export function waysAtLeastTwo(n: number): number {
	return partitions(n) - 1 // subtract the single-term partition [n]
}

export async function main(ns: NS) {
	ns.tprint("waysAtLeastTwo ", waysAtLeastTwo(ns.args[0] as number))
}