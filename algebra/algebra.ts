export const AlgebraConfig = {
	DEBUG: false
};

let nextFunctionId = 1;

function PrintDebug(msg: string) {
	if (AlgebraConfig.DEBUG) {
		console.log("\x1b[30m", "- " + msg + " ↓", "\x1b[0m");
	}
}
export function ExecuteFunction(algebraFunction: AlgebraFunction): FunctionResult {
	if (algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE) {
		return { collapsed: false, algebraFunction: algebraFunction };
	}
	else {
		const results: FunctionResult[] = [];
		const newFunction = CloneAlgebraFunction(algebraFunction);

		// Multiply quantity into group
		if (newFunction.quantity != 1 && [AlgebraFunctionType.ADD, AlgebraFunctionType.DIV].includes(newFunction.functionType)) {
			for (let i = 0; i < newFunction.arguments.length; i++) {
				const argument = newFunction.arguments[i];
				argument.quantity *= newFunction.quantity;
				newFunction.arguments[i] = argument;
				if (newFunction.functionType != AlgebraFunctionType.ADD) break;
			}
			newFunction.quantity = 1;
			PrintDebug("Distribute quantity into function arguments");
			return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: newFunction.id };
		}

		// Execute sub functions, break on collapse
		for (let i = 0; i < newFunction.arguments.length; i++) {
			const result = ExecuteFunction(newFunction.arguments[i]);
			if (result.collapsed) {
				newFunction.arguments[i] = result.algebraFunction;
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: result.collapsedFunctionId };
			}
			// Hoist out Matryoshka doll add and mul functions
			if ((newFunction.functionType == AlgebraFunctionType.ADD || newFunction.functionType == AlgebraFunctionType.MUL) && newFunction.functionType == result.algebraFunction.functionType) {
				newFunction.arguments.splice(i, 1);
				for (let j = result.algebraFunction.arguments.length - 1; j >= 0; j--) {
					const toInsert = CloneAlgebraFunction(result.algebraFunction.arguments[j]);
					if (result.algebraFunction.functionType == AlgebraFunctionType.MUL && j == 0 && result.algebraFunction.quantity != 1) {
						toInsert.quantity *= result.algebraFunction.quantity;
					}
					newFunction.arguments.splice(i, 0, toInsert);
				}
				PrintDebug(`Hoist nested ${newFunction.functionType} function`);
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: result.algebraFunction.id };
			}
			// Hoist quantity out into MUL function
			if (newFunction.functionType == AlgebraFunctionType.MUL && result.algebraFunction.quantity != 1) {
				newFunction.quantity *= result.algebraFunction.quantity;
				result.algebraFunction.quantity = 1;
				newFunction.arguments[i] = result.algebraFunction;
				PrintDebug("Extract argument quantities into outer MUL function");
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: result.algebraFunction.id };
			}
			results.push(result);
		}

		// If the function itself only has one child, hoist it
		if (newFunction.arguments.length == 1) {
			const result = CloneAlgebraFunction(results[0].algebraFunction);
			result.quantity *= newFunction.quantity;
			PrintDebug("Hoist single argument into parent");
			return { collapsed: true, algebraFunction: result, collapsedFunctionId: result.id };
		}
		switch (algebraFunction.functionType) {
			case AlgebraFunctionType.ADD: return Add(newFunction);
			case AlgebraFunctionType.MUL: return Mul(newFunction);
			case AlgebraFunctionType.DIV: return Div(newFunction);
			case AlgebraFunctionType.EXPONENTIAL: return Exp(newFunction);
		}
	}
	throw new Error("ExecuteFunction fell through");
}

function Add(algebraFunction: AlgebraFunction): FunctionResult {
	for (let i = 0; i < algebraFunction.arguments.length; i++) {
		const argument1 = algebraFunction.arguments[i];
		const argument1Hash = CalculateResultHashes(argument1);
		// Try to add function algebraFunction.arguments
		for (let j = i + 1; j < algebraFunction.arguments.length; j++) {
			const argument2 = algebraFunction.arguments[j];
			if (argument1Hash.addHash == null) {
				throw new Error("Error: Add hash was null");
			}
			if (argument1.functionType == AlgebraFunctionType.DIV && argument2.functionType == AlgebraFunctionType.DIV && CalculateResultHashes(argument1.arguments[1]).exactHash == CalculateResultHashes(argument2.arguments[1]).exactHash) {
				algebraFunction.arguments[i].arguments[0] = FunctionArguments(1, AlgebraFunctionType.ADD, CloneAlgebraFunction(argument1.arguments[0]), CloneAlgebraFunction(argument2.arguments[0]));
				algebraFunction.arguments.splice(j, 1);
				PrintDebug("Add two exactly matching division functions");
				return { collapsed: true, algebraFunction, collapsedFunctionId: algebraFunction.id };
			}
			if (argument1Hash.addHash == CalculateResultHashes(argument2).addHash) {
				argument1.quantity += argument2.quantity;
				algebraFunction.arguments[i] = argument1;
				algebraFunction.arguments.splice(j, 1);
				PrintDebug("Combine add-able arguments in ADD function");
				return { collapsed: true, algebraFunction, collapsedFunctionId: algebraFunction.id };
			}
		}
	}

	return { collapsed: false, algebraFunction };
}

function Mul(algebraFunction: AlgebraFunction): FunctionResult {
	const newFunction = CloneAlgebraFunction(algebraFunction);
	for (let i = 0; i < newFunction.arguments.length; i++) {
		const argument1 = newFunction.arguments[i];
		// Try to multiply function algebraFunction.arguments
		for (let j = 0; j < newFunction.arguments.length; j++) {
			if (i == j) continue;
			const argument2 = newFunction.arguments[j];
			if (argument1.quantity != 1 && argument2.quantity != 1) {
				argument1.quantity *= argument2.quantity;
				newFunction.arguments[i] = argument1;
				argument2.quantity = 1;
				newFunction.arguments[j] = argument2;
				PrintDebug(`Coalesce quantity into first MUL argument`);
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: argument2.id };
			}
			if (IsPrimitiveNumber(argument2)) // Always multiply and combine primitive numbers
			{
				newFunction.arguments.splice(j, 1);
				PrintDebug("Multiply primitive numbers");
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: newFunction.id };
			}
			if (argument2.functionType == AlgebraFunctionType.DIV) // Distribute into DIV
			{
				if (argument1.functionType == AlgebraFunctionType.DIV) // Div / Div - Straight multiply to avoid convergence loop
				{
					newFunction.arguments[i] = FunctionArguments(argument1.quantity, AlgebraFunctionType.DIV,
						FunctionArguments(1, AlgebraFunctionType.MUL, CloneAlgebraFunction(argument1.arguments[0]), CloneAlgebraFunction(argument2.arguments[0])),
						FunctionArguments(1, AlgebraFunctionType.MUL, CloneAlgebraFunction(argument1.arguments[1]), CloneAlgebraFunction(argument2.arguments[1]))
					);
					PrintDebug("Straight multiply DIV numerator & denominator");
				}
				else {
					newFunction.arguments[i] = FunctionArguments(argument1.quantity, AlgebraFunctionType.DIV,
						FunctionArguments(1, AlgebraFunctionType.MUL, CloneAlgebraFunction(argument1), argument2.arguments[0]),
						argument2.arguments[1]
					);
					PrintDebug("Multiply into numerator of DIV");
				}
				newFunction.arguments.splice(j, 1);
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: newFunction.id };
			}
			if (argument1.functionType == AlgebraFunctionType.ADD) // Distribute across add function
			{
				for (let argIndex = 0; argIndex < argument1.arguments.length; argIndex++) {
					argument1.arguments[argIndex] = FunctionArguments(argument1.quantity, AlgebraFunctionType.MUL,
						CloneAlgebraFunction(argument1.arguments[argIndex], true),
						CloneAlgebraFunction(argument2, true)
					);
				}
				newFunction.arguments[i] = argument1;
				newFunction.arguments.splice(j, 1);
				PrintDebug(argument2.functionType == AlgebraFunctionType.ADD ? "Cross multiply ADD functions" : "Distribute MUL argument into ADD function");
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: newFunction.id };
			}
			if (CalculateResultHashes(argument1).mulHash == CalculateResultHashes(argument2).mulHash) {
				const function1Exponent = argument1.functionType == AlgebraFunctionType.EXPONENTIAL ? argument1.arguments[1] : FunctionPrimitive(1);
				const function2Exponent = argument2.functionType == AlgebraFunctionType.EXPONENTIAL ? argument2.arguments[1] : FunctionPrimitive(1);
				const newBase = argument1.functionType == AlgebraFunctionType.EXPONENTIAL ? argument1.arguments[0] : argument1;
				const exponential = FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL,
					newBase,
					FunctionArguments(1, AlgebraFunctionType.ADD, function1Exponent, function2Exponent)
				);
				newFunction.arguments[i] = exponential;
				newFunction.arguments.splice(j, 1);
				PrintDebug("Promote compatible MUL arguments to EXP");
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: newFunction.id };
			}
		}
	}

	return { collapsed: false, algebraFunction: newFunction };
}

function Exp(algebraFunction: AlgebraFunction): FunctionResult {
	const expBase = algebraFunction.arguments[0];
	const exponent = algebraFunction.arguments[1];
	if (exponent.functionType == AlgebraFunctionType.EXPONENTIAL) { // Fold down nested exponents
		const newFunction = FunctionArguments(exponent.quantity, AlgebraFunctionType.MUL, CloneAlgebraFunction(exponent.arguments[0]), CloneAlgebraFunction(exponent.arguments[1]));
		algebraFunction.arguments[1] = newFunction;
		PrintDebug("Fold down nested exponents");
		return { collapsed: true, algebraFunction, collapsedFunctionId: exponent.id };
	}
	if (exponent.functionType == AlgebraFunctionType.PRIMITIVE && exponent.symbol == AlgebraSymbol.NUMBER) {
		if (exponent.quantity == 0) {
			PrintDebug("Convert value with exponent of 0 into 1");
			return { collapsed: true, algebraFunction: FunctionPrimitive(algebraFunction.quantity), collapsedFunctionId: algebraFunction.id };
		}
		if (exponent.quantity < 0) {
			const newFunction = FunctionArguments(algebraFunction.quantity, AlgebraFunctionType.DIV,
				FunctionPrimitive(1),
				FunctionArguments(1, AlgebraFunctionType.EXPONENTIAL,
					expBase,
					FunctionPrimitive(exponent.quantity * -1)
				)
			);
			PrintDebug("Convert negative exponent into 1 / positive exponent");
			return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: algebraFunction.id };
		}
		else if (!(expBase.functionType == AlgebraFunctionType.PRIMITIVE && expBase.symbol != AlgebraSymbol.NUMBER) || exponent.quantity == 1) {
			if (exponent.quantity > 0) {
				if (exponent.quantity == 1) {
					PrintDebug("Convert value with exponent of 1 into raw value");
				}
				else {
					PrintDebug("Convert numeric exponent to repeated MUL");
				}
				const newFunction = FunctionArguments(algebraFunction.quantity, AlgebraFunctionType.MUL);
				for (let i = 0; i < exponent.quantity; i++) {
					newFunction.arguments.push(CloneAlgebraFunction(algebraFunction.arguments[0], true));
				}
				return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: algebraFunction.id };
			}
		}
	}
	return { collapsed: false, algebraFunction };
}

function Div(algebraFunction: AlgebraFunction): FunctionResult {
	const numerator = algebraFunction.arguments[0];
	const denominator = algebraFunction.arguments[1];
	if (denominator.functionType == AlgebraFunctionType.PRIMITIVE && denominator.symbol == AlgebraSymbol.NUMBER && denominator.quantity == 1) {
		PrintDebug("Fold down DIV where denominator = 1");
		return { collapsed: true, algebraFunction: numerator, collapsedFunctionId: algebraFunction.id };
	}
	// function / Div = Multiply by reciprocal
	const numeratorIsDiv = numerator.functionType == AlgebraFunctionType.DIV;
	const denominatorIsDiv = denominator.functionType == AlgebraFunctionType.DIV;
	if (numeratorIsDiv || denominatorIsDiv) {
		const newFunction = FunctionArguments(algebraFunction.quantity, AlgebraFunctionType.MUL,
			FunctionArguments(numerator.quantity, AlgebraFunctionType.DIV,
				numeratorIsDiv ? numerator.arguments[0] : numerator,
				numeratorIsDiv ? numerator.arguments[1] : FunctionPrimitive(1)
			),
			FunctionArguments(denominator.quantity, AlgebraFunctionType.DIV,
				denominatorIsDiv ? denominator.arguments[1] : FunctionPrimitive(1),
				denominatorIsDiv ? denominator.arguments[0] : denominator
			)
		);
		PrintDebug("Replace nested DIV with reciprocal MUL");
		return { collapsed: true, algebraFunction: newFunction, collapsedFunctionId: algebraFunction.id };
	}
	if (CalculateResultHashes(numerator).exactHash == CalculateResultHashes(denominator).exactHash) {
		PrintDebug("Fold down identical numerator / denominator into 1");
		return { collapsed: true, algebraFunction: FunctionPrimitive(1), collapsedFunctionId: algebraFunction.id };
	}
	if (numerator.functionType == AlgebraFunctionType.ADD) // If even one term in the numerator add function is divisible, split into ADD(DIV + DIV)
	{
		for (var i = 0; i < numerator.arguments.length; i++) {
			var result = Div(FunctionArguments(1, AlgebraFunctionType.DIV, numerator.arguments[i], denominator));
			if (result.collapsed) {
				var numeratorClone = CloneAlgebraFunction(numerator);
				numeratorClone.arguments.splice(i, 1);
				var func: FunctionResult = {
					collapsed: true,
					algebraFunction: FunctionArguments(1, AlgebraFunctionType.ADD,
						FunctionArguments(1, AlgebraFunctionType.DIV, CloneAlgebraFunction(numerator.arguments[i], true), denominator),
						FunctionArguments(1, AlgebraFunctionType.DIV, numeratorClone, CloneAlgebraFunction(denominator, true))
					),
					collapsedFunctionId: algebraFunction.id
				};
				PrintDebug("Partial division by splitting into multiple fractions");
				return func;
			}
		}
	}

	const dividedNumerator = DivInternal(numerator, denominator);

	if (dividedNumerator.collapsed) {
		algebraFunction.arguments[0] = dividedNumerator.remainder;
		algebraFunction.arguments[1] = (DivInternal(denominator, dividedNumerator.divisor) as DivisionSuccess).remainder;
		PrintDebug("Numerator is directly divisible by denominator");
		return { collapsed: true, algebraFunction, collapsedFunctionId: algebraFunction.id };
	}
	else {
		for (const prime of primesGenerated) {
			const tryNumerator = DivInternal(numerator, FunctionPrimitive(prime));
			const tryDenominator = DivInternal(denominator, FunctionPrimitive(prime));
			if (tryNumerator.collapsed && tryDenominator.collapsed) {
				algebraFunction.arguments[0] = tryNumerator.remainder;
				algebraFunction.arguments[1] = tryDenominator.remainder;
				PrintDebug(`Numerator and Denominator can be divided by common factor ${prime}`);
				return { collapsed: true, algebraFunction, collapsedFunctionId: algebraFunction.id };
			}
		}
		for (const symbol of [AlgebraSymbol.NUMBER, AlgebraSymbol.A, AlgebraSymbol.B, AlgebraSymbol.X, AlgebraSymbol.Y]) {
			const tryNumerator = DivInternal(numerator, FunctionPrimitive(1, symbol));
			const tryDenominator = DivInternal(denominator, FunctionPrimitive(1, symbol));
			if (tryNumerator.collapsed && tryDenominator.collapsed && tryNumerator.divisor.symbol == tryDenominator.divisor.symbol) {
				algebraFunction.arguments[0] = tryNumerator.remainder;
				algebraFunction.arguments[1] = tryDenominator.remainder;
				PrintDebug(`Numerator and Denominator can be divided by common factor ${symbol}`);
				return { collapsed: true, algebraFunction, collapsedFunctionId: algebraFunction.id };
			}
		}
	}
	return { collapsed: false, algebraFunction };
}

function DivInternal(numerator: AlgebraFunction, denominator: AlgebraFunction): DivisionResult {
	const clonedNumerator = CloneAlgebraFunction(numerator);
	const clonedDenominator = CloneAlgebraFunction(denominator);
	// If we can divide out the quantity of the whole function, early return
	if (clonedDenominator.quantity != 1 && clonedNumerator.quantity / clonedDenominator.quantity == Math.floor(clonedNumerator.quantity / clonedDenominator.quantity)) {
		clonedNumerator.quantity /= clonedDenominator.quantity;
		return { collapsed: true, remainder: clonedNumerator, divisor: FunctionPrimitive(clonedDenominator.quantity) };
	}
	if (clonedNumerator.functionType == AlgebraFunctionType.PRIMITIVE && clonedDenominator.functionType == AlgebraFunctionType.PRIMITIVE) {
		if (clonedNumerator.symbol != AlgebraSymbol.NUMBER && clonedNumerator.symbol == clonedDenominator.symbol) {
			return { collapsed: true, remainder: FunctionPrimitive(clonedNumerator.quantity), divisor: FunctionPrimitive(1, clonedNumerator.symbol) };
		}
		return { collapsed: false };
	}
	else if (clonedNumerator.functionType == AlgebraFunctionType.ADD) {
		let divisor: AlgebraFunction | undefined;
		for (let i = 0; i < clonedNumerator.arguments.length; i++) {
			const result = DivInternal(clonedNumerator.arguments[i], clonedDenominator);
			if (!result.collapsed) {
				return result;
			}
			else {
				clonedNumerator.arguments[i] = result.remainder;
				divisor = result.divisor;
			}
		}
		return { collapsed: true, remainder: clonedNumerator, divisor: divisor! };
	}
	else if (clonedNumerator.functionType == AlgebraFunctionType.MUL) {
		for (let i = 0; i < clonedNumerator.arguments.length; i++) {
			const result = DivInternal(clonedNumerator.arguments[i], clonedDenominator);
			if (result.collapsed) {
				clonedNumerator.arguments[i] = result.remainder;
				return { collapsed: true, remainder: clonedNumerator, divisor: result.divisor };
			}
		}
		return { collapsed: false };
	}
	else if (clonedNumerator.functionType == AlgebraFunctionType.PRIMITIVE || clonedNumerator.functionType == AlgebraFunctionType.EXPONENTIAL) {
		if (CalculateResultHashes(clonedNumerator).mulHash == CalculateResultHashes(clonedDenominator).mulHash) {

			const numeratorExponentContents = numerator.functionType == AlgebraFunctionType.EXPONENTIAL ? CloneAlgebraFunction(numerator.arguments[1], true) : FunctionPrimitive(1);
			const denominatorExponentContents = denominator.functionType == AlgebraFunctionType.EXPONENTIAL ? CloneAlgebraFunction(denominator.arguments[1], true) : FunctionPrimitive(1);
			const newExponent = FunctionArguments(1, AlgebraFunctionType.ADD, numeratorExponentContents, FunctionArguments(1, AlgebraFunctionType.MUL, FunctionPrimitive(-1), denominatorExponentContents));
			const newBase = CloneAlgebraFunction(numerator.functionType == AlgebraFunctionType.EXPONENTIAL ? numerator.arguments[0] : numerator);
			newBase.quantity = 1;
			const newExponential = FunctionArguments(numerator.quantity, AlgebraFunctionType.EXPONENTIAL, newBase, newExponent);
			clonedDenominator.quantity = 1;
			return { collapsed: true, remainder: newExponential, divisor: clonedDenominator };
		}
		return { collapsed: false };
	}

	throw new Error("DivInternal fell through");
}

export function FunctionPrimitive(quantity: number, symbol: AlgebraSymbol = AlgebraSymbol.NUMBER): AlgebraFunction {
	return {
		quantity: quantity,
		symbol: symbol,
		functionType: AlgebraFunctionType.PRIMITIVE,
		arguments: [],
		id: nextFunctionId++
	};
}

export function FunctionArguments(quantity: number, functionType: AlgebraFunctionType, ...functionArguments: AlgebraFunction[]): AlgebraFunction {
	return {
		quantity: quantity,
		functionType: functionType,
		arguments: functionArguments,
		symbol: AlgebraSymbol.NUMBER,
		id: nextFunctionId++
	};
}

function IsPrimitiveNumber(algebraFunction: AlgebraFunction): boolean {
	return algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE && algebraFunction.symbol == AlgebraSymbol.NUMBER;
}

function CalculateResultHashes(algebraFunction: AlgebraFunction): ResultHashes {
	if (algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE) {
		return {
			addHash: algebraFunction.symbol.toString(),
			mulHash: algebraFunction.symbol.toString(),
			exactHash: algebraFunction.quantity.toString() + "_" + algebraFunction.symbol.toString()
		};
	}
	const resultHashes = {
		addHash: algebraFunction.functionType.toString() + "_",
		exactHash: algebraFunction.functionType.toString() + "_",
		mulHash: ""
	};
	for (let i = 0; i < algebraFunction.arguments.length; i++) {
		const subResults = CalculateResultHashes(algebraFunction.arguments[i]);
		resultHashes.addHash += subResults.addHash;
		resultHashes.exactHash += subResults.exactHash;
		if (i == 0 || algebraFunction.functionType != AlgebraFunctionType.EXPONENTIAL) {
			resultHashes.mulHash += subResults.mulHash;
		}
	}
	if (algebraFunction.functionType == AlgebraFunctionType.EXPONENTIAL) {
		resultHashes.addHash = resultHashes.exactHash;
	}
	return resultHashes;
}

export function PrintFunctions(algebraFunction: AlgebraFunction, modifiedFunctionId = -1): string {
	let output = "";
	let modifiedMatched = false;
	const toInspect: Printable[] = [{ isString: false, algebraFunction }];
	while (toInspect.length > 0) {
		const current = toInspect[toInspect.length - 1];
		toInspect.splice(toInspect.length - 1, 1);
		if (current.isString === true) {
			output += current.stringValue;
		} else {
			if (modifiedFunctionId == current.algebraFunction.id) {
				modifiedMatched = true;
				output += "__MODIFIED__";
				toInspect.push({ isString: true, stringValue: "__MODIFIED__" });
			}
			if (current.algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE) {
				output += current.algebraFunction.quantity.toString() + (current.algebraFunction.symbol != AlgebraSymbol.NUMBER ? current.algebraFunction.symbol : "");
			}
			else {
				toInspect.push({ isString: true, stringValue: ")" });
				for (let i = current.algebraFunction.arguments.length - 1; i >= 0; i--) {
					if (i < current.algebraFunction.arguments.length - 1) {
						let separator = "+";
						switch (current.algebraFunction.functionType) {
							case AlgebraFunctionType.MUL: separator = "*"; break;
							case AlgebraFunctionType.EXPONENTIAL: separator = "^"; break;
							case AlgebraFunctionType.DIV: separator = "/"; break;
						}
						toInspect.push({ isString: true, stringValue: ` ${separator} ` });
					}
					toInspect.push({ isString: false, algebraFunction: current.algebraFunction.arguments[i] });
				}
				toInspect.push({ isString: true, stringValue: `${current.algebraFunction.quantity}(` });
			}
		}
	}
	if (modifiedFunctionId > 0 && !modifiedMatched) {
		throw new Error("Error: the provided modifiedFunctionId could not be found.");
	}
	return output;
}

export function PrintFunctionsLatex(algebraFunction: AlgebraFunction): string {
	let output = "";
	const toInspect: Printable[] = [{ isString: false, algebraFunction }];
	while (toInspect.length > 0) {
		const current = toInspect[toInspect.length - 1];
		toInspect.splice(toInspect.length - 1, 1);
		if (current.isString === true) {
			output += current.stringValue;
		}
		else if (current.algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE) {
			var quantity = current.algebraFunction.quantity.toString();
			if (current.algebraFunction.symbol != AlgebraSymbol.NUMBER) {
				if (quantity === "1") {
					quantity = "";
				} else if (quantity === "-1") {
					quantity = "-";
				}
			}
			output += quantity + (current.algebraFunction.symbol != AlgebraSymbol.NUMBER ? current.algebraFunction.symbol.toLocaleLowerCase() : "");
		}
		else {
			if (current.algebraFunction.quantity !== 1 && current.algebraFunction.functionType == AlgebraFunctionType.ADD) {
				toInspect.push({ isString: true, stringValue: ")" });
			}
			if (current.algebraFunction.functionType === AlgebraFunctionType.DIV) {
				toInspect.push({ isString: true, stringValue: "}" });
			}
			if (current.algebraFunction.functionType === AlgebraFunctionType.EXPONENTIAL) {
				toInspect.push({ isString: true, stringValue: "}" });
			}
			for (let i = current.algebraFunction.arguments.length - 1; i >= 0; i--) {
				if (i < current.algebraFunction.arguments.length - 1) {
					let separator = "+";
					switch (current.algebraFunction.functionType) {
						case AlgebraFunctionType.MUL: separator = ""; break;
						case AlgebraFunctionType.EXPONENTIAL: separator = (current.algebraFunction.arguments[1].functionType == AlgebraFunctionType.ADD ? "(" : "") + "^{"; break;
						case AlgebraFunctionType.DIV: separator = "\\over"; break;
					}
					toInspect.push({ isString: true, stringValue: ` ${separator} ` });
				}
				toInspect.push({ isString: false, algebraFunction: current.algebraFunction.arguments[i] });
			}
			if (current.algebraFunction.functionType === AlgebraFunctionType.EXPONENTIAL && current.algebraFunction.arguments[1].functionType == AlgebraFunctionType.ADD) {
				toInspect.push({ isString: true, stringValue: "(" });
			}
			if (current.algebraFunction.functionType === AlgebraFunctionType.DIV) {
				toInspect.push({ isString: true, stringValue: "{" });
			}
			if (current.algebraFunction.quantity !== 1) {
				toInspect.push({ isString: true, stringValue: `${current.algebraFunction.quantity}` });
				if (current.algebraFunction.functionType == AlgebraFunctionType.ADD) {
					toInspect.push({ isString: true, stringValue: `${current.algebraFunction.quantity}` });
				}
			}
		}
	}
	return output;
}

export function CloneAlgebraFunction(algebraFunction: AlgebraFunction, newId = false): AlgebraFunction {
	const newArguments: AlgebraFunction[] = [];
	if (algebraFunction.arguments != null) {
		for (const argument of algebraFunction.arguments) {
			newArguments.push(CloneAlgebraFunction(argument));
		}
	}
	return {
		arguments: newArguments,
		quantity: algebraFunction.quantity,
		functionType: algebraFunction.functionType,
		symbol: algebraFunction.symbol,
		id: newId ? nextFunctionId++ : algebraFunction.id
	};
}

export enum AlgebraSymbol {
	NUMBER = "NUMBER",
	A = "A",
	B = "B",
	X = "X",
	Y = "Y",
}

export function AlgebraSymbolFromChar(inputChar: string) {
	switch (inputChar[0].toLocaleLowerCase()) {
		case 'a': return AlgebraSymbol.A;
		case 'b': return AlgebraSymbol.B;
		case 'x': return AlgebraSymbol.X;
		case 'y': return AlgebraSymbol.Y;
	}
	throw new Error("Error: unsupported pronumeral, try x | y | a | b");
}

export enum AlgebraFunctionType {
	PRIMITIVE,
	ADD,
	MUL,
	DIV,
	EXPONENTIAL
}

export type AlgebraFunction =
	{
		arguments: AlgebraFunction[];
		quantity: number;
		functionType: AlgebraFunctionType;
		symbol: AlgebraSymbol; // Only used for primitives
		id: number;
	}

type ResultHashes =
	{
		addHash: string;
		mulHash: string;
		exactHash: string;
	}

type DivisionSuccess = {
	collapsed: true;
	remainder: AlgebraFunction;
	divisor: AlgebraFunction;
}
type DivisionResult = DivisionSuccess | {
	collapsed: false;
}

type FunctionResult =
	{
		collapsed: boolean;
		algebraFunction: AlgebraFunction;
		collapsedFunctionId?: number;
	}

type Printable =
	{
		isString: true;
		stringValue: string;
	} |
	{
		isString: false;
		algebraFunction: AlgebraFunction;
	}

const primesGenerated = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541];

export enum TestResult {
	SUCCESS,
	ASSERT_NOT_MATCH,
	INFINITE_LOOP
}