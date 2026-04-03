/** auto_go_column.ts **/
const MY = 1 // X
const OPP = 2 // O
const EMPTY = 0
const DEAD = -1

function hasLiberty(board: number[][], x: number, y: number, player: number) {
	const width = board.length
	const height = board[0].length
	const dirs = [
		[0, 1], [0, -1], [1, 0], [-1, 0]
	]
	for (const [dx, dy] of dirs) {
		const nx = x + dx
		const ny = y + dy
		if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
		const cell = board[nx][ny]
		if (cell === 0) return true // empty neighbor = liberty
		if (cell === player) {
			// optionally, could check recursively if connected to empty
			return true
		}
	}
	return false
}


// Convert ns.go.getBoardState() (array of column strings) to numbers
function boardToNumbers(columns: string[]): number[][] {
	const width = columns.length
	const height = columns[0].length
	const board: number[][] = Array.from({ length: width }, () => Array(height).fill(0))

	for (let x = 0; x < width; x++) {
		const col = columns[x]
		for (let y = 0; y < height; y++) {
			const c = col[y]
			if (c === "X") board[x][y] = 1
			else if (c === "O") board[x][y] = 2
			else if (c === ".") board[x][y] = EMPTY
			else board[x][y] = DEAD
		}
	}
	return board
}

// Return all empty points (0)
function getValidMoves(board: number[][]) {
	const moves: { x: number; y: number }[] = []
	for (let x = 0; x < board.length; x++) {
		for (let y = 0; y < board[x].length; y++) {
			if (board[x][y] === 0) {
				moves.push({ x, y })
			}
		}
	}
	return moves
}


// Check rows, columns, and diagonals for 2-in-a-row to win or block
function findCriticalMove(board: number[][], player: number) {
	const width = board.length
	const height = board[0].length

	// Rows (y fixed, x varies)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width - 2; x++) {
			const line = [board[x][y], board[x + 1][y], board[x + 2][y]]
			if (line.filter(v => v === player).length === 2 && line.includes(0)) {
				return { x: x + line.indexOf(0), y }
			}
		}
	}

	// Columns (x fixed, y varies)
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height - 2; y++) {
			const line = [board[x][y], board[x][y + 1], board[x][y + 2]]
			if (line.filter(v => v === player).length === 2 && line.includes(0)) {
				return { x, y: y + line.indexOf(0) }
			}
		}
	}

	// Diagonals (\)
	for (let x = 0; x < width - 2; x++) {
		for (let y = 0; y < height - 2; y++) {
			const line = [board[x][y], board[x + 1][y + 1], board[x + 2][y + 2]]
			if (line.filter(v => v === player).length === 2 && line.includes(0)) {
				const i = line.indexOf(0)
				return { x: x + i, y: y + i }
			}
		}
	}

	// Anti-diagonals (/)
	for (let x = 2; x < width; x++) {
		for (let y = 0; y < height - 2; y++) {
			const line = [board[x][y], board[x - 1][y + 1], board[x - 2][y + 2]]
			if (line.filter(v => v === player).length === 2 && line.includes(0)) {
				const i = line.indexOf(0)
				return { x: x - i, y: y + i }
			}
		}
	}

	return null
}

export async function main(ns: NS) {
	ns.disableLog("ALL")

	while (true) {
		const rawBoard = ns.go.getBoardState() // array of column strings
		const board = boardToNumbers(rawBoard)

		// Try to win
		let move = findCriticalMove(board, MY)

		// Block opponent
		if (!move) move = findCriticalMove(board, OPP)

		// Otherwise pick first valid empty spot
		if (!move) {
			const moves = getValidMoves(board).filter(m => hasLiberty(board, m.x, m.y, MY))
			if (moves.length === 0) break
			move = moves[0]
		}

		const r = await ns.go.makeMove(move.x, move.y)
		if (r.type == "gameOver") break
		await ns.sleep(50) // small delay
	}

	const gs = ns.go.getGameState()
	ns.tprint("Game over! Black Score: " + gs.blackScore)
	ns.tprint("White Score: " + gs.whiteScore)
}
