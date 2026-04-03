/** Rotate board strings 90° clockwise */
function rotateBoard90(columns: string[]): string[] {
	const width = columns.length
	const height = columns[0].length
	const rotated: string[] = []

	for (let y = 0; y < height; y++) {
		let newCol = ""
		for (let x = width - 1; x >= 0; x--) {
			newCol += columns[x][y]
		}
		rotated.push(newCol)
	}

	return rotated
}

/** Rotate board strings 90° clockwise */
function rotateValidMoves90(columns: boolean[][]): boolean[][] {
	const width = columns.length
	const height = columns[0].length
	const rotated: boolean[][] = []

	for (let y = height - 1; y >= 0; y--) {
		let newCol = []
		for (let x = 0; x < width; x++) {
			newCol.push(columns[x][y])
		}
		rotated.push(newCol)
	}

	return rotated
}

export async function main(ns: NS) {
	while (true) {
		const board = ns.go.getBoardState()
		const moves = []
		const vms = ns.go.analysis.getValidMoves(board)
		const rotated_valid_moves = rotateValidMoves90(vms)

		for (let x = 0; x < rotated_valid_moves.length; x++) {
			ns.tprint("valid moves for col ", rotated_valid_moves[x])
		}

		for (let x = 0; x < vms.length; x++) {
			for (let y = 0; y < vms[x].length; y++) {
				if (vms[x][y]) moves.push({ x, y })
			}
		}

		let move = moves[0]
		const r = await ns.go.makeMove(move.x, move.y)
		if (r.type === "gameOver") break
	}

	ns.tprint("Game over! Score: " + ns.go.getGameState().blackScore)
}
