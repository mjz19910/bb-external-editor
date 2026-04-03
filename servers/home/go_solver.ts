/** auto_go_advanced.ts **/
/** @param {NS} ns **/
export async function main(ns: NS) {
	ns.disableLog("ALL")

	const MY = 1, OPP = 2, EMPTY = 0

	/** Rotate board strings 90° clockwise, bottom-left [0][0] */
	function rotateBoard90(columns: string[]): string[] {
		const width = columns.length
		const height = columns[0].length
		const rotated: string[] = []
		for (let y = height - 1; y >= 0; y--) {
			let newCol = ""
			for (let x = 0; x < width; x++) {
				newCol += columns[x][y]
			}
			rotated.push(newCol)
		}
		return rotated
	}

	/** Local move legality check: only neighbors */
	function isMoveSafeLocal(board: string[], x: number, y: number, player: number) {
		const width = board.length
		const height = board[0].length
		const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
		const playerChar = player === 1 ? "X" : "O"

		for (const [dx, dy] of dirs) {
			const nx = x + dx
			const ny = y + dy
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
			const cell = board[nx][ny]
			if (cell === ".") return true
			if (cell === playerChar) {
				for (const [dx2, dy2] of dirs) {
					const nnx = nx + dx2
					const nny = ny + dy2
					if (nnx < 0 || nnx >= width || nny < 0 || nny >= height) continue
					if (board[nnx][nny] === ".") return true
				}
			}
		}
		return false
	}

	/** Count liberties of connected group of a stone */
	function countLiberties(board: string[], x: number, y: number): number {
		const width = board.length
		const height = board[0].length
		const playerChar = board[x][y]
		if (playerChar !== "X" && playerChar !== "O") return 0

		const visited = new Set<string>()
		const stack = [{ x, y }]
		let liberties = 0

		while (stack.length > 0) {
			const { x: cx, y: cy } = stack.pop()!
			const key = `${cx},${cy}`
			if (visited.has(key)) continue
			visited.add(key)

			const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
			for (const [dx, dy] of dirs) {
				const nx = cx + dx
				const ny = cy + dy
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
				const cell = board[nx][ny]
				if (cell === ".") liberties++
				else if (cell === playerChar && !visited.has(`${nx},${ny}`)) stack.push({ x: nx, y: ny })
			}
		}
		return liberties
	}

	/** Score move using advanced heuristics */
	function scoreMoveAdvanced(board: string[], x: number, y: number, player: number): number {
		const width = board.length
		const height = board[0].length
		const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
		const playerChar = player === 1 ? "X" : "O"
		const oppChar = player === 1 ? "O" : "X"

		let score = 0

		// Neighboring stones
		for (const [dx, dy] of dirs) {
			const nx = x + dx
			const ny = y + dy
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
			const cell = board[nx][ny]
			if (cell === playerChar) score += 2
			if (cell === oppChar) {
				const libs = countLiberties(board, nx, ny)
				if (libs === 1) score += 10
				else if (libs === 2) score += 5
				else score += 1
			}
		}

		// Self-liberty
		const tempBoard = board.map(r => r.split(""))
		tempBoard[x][y] = playerChar
		const myLibs = countLiberties(tempBoard.map(r => r.join("")), x, y)
		if (myLibs === 0) score -= 100
		else if (myLibs === 1) score -= 5

		// Corners/edges bonus
		if (x === 0 || y === 0 || x === width - 1 || y === height - 1) score += 1

		return score
	}

	function pickBestMoveAdvanced(board: string[], validMoves: { x: number, y: number }[], player: number) {
		let bestMove = validMoves[0]
		let bestScore = -Infinity
		for (const m of validMoves) {
			const s = scoreMoveAdvanced(board, m.x, m.y, player)
			if (s > bestScore) {
				bestScore = s
				bestMove = m
			}
		}
		return bestMove
	}

	// Reset board
	const rawBoard = ns.go.resetBoardState("Netburners", 7)
	if (!rawBoard) {
		ns.tprint("Failed to reset board")
		return
	}

	let turn = 0
	while (true) {
		turn++
		const board = rotateBoard90(ns.go.getBoardState())
		const vms = ns.go.analysis.getValidMoves(ns.go.getBoardState())

		// Build valid moves list (local safe)
		const moves: { x: number, y: number }[] = []
		for (let x = 0; x < vms.length; x++) {
			for (let y = 0; y < vms[x].length; y++) {
				if (vms[x][y] && isMoveSafeLocal(board, x, y, MY)) moves.push({ x, y })
			}
		}

		if (moves.length === 0) {
			ns.tprint("Out of moves!")
			break
		}

		const move = pickBestMoveAdvanced(board, moves, MY)
		const r = await ns.go.makeMove(move.x, move.y)
		if (r.type === "gameOver") break
		await ns.sleep(50)
	}

	ns.tprint("Game over! Score: " + ns.go.getGameState().blackScore)
}
