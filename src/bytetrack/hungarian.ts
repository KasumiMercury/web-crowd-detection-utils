/**
 * Hungarian algorithm for the linear assignment problem.
 */

function hungarian(cost: number[][]): [number, number][] {
	const n = cost.length;
	if (n === 0) return [];
	const m = (cost[0] as number[]).length;
	if (m === 0) return [];

	const transposed = n > m;
	const rows = transposed ? m : n;
	const cols = transposed ? n : m;
	const c = transposed
		? Array.from({ length: m }, (_, i) =>
				Array.from({ length: n }, (_, j) => (cost[j] as number[])[i] as number),
			)
		: cost;

	const u = new Float64Array(rows + 1);
	const v = new Float64Array(cols + 1);
	const p = new Int32Array(cols + 1);
	const way = new Int32Array(cols + 1);

	for (let i = 1; i <= rows; i++) {
		p[0] = i;
		let j0 = 0;
		const minv = new Float64Array(cols + 1).fill(Infinity);
		const used = new Uint8Array(cols + 1);

		do {
			used[j0] = 1;
			const i0 = p[j0] as number;
			let delta = Infinity;
			let j1 = 0;

			for (let j = 1; j <= cols; j++) {
				if (used[j]) continue;
				const cRow = c[i0 - 1] as number[];
				const cur =
					(cRow[j - 1] as number) - (u[i0] as number) - (v[j] as number);
				if (cur < (minv[j] as number)) {
					minv[j] = cur;
					way[j] = j0;
				}
				if ((minv[j] as number) < delta) {
					delta = minv[j] as number;
					j1 = j;
				}
			}

			for (let j = 0; j <= cols; j++) {
				if (used[j]) {
					const pj = p[j] as number;
					u[pj] = (u[pj] as number) + delta;
					v[j] = (v[j] as number) - delta;
				} else {
					minv[j] = (minv[j] as number) - delta;
				}
			}

			j0 = j1;
		} while (p[j0] !== 0);

		do {
			const j1 = way[j0] as number;
			p[j0] = p[j1] as number;
			j0 = j1;
		} while (j0);
	}

	const result: [number, number][] = [];
	for (let j = 1; j <= cols; j++) {
		const pj = p[j] as number;
		if (pj !== 0) {
			result.push(transposed ? [j - 1, pj - 1] : [pj - 1, j - 1]);
		}
	}

	return result;
}

export interface AssignmentResult {
	matches: [number, number][];
	unmatchedA: number[];
	unmatchedB: number[];
}

export function linearAssignment(
	costMatrix: number[][],
	threshold: number,
	numCols?: number,
): AssignmentResult {
	const rows = costMatrix.length;
	const cols = numCols ?? (rows > 0 ? (costMatrix[0] as number[]).length : 0);

	if (rows === 0 || cols === 0) {
		return {
			matches: [],
			unmatchedA: Array.from({ length: rows }, (_, i) => i),
			unmatchedB: Array.from({ length: cols }, (_, i) => i),
		};
	}

	const assignments = hungarian(costMatrix);

	const matchedA = new Set<number>();
	const matchedB = new Set<number>();
	const matches: [number, number][] = [];

	for (const [a, b] of assignments) {
		if (((costMatrix[a] as number[])[b] as number) <= threshold) {
			matches.push([a, b]);
			matchedA.add(a);
			matchedB.add(b);
		}
	}

	return {
		matches,
		unmatchedA: Array.from({ length: rows }, (_, i) => i).filter(
			(i) => !matchedA.has(i),
		),
		unmatchedB: Array.from({ length: cols }, (_, i) => i).filter(
			(i) => !matchedB.has(i),
		),
	};
}
