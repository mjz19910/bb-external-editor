/** auto_go_safe.ts **/
/** @param {NS} ns **/
export async function main(ns: NS) {
	ns.disableLog("ALL")

	const MY = 1, OPP = 2, EMPTY = 0, DEAD = -1

	// Convert column strings to numbers
	function boardToNumbers(columns: string[]): number[][] {
		return columns.map(col => col.split("").map(c => c === "X" ? MY : c === "O" ? OPP : c === "." ? EMPTY : DEAD))
	}

	// Get all empty cells
	function getValidMoves(board: number[][]) {
		const moves: { x: number, y: number }[] = []
		for (let x = 0; x < board.length; x++)
			for (let y = 0; y < board[x].length; y++)
				if (board[x][y] === EMPTY) moves.push({ x, y })
		return moves
	}

	// Check if a cell has at least one liberty (neighboring empty or connected)
	function hasLiberty(board: number[][], x: number, y: number, player: number) {
		const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
		for (const [dx, dy] of dirs) {
			const nx = x + dx
			const ny = y + dy
			if (nx < 0 || nx >= board.length || ny < 0 || ny >= board[0].length) continue
			const cell = board[nx][ny]
			if (cell === EMPTY) return true
			if (cell === player) return true // connected to your stones
		}
		return false
	}

	// Check rows, columns, diagonals for 2-in-a-row (win or block)
	function findCriticalMove(board: number[][], player: number) {
		const w = board.length, h = board[0].length

		// Rows
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w - 2; x++) {
				const line = [board[x][y], board[x + 1][y], board[x + 2][y]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY))
					return { x: x + line.indexOf(EMPTY), y }
			}

		// Columns
		for (let x = 0; x < w; x++)
			for (let y = 0; y < h - 2; y++) {
				const line = [board[x][y], board[x][y + 1], board[x][y + 2]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY))
					return { x, y: y + line.indexOf(EMPTY) }
			}

		// Diagonals (\)
		for (let x = 0; x < w - 2; x++)
			for (let y = 0; y < h - 2; y++) {
				const line = [board[x][y], board[x + 1][y + 1], board[x + 2][y + 2]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY)) {
					const i = line.indexOf(EMPTY)
					return { x: x + i, y: y + i }
				}
			}

		// Anti-diagonals (/)
		for (let x = 2; x < w; x++)
			for (let y = 0; y < h - 2; y++) {
				const line = [board[x][y], board[x - 1][y + 1], board[x - 2][y + 2]]
				if (line.filter(v => v === player).length === 2 && line.includes(EMPTY)) {
					const i = line.indexOf(EMPTY)
					return { x: x - i, y: y + i }
				}
			}

		return null
	}

	while (true) {
		const board = boardToNumbers(ns.go.getBoardState())

		// Try to win or block
		let move = findCriticalMove(board, MY) || findCriticalMove(board, OPP)

		// Otherwise pick first legal move with a liberty
		if (!move) {
			const moves = getValidMoves(board).filter(m => hasLiberty(board, m.x, m.y, MY))
			if (moves.length === 0) break
			move = moves[0]
		}

		// Make the move
		const r = await ns.go.makeMove(move.x, move.y)
		if (r.type === "gameOver") break
		await ns.sleep(50)
	}

	ns.tprint("Game over! Score: " + ns.go.getGameState().blackScore)
}
