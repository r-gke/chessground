import {Key, NumberPair, Pieces, PiecesDiff, Pos, Variant} from '../../types';

import {getDirectionString} from './directions';
import type {MoveImpact, MoveVector} from './types';
import {add, areEqual, div, getNeighVectors, getNextCore, getPrevCore, getRotatedKeepNorm, includes, isCell, key2pos, mult, norm, pos2key, sub,} from './util';

export const isInLineMove = (orig: Key, dest: Key): [NumberPair, number] | undefined => {
	const from = key2pos(orig);
	const to = key2pos(dest);
	const vect = sub(to, from);
	const n = norm(vect);
	
	if (n > 0) {
		const uvect = div(n, vect);
		const neighVectors = getNeighVectors();
		
		if (includes(neighVectors, uvect)) {
			return [uvect, n];
		}
	}
	
	return undefined;
};

// Computes the effect of a move on the board before it is made
export const computeMoveImpact = (variant: Variant, pieces: Pieces, orig: Key, dest: Key): MoveImpact | undefined => {
	if (pieces.has(orig)) {
		const from = key2pos(orig);
		const to = key2pos(dest);
		const vect = sub(to, from);
		let n = norm(vect);
		
		if (n > 0) {
			let uvect = div(n, vect);
			const ejection = pieces.has(dest);
			if (ejection) n++;
			
			if (!ejection && n < 3 && variant === 'dohyo') {// Rotation
				const diff: PiecesDiff = new Map();
				const dests = [];
				
				diff.set(orig, undefined);
				diff.set(dest, pieces.get(orig));
				dests.push(dest);
				
				return {
					diff: diff,
					capture: ejection,
					landingSquares: dests,
				} as MoveImpact;
			}
			
			const neighVectors = getNeighVectors();
			
			if (includes(neighVectors, uvect)) {// In-line move
				const diff: PiecesDiff = new Map();
				const dests = [];
				
				let a = from;
				let ka = orig;
				let pa = pieces.get(ka);
				let k = 0;
				diff.set(ka, undefined);
				
				while (k < n) {
					a = add(from, mult(++k, uvect));
					ka = pos2key(a);
					
					if (k < n - 1 && !pieces.has(ka)) {
						return undefined;
					}
					
					if (isCell(variant, a)) {
						diff.set(ka, pa);
						dests.push(ka);
					} else if (!ejection) {
						return undefined;
					}
					
					pa = pieces.get(ka);
				}
				
				return {
					diff: diff,
					capture: ejection,
					landingSquares: dests,
				} as MoveImpact;
			} else if (!ejection && --n > 0) {
				let found = false;
				let vvect: Pos = [0, 0];
				for (const _vect of neighVectors) {
					const _nvect = mult(n, _vect);
					
					if (pieces.get(pos2key(add(from, _nvect)))?.playerIndex === pieces.get(orig)?.playerIndex) {
						vvect = getNextCore(neighVectors, _vect);
						
						if (areEqual(add(_nvect, vvect), vect)) {
							uvect = _vect;
							found = true;
							break;
						} else {
							vvect = getPrevCore(neighVectors, _vect);
							
							if (areEqual(add(_nvect, vvect), vect)) {
								uvect = _vect;
								found = true;
								break;
							}
						}
					}
				}
				
				if (found) {// Broadside move
					const diff: PiecesDiff = new Map();
					const dests = [];
					
					let a = from;
					let ka = orig;
					let k = 0;
					
					while (k <= n) {
						if (!isCell(variant, a)) return undefined;
						
						const b = add(a, vvect);
						if (!isCell(variant, b)) return undefined;
						const kb = pos2key(b);
						if (pieces.has(kb)) return undefined;
						
						diff.set(ka, undefined);
						diff.set(kb, pieces.get(ka));
						dests.push(kb);
						
						a = add(from, mult(++k, uvect));
						ka = pos2key(a);
					}
					
					return {
						diff: diff,
						capture: false,
						landingSquares: dests,
					} as MoveImpact;
				}
			}
		}
	}
	
	return undefined;
};

// Computes a move vector after the move has been made
export const computeMoveVectorPostMove = (variant: Variant, pieces: Pieces, orig: Key, dest: Key): MoveVector | undefined => {
	if (!pieces.has(orig) && pieces.has(dest)) {
		const from = key2pos(orig);
		const to = key2pos(dest);
		const vect = sub(to, from);
		let n = norm(vect);
		
		if (n > 0) {
			const neighVectors = getNeighVectors();
			
			if (n < 3 && variant === 'dohyo') {
				const path = computeRotationPathPostMove(variant, pieces, orig, dest);
				
				if (path.length > 1) {
					const uvect = div(n, sub(to, key2pos(path[path.length - 2])));
					
					if (includes(neighVectors, uvect)) {
						return {
							directionString: getDirectionString(uvect),
							landingSquares: [dest],
						} as MoveVector;
					}
				}
			}
			
			let uvect = div(n, vect);
			
			if (includes(neighVectors, uvect)) {
				// In-line move
				const dests: Key[] = [];
				
				let a = to;
				let ka = dest;
				let k = 0;
				
				while (k < n) {
					dests.push(ka);
					
					a = sub(to, mult(++k, uvect));
					ka = pos2key(a);
					
					if (k < n - 1 && !pieces.has(ka)) return undefined;
				}
				
				return {
					directionString: getDirectionString(uvect),
					landingSquares: dests,
				} as MoveVector;
			} else if (--n > 0) {
				let found = false;
				let vvect: Pos = [0, 0];
				for (const _vect of neighVectors) {
					const _nvect = mult(n, _vect);
					
					if (!pieces.has(pos2key(add(from, _nvect)))) {
						vvect = getNextCore(neighVectors, _vect);
						
						if (areEqual(add(_nvect, vvect), vect)) {
							uvect = _vect;
							found = true;
							break;
						} else {
							vvect = getPrevCore(neighVectors, _vect);
							
							if (areEqual(add(_nvect, vvect), vect)) {
								uvect = _vect;
								found = true;
								break;
							}
						}
					}
				}
				
				if (found) {
					// Broadside move
					const dests: Key[] = [];
					
					let a = from;
					let ka = orig;
					let k = 0;
					
					while (k <= n) {
						const b = add(a, vvect);
						const kb = pos2key(b);
						if (!pieces.has(kb)) return undefined;
						
						dests.push(kb);
						
						a = add(from, mult(++k, uvect));
						ka = pos2key(a);
						if (k < n - 1 && pieces.has(ka)) return undefined;
					}
					
					return {
						directionString: getDirectionString(vvect),
						landingSquares: dests,
					} as MoveVector;
				}
			}
		}
	}
	
	return undefined;
};

// For Dohyō: computes a rotation path between origin & destination, of minimal length
export const computeRotationPathPostMove = (variant: Variant, pieces: Pieces, orig: Key, dest: Key): Key[] => {
	let res: Key[] = [];
	
	const neighVectors = getNeighVectors();
	let from = key2pos(orig);
	let to = key2pos(dest);
	let top = pieces.get(dest);
	
	neighVectors.forEach(vect => {
		let pivot = sub(to, vect);
		
		if (pieces.get(pos2key(pivot)) === top) {
			let rres: Key[] = [];
			rres.push(orig);
			
			let back: Boolean = false;
			
			let k = 0;
			var a, ka;
			
			while (true) {
				a = add(pivot, getRotatedKeepNorm(vect, --k*60));
				ka = pos2key(a);
				
				if (back = areEqual(from, a)) break;
				if (!isCell(variant, a) || !pieces.has(ka)) break;
				
				rres.push(ka);
				if (areEqual(a, to)) {
					if (res.length < 1 || res.length > rres.length) {
						res = rres;
					}
					break;
				}
			}
			
			if (!back) {
				rres = [];
				rres.push(orig);
				k = 0;
				
				while (true) {
					a = add(pivot, getRotatedKeepNorm(vect, ++k*60));
					ka = pos2key(a);
					
					if (areEqual(from, a)) break;
					if (!isCell(variant, a) || !pieces.has(ka)) break;
					
					rres.push(ka);
					if (areEqual(a, to)) {
						if (res.length < 1 || res.length > rres.length) {
							res = rres;
						}
						break;
					}
				}
			}
		}
	});
	
	return res;
}
