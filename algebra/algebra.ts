type Value = { value: string, quantity: number };
type ValueContainer = { base: Value, pow: Value };
export type Token = {
	numerator: ValueContainer,
	denominator: ValueContainer
}
export type TokenGroup = { groupId: number, tokens: Token[] }

let nextGroupId = 1;

export function cloneTokenGroup(group: TokenGroup, groupId: number) {
	const newGroup = JSON.parse(JSON.stringify(group)) as TokenGroup; // This should be an easy AOS clone in a C like language
	newGroup.groupId = groupId;
	return newGroup as TokenGroup;
}

function printValue(value: Value, showQuantity: boolean = true, negative: boolean = false) {
	const quantity = negative && value.quantity === -1 ? "-" : value.quantity.toString();
	if (value.value === 'NUMBER' && showQuantity) {
		return quantity;
	} else if (value.value !== 'NUMBER') {
		return showQuantity ? `${quantity}${value.value}` : value.value
	}
	return '';
}

function hasValue(value: Value) {
	return value.value !== 'NUMBER' || value.quantity !== 1;
}

export function printTokens(groups: TokenGroup[]) {
	let output = '';
	for (let gi = 0; gi < groups.length; gi++) {
		const group = groups[gi];
		const denominators = group.tokens.filter(t => hasValue(t.denominator.base)).map(t => t.denominator);
		output += gi === 0 || (group.tokens[0].numerator.base.quantity < 0 && !hasValue(group.tokens[0].denominator.base)) ? '' : '+';
		if (denominators.length > 0) {
			output += `{`;
		}
		for (let i = 0; i < group.tokens.length; i++) {
			const token = group.tokens[i];
			output += printValue(token.numerator.base, token.numerator.base.quantity !== 1 || (token.numerator.base.value === 'NUMBER' && group.tokens.length === 1), token.numerator.base.quantity < 0);
			output += hasValue(token.numerator.pow) ? `^{${printValue(token.numerator.pow)}}` : ''
		}
		if (denominators.length > 0) {
			output += ` \\over `;
			for (const denominator of denominators) {
				output += `${printValue(denominator.base, denominator.base.quantity !== 1)}`;
				output += hasValue(denominator.pow) ? `^{${printValue(denominator.pow)}}` : '';
			}
			output += `}`
		}
	}
	return output;
}

function canMultiply(value1: Value, value2: Value): boolean {
	return value1.value === 'NUMBER' || value2.value === 'NUMBER' || value1.value === value2.value;
}

function multiply(value1: ValueContainer, value2: ValueContainer) {
	value1.base.quantity *= value2.base.quantity;
	if (value1.base.value === "NUMBER") {
		value1.base.value = value2.base.value;
		value1.pow.quantity = value2.pow.quantity;
	} else if (value1.base.value === value2.base.value) {
		value1.pow.quantity += value2.pow.quantity;
	}
	value2.base = { ...value1.base };
}

function subtractPow(value: ValueContainer, sub: number) {
	value.pow.quantity -= sub;
	if (value.pow.quantity === 0) {
		value.base.value = 'NUMBER';
		value.pow.quantity = 1;
	}
}

function simplify(token: Token, alone: boolean) {
	if (token.numerator.base.value !== 'NUMBER' && token.numerator.base.value === token.denominator.base.value) {
		const min = Math.min(token.numerator.pow.quantity, token.denominator.pow.quantity);
		subtractPow(token.numerator, min);
		subtractPow(token.denominator, min);
	}
	if (Math.floor(token.numerator.base.quantity / token.denominator.base.quantity) == token.numerator.base.quantity / token.denominator.base.quantity) {
		token.numerator.base.quantity /= token.denominator.base.quantity;
		token.denominator.base.quantity = 1;
	}
	if (!alone && !hasValue(token.numerator.base) && !hasValue(token.denominator.base)) {
		return true;
	}
}

function processMultiply(groups: TokenGroup[]) {
	for (let gi = 0; gi < groups.length; gi++) {
		const group = groups[gi];
		for (let i = 0; i < group.tokens.length; i++) {
			const leaf1 = group.tokens[i];
			for (let j = i + 1; j < group.tokens.length; j++) {
				const leaf2 = group.tokens[j];
				const canMultiplyNumerator = canMultiply(leaf1.numerator.base, leaf2.numerator.base);
				const canMultiplyDenominator = canMultiply(leaf1.denominator.base, leaf2.denominator.base);
				if (canMultiplyNumerator) {
					multiply(leaf1.numerator, leaf2.numerator);
					leaf2.numerator = { base: { value: 'NUMBER', quantity: 1 }, pow: { value: 'NUMBER', quantity: 1 } }
				}
				if (canMultiplyDenominator) {
					multiply(leaf1.denominator, leaf2.denominator);
					leaf2.denominator = { base: { value: 'NUMBER', quantity: 1 }, pow: { value: 'NUMBER', quantity: 1 } }
				}
				if (leaf1.numerator.base.value === leaf2.denominator.base.value || leaf2.numerator.base.value === leaf1.denominator.base.value) {
					const temp = leaf1.denominator;
					leaf1.denominator = leaf2.denominator;
					leaf2.denominator = temp;
				}
				if (simplify(leaf2, group.tokens.length === 1)) {
					group.tokens.splice(j, 1);
					i = -1;
					break;
				}
			}
			if (i > -1 && simplify(leaf1, group.tokens.length === 1)) {
				group.tokens.splice(i--, 1);
			}
		}
		if (group.tokens.length === 0) {
			groups.splice(gi--, 1);
		}
	}
}

function processAdd(groups: TokenGroup[]) {
	for (let i = 0; i < groups.length - 1; i++) {
		const group1 = groups[i];
		for (let j = i + 1; j < groups.length; j++) {
			let quantity1 = 0;
			let quantity2 = 0;
			const group2 = groups[j];
			if (group1.tokens.length !== group2.tokens.length) {
				continue;
			}
			let valid = true;
			for (let k = 0; k < group1.tokens.length; k++) {
				const token1 = group1.tokens[k];
				const token2 = group2.tokens[k];
				if (token1.numerator.base.value !== token2.numerator.base.value
					|| token1.numerator.pow.value !== token2.numerator.pow.value
					|| token1.numerator.pow.quantity !== token2.numerator.pow.quantity
					|| token1.denominator.base.value !== token2.denominator.base.value
					|| token1.denominator.pow.value !== token2.denominator.pow.value
					|| token1.denominator.pow.quantity !== token2.denominator.pow.quantity) {
					valid = false;
					break;
				}
				quantity1 = Math.abs(Math.abs(token1.numerator.base.quantity)) > quantity1 ? token1.numerator.base.quantity : quantity2;
				quantity2 = Math.abs(Math.abs(token2.numerator.base.quantity)) > quantity2 ? token2.numerator.base.quantity : quantity1;
			}
			if (valid) {
				for (let k = 0; k < group2.tokens.length; k++) {
					group2.tokens.splice(k, 1);
				}
				group1.tokens[0].numerator.base.quantity = quantity1 + quantity2;
				groups.splice(j--, 1);
				if (group1.tokens[0].numerator.base.quantity === 0) {
					for (let k = 0; k < group1.tokens.length; k++) {
						group1.tokens.splice(k, 1);
					}
				}
			}
		}
		if (group1.tokens.length === 0) {
			groups.splice(i--, 1);
		}
	}
}

export function command(oldGroups: TokenGroup[], newGroups: TokenGroup[], operator: string) {
	const createdGroups: TokenGroup[] = [];
	if (operator === 'ADD' || operator === 'SUB') {
		createdGroups.push(...oldGroups, ...newGroups);
	} else if (operator === 'MUL' || operator === 'DIV') {
		for (let i = 0; i < oldGroups.length; i++) {
			for (let j = 0; j < newGroups.length; j++) {
				const createdGroup = nextGroupId++;
				createdGroups.push({ groupId: createdGroup, tokens: JSON.parse(JSON.stringify(oldGroups[i].tokens)).concat(JSON.parse(JSON.stringify(newGroups[j].tokens))) });
			}
		}
	}
	processMultiply(createdGroups);
	processAdd(createdGroups);
	return createdGroups;
}

export function incrementAndReturnGroupId(inc: number) {
	nextGroupId += inc;
	return nextGroupId;
}