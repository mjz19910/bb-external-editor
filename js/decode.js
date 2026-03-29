/** @type {Record<string, number>} */
const ROMAN_NUMERAL_VALUES = {
	M: 1000,
	D: 500,
	C: 100,
	L: 50,
	X: 10,
	V: 5,
	I: 1,
};
/** @param {string} val @returns {number} */
function decode_roman_num(val) {
	if (val.length === 0) return 0;
	if (val.length === 1) {
		const v = ROMAN_NUMERAL_VALUES[val[0]];
		if (v !== undefined) return v;
		throw new Error(`Unable to decode Roman numeral (len=1) "${val}"`);
	}

	// Look at first two letters to handle subtraction cases
	const first = ROMAN_NUMERAL_VALUES[val[0]];
	const second = ROMAN_NUMERAL_VALUES[val[1]];
	if (first === undefined || second === undefined) {
		throw new Error(`Unknown Roman numeral char: "${val}"`);
	}

	if (first < second) {
		// Subtractive notation, e.g., IV = 4
		return second - first + decode_roman_num(val.slice(2));
	} else {
		// Regular additive notation
		return first + decode_roman_num(val.slice(1));
	}
}
exports.decode_roman_num = decode_roman_num;
