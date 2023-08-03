type Value = { value: string, quantity: number };
type ValueContainer = { base: Value, pow: Value };

export type Token = {
	group: number,
	numerator: ValueContainer,
	denominator: ValueContainer
}

let nextGroupId = 1;

export function cloneTokenWithGroup(token: Token, group: number) {
	const newToken = JSON.parse(JSON.stringify(token)); // This should be an easy AOS clone in a C like language
	newToken.group = group;
	return newToken as Token;
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

export function printTokens(tokens: Token[]) {
	const copy = JSON.parse(JSON.stringify(tokens)) as Token[];
	copy.sort((a, b) => { return a.group - b.group });
	let output = '';

	let compoundDenominator: ValueContainer[] = [];
	for (let i = 0; i < copy.length; i++) {
		const token = copy[i];
		const nextToken = copy[Math.min(copy.length - 1, i + 1)];
		if (hasValue(token.denominator.base) || (nextToken.group === token.group && hasValue(nextToken.denominator.base))) {
			if (compoundDenominator.length === 0) {
				output += token.denominator.base ? `{` : '';
			}
			compoundDenominator.push(token.denominator);
		}
		output += printValue(token.numerator.base, token.numerator.base.quantity !== 1 || (token.numerator.base.value === 'NUMBER' && (compoundDenominator.length === 1 || !copy.find(t => t.group === token.group && t !== token))), token.numerator.base.quantity < 0);
		output += hasValue(token.numerator.pow) ? `^{${printValue(token.numerator.pow)}}` : ''
		if (compoundDenominator.length > 0 && (i === copy.length - 1 || copy[i + 1].group !== token.group)) {
			output += ` \\over `;
			for (const denominator of compoundDenominator) {
				output += `${printValue(denominator.base, denominator.base.quantity !== 1)}`;
				output += hasValue(denominator.pow) ? `^{${printValue(denominator.pow)}}` : '';
			}
			output += `}`
			compoundDenominator = [];
		}
		output += (i < copy.length - 1 && copy[i + 1].group !== token.group && copy[i + 1].numerator.base.quantity > 0) ? '+' : '';
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

function processMultiply(leaves: Token[]) {
	leaves.sort((a, b) => { return a.group - b.group });
	for (let i = 0; i < leaves.length; i++) {
		const leaf1 = leaves[i];
		for (let j = Math.min(i + 1, leaves.length - 1); j < leaves.length; j++) {
			const leaf2 = leaves[j];
			if (leaf1.group == leaf2.group) {
				const multiplied = i !== j && canMultiply(leaf1.numerator.base, leaf2.numerator.base) && canMultiply(leaf1.denominator.base, leaf2.denominator.base);
				if (multiplied) {
					multiply(leaf1.numerator, leaf2.numerator);
					multiply(leaf1.denominator, leaf2.denominator);
				}
				else if (leaf1.numerator.base.value === leaf2.denominator.base.value || leaf2.numerator.base.value === leaf1.denominator.base.value) {
					const temp = leaf1.denominator;
					leaf1.denominator = leaf2.denominator;
					leaf2.denominator = temp;
				}
				if (multiplied || simplify(leaf2, !leaves.find(t => t.group === leaf2.group && t !== leaf2))) {
					leaves.splice(j, 1);
					i = -1;
					break;
				}
			}
		}
		if (i > -1 && simplify(leaf1, !leaves.find(t => t.group === leaf1.group && t !== leaf1))) {
			leaves.splice(i--, 1);
		}
	}
}

function getGroups(leaves: Token[]): { group: number, tokens: Token[] }[] {
	const groups: { group: number, tokens: Token[] }[] = [];
	for (let i = 0; i < leaves.length; i++) {
		const leaf = leaves[i];
		let groupIndex = groups.findIndex(g => g.group === leaf.group);
		if (groupIndex < 0) {
			groups.push({ group: leaf.group, tokens: [] });
			groupIndex = groups.length - 1;
		}
		groups[groupIndex].tokens.push(leaf);
	}
	return groups;
}

function processAdd(leaves: Token[]) {
	leaves.sort((a, b) => {
		if (a.group !== b.group) {
			return a.group - b.group;
		} else {
			if (a.numerator.base.value === "NUMBER") {
				return +1;
			} else if (b.numerator.base.value === "NUMBER") {
				return -1;
			} else {
				return a.numerator.base.value.charCodeAt(0) - b.numerator.base.value.charCodeAt(0);
			}
		}
	})
	const groups = getGroups(leaves);
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
					leaves.splice(leaves.indexOf(group2.tokens[k]), 1);
				}
				group1.tokens[0].numerator.base.quantity = quantity1 + quantity2;
				groups.splice(j--, 1);
				if (group1.tokens[0].numerator.base.quantity === 0) {
					for (let k = 0; k < group1.tokens.length; k++) {
						leaves.splice(leaves.indexOf(group1.tokens[k]), 1);
					}
				}
			}
		}
	}
}

export function command(leaves: Token[], newLeaves: Token[], operator: string) {
	const createdLeaves: Token[] = [];
	if (operator === 'ADD' || operator === 'SUB') {
		createdLeaves.push(...leaves);
		for (const token of newLeaves) {
			createdLeaves.push(token);
		}
	} else if (operator === 'MUL' || operator === 'DIV') {
		const oldGroups = getGroups(leaves);
		const newGroups = getGroups(newLeaves);
		for (let i = 0; i < oldGroups.length; i++) {
			for (let j = 0; j < newGroups.length; j++) {
				const createdGroup = nextGroupId++;
				createdLeaves.push(...oldGroups[i].tokens.map(t => cloneTokenWithGroup(t, createdGroup)));
				createdLeaves.push(...newGroups[j].tokens.map(t => cloneTokenWithGroup(t, createdGroup)));
			}
		}
	}
	processMultiply(createdLeaves);
	processAdd(createdLeaves);
	return createdLeaves;
}

export function incrementAndReturnGroupId(inc: number) {
	nextGroupId += inc;
	return nextGroupId;
}