export const AlgebraConfig = {
	DEBUG: false
};

let nextFunctionId = 1;

enum FunctionCollapseType {
	DISTRIBUTE_QUANTITY_INTO_FUNCTION,
	HOIST_NESTED_FUNCTION_WITH_SAME_TYPE,
	EXTRACT_ARGUMENT_QUANTITY_INTO_FUNCTION,
	HOIST_SINGLE_ARGUMENT_INTO_PARENT,
	ELIMINATE_ZERO_TERMS,
	COMBINE_DIV_WITH_MATCHING_DENOMINATOR,
	COMBINE_ADDABLE_TERMS,
	ELIMINATE_MULTIPLY_BY_ONE,
	MULTIPLY_DIV_FUNCTIONS,
	MULTIPLY_INTO_DIV_NUMERATOR,
	DISTRIBUTE_FUNCTION_INTO_ADD_ARGUMENTS,
	MULTIPLY_EXPONENTS,
	MULTIPLY_OUT_NESTED_EXPONENTS,
	EXPONENT_IS_ZERO,
	EXPONENT_IS_ONE,
	CONVERT_NEGATIVE_EXPONENT_TO_RECIPROCAL,
	CONVERT_NUMERIC_EXPONENT_TO_REPEATED_MUL,
	SQUARE_ROOT_OF_PRIMITIVE_NUMBER,
	COLLAPSE_DIV_WITH_DENOMINATOR_1,
	COLLAPSE_DIV_WITH_NUMERATOR_0,
	CONVERT_NESTED_DIV_TO_RECIPROCAL_MUL,
	COLLAPSE_VALUE_DIVIDED_BY_ITSELF,
	SPLIT_AND_DIVIDE_DIV,
	DIV_NUMERATOR_DENOMINATOR_COMMON_FACTOR,
	MULTIPLY_BY_ZERO
}

export const collapseTypeDocumentation: FunctionCollapseTypeDocumentation[] = [
	{ functionCollapseType: FunctionCollapseType.DISTRIBUTE_QUANTITY_INTO_FUNCTION, devMessage: "Distribute quantity into function arguments", humanReadableMessage: "Multiply inner terms by outer quantity (distribute)" },
	{ functionCollapseType: FunctionCollapseType.HOIST_NESTED_FUNCTION_WITH_SAME_TYPE, devMessage: "Hoist nested function with same type", humanReadableMessage: "Hoist nested function with same type", internalOnly: true },
	{ functionCollapseType: FunctionCollapseType.EXTRACT_ARGUMENT_QUANTITY_INTO_FUNCTION, affectsQuantity: true, devMessage: "Extract argument quantities into outer MUL function", humanReadableMessage: "Extract argument quantities into outer MUL function", internalOnly: true },
	{ functionCollapseType: FunctionCollapseType.HOIST_SINGLE_ARGUMENT_INTO_PARENT, affectsQuantity: true, devMessage: "Hoist single argument into parent", humanReadableMessage: "Hoist single argument into parent", internalOnly: true },
	{ functionCollapseType: FunctionCollapseType.ELIMINATE_ZERO_TERMS, devMessage: "Eliminate ADD arguments with quantity 0", humanReadableMessage: "Remove terms in addition with a quantity of zero" },
	{ functionCollapseType: FunctionCollapseType.COMBINE_DIV_WITH_MATCHING_DENOMINATOR, devMessage: "Combine DIV numerators with exactly matching denominator", humanReadableMessage: "Add together two fractions with the same denominator" },
	{ functionCollapseType: FunctionCollapseType.COMBINE_ADDABLE_TERMS, devMessage: "Combine add-able function arguments", humanReadableMessage: "Combine addable terms together" },
	{ functionCollapseType: FunctionCollapseType.ELIMINATE_MULTIPLY_BY_ONE, affectsQuantity: true, devMessage: "Eliminate multiply by one", humanReadableMessage: "Multiplying by 1 has no effect and can be removed", internalOnly: true },
	{ functionCollapseType: FunctionCollapseType.MULTIPLY_DIV_FUNCTIONS, devMessage: "Straight multiply DIV numerator & denominator", humanReadableMessage: "Multiply numerator by numerator, and denominator by denominator" },
	{ functionCollapseType: FunctionCollapseType.MULTIPLY_INTO_DIV_NUMERATOR, devMessage: "Multiply into DIV numerator argument", humanReadableMessage: "Multiply by fraction numerator" },
	{ functionCollapseType: FunctionCollapseType.DISTRIBUTE_FUNCTION_INTO_ADD_ARGUMENTS, devMessage: "Distribute function into ADD arguments", humanReadableMessage: "Multiply by all addition terms (distribute)" },
	{ functionCollapseType: FunctionCollapseType.MULTIPLY_EXPONENTS, devMessage: "Multiply and promote or increase exponent", humanReadableMessage: "Multiply two like terms together by adding their exponents" },
	{ functionCollapseType: FunctionCollapseType.MULTIPLY_OUT_NESTED_EXPONENTS, devMessage: "Multiply out nested exponents", humanReadableMessage: "Combine nested exponents by multiplying powers" },
	{ functionCollapseType: FunctionCollapseType.EXPONENT_IS_ZERO, devMessage: "Convert argument with exponent of 0 into 1", humanReadableMessage: "Convert term with exponent of 0 into 1" },
	{ functionCollapseType: FunctionCollapseType.EXPONENT_IS_ONE, devMessage: "Hoist exponential argument with exponent of 1", humanReadableMessage: "Exponent values of 1 have no effect" },
	{ functionCollapseType: FunctionCollapseType.CONVERT_NEGATIVE_EXPONENT_TO_RECIPROCAL, devMessage: "Convert negative exponent into 1 / positive exponent", humanReadableMessage: "Convert negative exponent into 1 / positive exponent" },
	{ functionCollapseType: FunctionCollapseType.CONVERT_NUMERIC_EXPONENT_TO_REPEATED_MUL, devMessage: "Convert numeric exponent to repeated MUL", humanReadableMessage: "Convert numeric exponent into repeated multiply" },
	{ functionCollapseType: FunctionCollapseType.SQUARE_ROOT_OF_PRIMITIVE_NUMBER, devMessage: "Root of primitive number", humanReadableMessage: "Compute the root of a primitive value" },
	{ functionCollapseType: FunctionCollapseType.COLLAPSE_DIV_WITH_DENOMINATOR_1, devMessage: "Collapse DIV with denominator = 1", humanReadableMessage: "Simplify fraction with denominator of 1" },
	{ functionCollapseType: FunctionCollapseType.COLLAPSE_DIV_WITH_NUMERATOR_0, devMessage: "Collapse DIV with numerator = 0", humanReadableMessage: "Eliminate fraction with numerator of 0" },
	{ functionCollapseType: FunctionCollapseType.CONVERT_NESTED_DIV_TO_RECIPROCAL_MUL, devMessage: "Convert nested DIV to reciprocal MUL", humanReadableMessage: "Simplified nested fractions by multiplying by the reciprocal of the denominator" },
	{ functionCollapseType: FunctionCollapseType.COLLAPSE_VALUE_DIVIDED_BY_ITSELF, devMessage: "Collapse DIV with identical numerator and denominator to 1", humanReadableMessage: "Simplify fraction with identical numerator and denominator to 1" },
	{ functionCollapseType: FunctionCollapseType.SPLIT_AND_DIVIDE_DIV, devMessage: "Split DIV with ADD numerator to allow partial division", humanReadableMessage: "Split the fraction numerator to allow division" },
	{ functionCollapseType: FunctionCollapseType.DIV_NUMERATOR_DENOMINATOR_COMMON_FACTOR, devMessage: "Numerator and Denominator can be divided by common factor ?", humanReadableMessage: "Fraction numerator and denominator can be divided by common factor ?" },
	{ functionCollapseType: FunctionCollapseType.MULTIPLY_BY_ZERO, devMessage: "Multiply group contains zero and can be removed", humanReadableMessage: "Anything multiplied by zero is zero" }
];

function PrintDebug(msg: string) {
	if (AlgebraConfig.DEBUG) {
		console.log("\x1b[30m", "- " + msg + " ↓", "\x1b[0m");
	}
}
export function ExecuteFunction(algebraFunction: AlgebraFunction): FunctionResult {
	if (algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE && (algebraFunction.symbol === AlgebraSymbol.NUMBER || algebraFunction.quantity !== 0)) {
		return { collapsed: false, algebraFunction: algebraFunction };
	}
	else {
		const results: FunctionResult[] = [];
		const newFunction = CloneAlgebraFunction(algebraFunction);

		// Convert any complex terms into primitive if the quantity is zero
		if (newFunction.quantity === 0 && !(newFunction.functionType === AlgebraFunctionType.PRIMITIVE && newFunction.symbol === AlgebraSymbol.NUMBER)) {
			console.log("test");
			const primitiveZero = FunctionPrimitive(0);
			return { collapsed: true, algebraFunction: primitiveZero, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.MULTIPLY_BY_ZERO, beforeFunctionIds: [newFunction.id], afterFunctionIds: [primitiveZero.id] } };
		};
		// Multiply quantity into group
		if (newFunction.quantity != 1 && [AlgebraFunctionType.ADD, AlgebraFunctionType.DIV].includes(newFunction.functionType)) {
			const affectedFunctionIds: number[] = [];
			affectedFunctionIds[0] = newFunction.id;
			for (let i = 0; i < newFunction.arguments.length; i++) {
				const argument = newFunction.arguments[i];
				argument.quantity *= newFunction.quantity;
				newFunction.arguments[i] = argument;
				affectedFunctionIds[i + 1] = argument.id;
				if (newFunction.functionType != AlgebraFunctionType.ADD) break;
			}
			newFunction.quantity = 1;
			return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.DISTRIBUTE_QUANTITY_INTO_FUNCTION, beforeFunctionIds: affectedFunctionIds, afterFunctionIds: affectedFunctionIds } };
		}

		// Execute sub functions, break on collapse
		for (let i = 0; i < newFunction.arguments.length; i++) {
			// Remove entire multiply groups if there is a term with quantity zero
			if (newFunction.functionType === AlgebraFunctionType.MUL && newFunction.arguments[i].quantity === 0) {
				const primitiveZero = FunctionPrimitive(0);
				return { collapsed: true, algebraFunction: primitiveZero, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.MULTIPLY_BY_ZERO, beforeFunctionIds: [newFunction.id], afterFunctionIds: [primitiveZero.id] } };
			};
			const result = ExecuteFunction(newFunction.arguments[i]);
			if (result.collapsed) {
				newFunction.arguments[i] = result.algebraFunction;
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: result.functionCollapseInfo };
			}
			// Hoist out Matryoshka doll add and mul functions
			if ((newFunction.functionType == AlgebraFunctionType.ADD || newFunction.functionType == AlgebraFunctionType.MUL) && newFunction.functionType == result.algebraFunction.functionType) {
				var argumentIds: number[] = [];
				newFunction.arguments.splice(i, 1);
				for (let j = result.algebraFunction.arguments.length - 1; j >= 0; j--) {
					const toInsert = CloneAlgebraFunction(result.algebraFunction.arguments[j]);
					if (result.algebraFunction.functionType == AlgebraFunctionType.MUL && j == 0 && result.algebraFunction.quantity != 1) {
						toInsert.quantity *= result.algebraFunction.quantity;
					}
					newFunction.arguments.splice(i, 0, toInsert);
					argumentIds.push(toInsert.id);
				}
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.EXTRACT_ARGUMENT_QUANTITY_INTO_FUNCTION, beforeFunctionIds: [newFunction.id, result.algebraFunction.id], afterFunctionIds: [newFunction.id] } };
			}
			// Hoist quantity out into MUL function
			if (newFunction.functionType == AlgebraFunctionType.MUL && result.algebraFunction.quantity != 1) {
				newFunction.quantity *= result.algebraFunction.quantity;
				result.algebraFunction.quantity = 1;
				newFunction.arguments[i] = result.algebraFunction;
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.EXTRACT_ARGUMENT_QUANTITY_INTO_FUNCTION, beforeFunctionIds: [newFunction.id, result.algebraFunction.id], afterFunctionIds: [newFunction.id] } };
			}
			results.push(result);
		}

		// If the function itself only has one child, hoist it
		if (newFunction.arguments.length == 1) {
			const result = CloneAlgebraFunction(results[0].algebraFunction);
			result.quantity *= newFunction.quantity;
			return { collapsed: true, algebraFunction: result, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.HOIST_SINGLE_ARGUMENT_INTO_PARENT, beforeFunctionIds: [result.id], afterFunctionIds: [result.id] } };
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
		if (argument1.quantity == 0) {
			algebraFunction.arguments.splice(i, 1);
			return { collapsed: true, algebraFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.ELIMINATE_ZERO_TERMS, beforeFunctionIds: [argument1.id], afterFunctionIds: [] } };
		}
		// Try to add function algebraFunction.arguments
		for (let j = i + 1; j < algebraFunction.arguments.length; j++) {
			const argument2 = algebraFunction.arguments[j];
			if (argument1Hash.addHash == null) {
				throw new Error("Error: Add hash was null");
			}
			if (argument1.functionType == AlgebraFunctionType.DIV && argument2.functionType == AlgebraFunctionType.DIV && CalculateResultHashes(argument1.arguments[1]).exactHash == CalculateResultHashes(argument2.arguments[1]).exactHash) {
				var numeratorIds = [argument1.arguments[0].id, argument2.arguments[0].id];
				algebraFunction.arguments[i].arguments[0] = FunctionArguments(1, AlgebraFunctionType.ADD, CloneAlgebraFunction(argument1.arguments[0]), CloneAlgebraFunction(argument2.arguments[0]));
				algebraFunction.arguments.splice(j, 1);
				return { collapsed: true, algebraFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.COMBINE_DIV_WITH_MATCHING_DENOMINATOR, beforeFunctionIds: numeratorIds, afterFunctionIds: [algebraFunction.arguments[i].arguments[0].id] } };
			}
			if (argument1Hash.addHash == CalculateResultHashes(argument2).addHash) {
				argument1.quantity += argument2.quantity;
				algebraFunction.arguments[i] = argument1;
				algebraFunction.arguments.splice(j, 1);
				return { collapsed: true, algebraFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.COMBINE_ADDABLE_TERMS, beforeFunctionIds: [argument1.id, argument2.id], afterFunctionIds: [argument1.id] } };
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
			if (IsPrimitiveNumber(argument2)) // Always multiply and combine primitive numbers
			{
				newFunction.arguments.splice(j, 1);
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.ELIMINATE_MULTIPLY_BY_ONE, beforeFunctionIds: [argument2.id], afterFunctionIds: [] } };
			}
			if (argument2.functionType == AlgebraFunctionType.DIV) // Distribute into DIV
			{
				var functionCollapseInfo: FunctionCollapseInfo = { functionCollapseType: FunctionCollapseType.MULTIPLY_DIV_FUNCTIONS, beforeFunctionIds: [], afterFunctionIds: [] };
				if (argument1.functionType == AlgebraFunctionType.DIV) // Div / Div - Straight multiply to avoid convergence loop
				{
					newFunction.arguments[i] = FunctionArguments(argument1.quantity, AlgebraFunctionType.DIV,
						FunctionArguments(1, AlgebraFunctionType.MUL, CloneAlgebraFunction(argument1.arguments[0]), CloneAlgebraFunction(argument2.arguments[0])),
						FunctionArguments(1, AlgebraFunctionType.MUL, CloneAlgebraFunction(argument1.arguments[1]), CloneAlgebraFunction(argument2.arguments[1]))
					);
					functionCollapseInfo.functionCollapseType = FunctionCollapseType.MULTIPLY_DIV_FUNCTIONS;
					functionCollapseInfo.beforeFunctionIds = [argument1.id, argument2.id];
					functionCollapseInfo.afterFunctionIds = [newFunction.arguments[i].id];
				}
				else {
					var newNumerator = FunctionArguments(1, AlgebraFunctionType.MUL, CloneAlgebraFunction(argument1), argument2.arguments[0]);
					newFunction.arguments[i] = FunctionArguments(argument1.quantity, AlgebraFunctionType.DIV,
						newNumerator,
						argument2.arguments[1]
					);
					functionCollapseInfo.functionCollapseType = FunctionCollapseType.MULTIPLY_INTO_DIV_NUMERATOR;
					functionCollapseInfo.beforeFunctionIds = [argument1.id, argument2.arguments[0].id];
					functionCollapseInfo.afterFunctionIds = [newNumerator.id];
				}
				newFunction.arguments.splice(j, 1);
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo };
			}
			if (argument1.functionType == AlgebraFunctionType.ADD) // Distribute across add function
			{
				var beforeFunctionIds: number[] = [];
				var afterFunctionIds: number[] = [];
				beforeFunctionIds[0] = argument2.id;
				for (let argIndex = 0; argIndex < argument1.arguments.length; argIndex++) {
					beforeFunctionIds[argIndex + 1] = argument1.arguments[argIndex].id;
					argument1.arguments[argIndex] = FunctionArguments(argument1.quantity, AlgebraFunctionType.MUL,
						CloneAlgebraFunction(argument1.arguments[argIndex], true),
						CloneAlgebraFunction(argument2, true)
					);
					afterFunctionIds[argIndex] = argument1.arguments[argIndex].id;
				}
				newFunction.arguments[i] = argument1;
				newFunction.arguments.splice(j, 1);
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.DISTRIBUTE_FUNCTION_INTO_ADD_ARGUMENTS, beforeFunctionIds, afterFunctionIds } };
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
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.MULTIPLY_EXPONENTS, beforeFunctionIds: [argument1.id, argument2.id], afterFunctionIds: [newFunction.arguments[i].id] } };
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
		return { collapsed: true, algebraFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.MULTIPLY_OUT_NESTED_EXPONENTS, beforeFunctionIds: [exponent.arguments[0].id, exponent.arguments[1].id], afterFunctionIds: [newFunction.id] } };
	}
	else if (expBase.functionType == AlgebraFunctionType.EXPONENTIAL) { // Fold down nested exponents
		var newExponent = FunctionArguments(1, AlgebraFunctionType.MUL, CloneAlgebraFunction(expBase.arguments[1]), CloneAlgebraFunction(exponent));
		algebraFunction.arguments[1] = newExponent;
		algebraFunction.arguments[0] = CloneAlgebraFunction(expBase.arguments[0]);
		return { collapsed: true, algebraFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.MULTIPLY_OUT_NESTED_EXPONENTS, beforeFunctionIds: [expBase.arguments[1].id, exponent.id], afterFunctionIds: [newExponent.id] } };
	}
	if (exponent.functionType == AlgebraFunctionType.PRIMITIVE && exponent.symbol == AlgebraSymbol.NUMBER) {
		if (exponent.quantity == 0) {
			var newPrimitive = FunctionPrimitive(algebraFunction.quantity);
			return { collapsed: true, algebraFunction: newPrimitive, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.EXPONENT_IS_ZERO, beforeFunctionIds: [algebraFunction.id], afterFunctionIds: [newPrimitive.id] } };
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
			return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.CONVERT_NEGATIVE_EXPONENT_TO_RECIPROCAL, beforeFunctionIds: [exponent.id], afterFunctionIds: [newFunction.id] } };
		}
		else if (!(expBase.functionType == AlgebraFunctionType.PRIMITIVE && expBase.symbol != AlgebraSymbol.NUMBER) || exponent.quantity == 1) {
			if (exponent.quantity == 1) {
				expBase.quantity = algebraFunction.quantity;
				return { collapsed: true, algebraFunction: expBase, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.EXPONENT_IS_ONE, beforeFunctionIds: [exponent.id], afterFunctionIds: [] } };
			}
			if (exponent.quantity > 0) {
				var newFunctionIds: number[] = [];
				const newFunction = FunctionArguments(algebraFunction.quantity, AlgebraFunctionType.MUL);
				for (let i = 0; i < exponent.quantity; i++) {
					var functionBase = CloneAlgebraFunction(algebraFunction.arguments[0], true);
					newFunction.arguments.push(functionBase);
					newFunctionIds.push(functionBase.id);
				}
				return { collapsed: true, algebraFunction: newFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.CONVERT_NUMERIC_EXPONENT_TO_REPEATED_MUL, beforeFunctionIds: [exponent.id], afterFunctionIds: newFunctionIds } };
			}
		}
	}
	// Root of primitive number
	else if (exponent.functionType == AlgebraFunctionType.DIV) {
		if (exponent.arguments[1].functionType == AlgebraFunctionType.PRIMITIVE && exponent.arguments[1].symbol == AlgebraSymbol.NUMBER
			&& expBase.functionType == AlgebraFunctionType.PRIMITIVE && expBase.symbol == AlgebraSymbol.NUMBER) {
			var result = Math.pow(expBase.quantity, 1 / exponent.arguments[1].quantity);
			if (Math.floor(result) == result) {
				var newPrimitive = FunctionPrimitive(result);
				return { collapsed: true, algebraFunction: newPrimitive, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.SQUARE_ROOT_OF_PRIMITIVE_NUMBER, beforeFunctionIds: [expBase.id], afterFunctionIds: [newPrimitive.id] } };
			}
			return { collapsed: false, algebraFunction };
		}
	}
	return { collapsed: false, algebraFunction };
}

function Div(algebraFunction: AlgebraFunction): FunctionResult {
	const numerator = algebraFunction.arguments[0];
	const denominator = algebraFunction.arguments[1];
	if (denominator.functionType == AlgebraFunctionType.PRIMITIVE && denominator.symbol == AlgebraSymbol.NUMBER && denominator.quantity == 1) {
		return { collapsed: true, algebraFunction: numerator, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.COLLAPSE_DIV_WITH_DENOMINATOR_1, beforeFunctionIds: [denominator.id], afterFunctionIds: [] } };
	}
	if (numerator.functionType == AlgebraFunctionType.PRIMITIVE && numerator.symbol == AlgebraSymbol.NUMBER && numerator.quantity == 0) {
		return { collapsed: true, algebraFunction: numerator, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.COLLAPSE_DIV_WITH_NUMERATOR_0, beforeFunctionIds: [numerator.id], afterFunctionIds: [numerator.id] } };
	}
	// function / Div = Multiply by reciprocal
	const numeratorIsDiv = numerator.functionType == AlgebraFunctionType.DIV;
	const denominatorIsDiv = denominator.functionType == AlgebraFunctionType.DIV;
	if (numeratorIsDiv || denominatorIsDiv) {
		const newFunction = FunctionArguments(algebraFunction.quantity, AlgebraFunctionType.MUL,
			FunctionArguments(1, AlgebraFunctionType.DIV,
				numeratorIsDiv ? numerator.arguments[0] : numerator,
				numeratorIsDiv ? numerator.arguments[1] : FunctionPrimitive(1)
			),
			FunctionArguments(1, AlgebraFunctionType.DIV,
				denominatorIsDiv ? denominator.arguments[1] : FunctionPrimitive(1),
				denominatorIsDiv ? denominator.arguments[0] : denominator
			)
		);
		return {
			collapsed: true,
			algebraFunction: newFunction,
			functionCollapseInfo: {
				functionCollapseType: FunctionCollapseType.CONVERT_NESTED_DIV_TO_RECIPROCAL_MUL,
				beforeFunctionIds: [denominator.id],
				afterFunctionIds: [newFunction.arguments[1].id]
			}
		};
	}
	if (CalculateResultHashes(numerator).exactHash == CalculateResultHashes(denominator).exactHash) {
		var newPrimitive = FunctionPrimitive(1);
		return { collapsed: true, algebraFunction: newPrimitive, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.COLLAPSE_VALUE_DIVIDED_BY_ITSELF, beforeFunctionIds: [numerator.id, denominator.id], afterFunctionIds: [newPrimitive.id] } };
	}
	if (numerator.functionType == AlgebraFunctionType.ADD) // If even one term in the numerator add function is divisible, split into ADD(DIV + DIV)
	{
		for (var i = 0; i < numerator.arguments.length; i++) {
			var result = Div(FunctionArguments(1, AlgebraFunctionType.DIV, numerator.arguments[i], denominator));
			if (result.collapsed) {
				var numeratorClone = CloneAlgebraFunction(numerator);
				numeratorClone.arguments.splice(i, 1);
				const lhs = FunctionArguments(1, AlgebraFunctionType.DIV, CloneAlgebraFunction(numerator.arguments[i], true), CloneAlgebraFunction(denominator));
				const rhs = FunctionArguments(1, AlgebraFunctionType.DIV, numeratorClone, CloneAlgebraFunction(denominator, true));
				var func: FunctionResult = {
					collapsed: true,
					algebraFunction: FunctionArguments(1, AlgebraFunctionType.ADD, lhs, rhs),
					functionCollapseInfo: { functionCollapseType: FunctionCollapseType.SPLIT_AND_DIVIDE_DIV, beforeFunctionIds: [numerator.arguments[i].id, denominator.id], afterFunctionIds: [lhs.id, rhs.id] }
				};
				return func;
			}
		}
	}
	// TODO limit this to maximum quantity value found inside function, dividing by a larger prime is pointless
	for (const prime of primesGenerated) {
		var primePrimitive = FunctionPrimitive(prime);
		const tryNumerator = DivInternal(numerator, FunctionPrimitive(prime));
		const tryDenominator = DivInternal(denominator, FunctionPrimitive(prime));
		if (tryNumerator.collapsed && tryDenominator.collapsed) {
			algebraFunction.arguments[0] = tryNumerator.remainder;
			algebraFunction.arguments[1] = tryDenominator.remainder;
			return { collapsed: true, algebraFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.DIV_NUMERATOR_DENOMINATOR_COMMON_FACTOR, beforeFunctionIds: [numerator.id, denominator.id], afterFunctionIds: [algebraFunction.arguments[0].id, algebraFunction.arguments[1].id], additionalInfo: primePrimitive } };
		}
	}
	for (const symbol of getAlgebraSymbolsInFunction(numerator).concat(getAlgebraSymbolsInFunction(denominator))) {
		var symbolPrimitive = FunctionPrimitive(1, symbol);
		const tryNumerator = DivInternal(numerator, FunctionPrimitive(1, symbol));
		const tryDenominator = DivInternal(denominator, FunctionPrimitive(1, symbol));
		if (tryNumerator.collapsed && tryDenominator.collapsed && tryNumerator.divisor.symbol == tryDenominator.divisor.symbol) {
			algebraFunction.arguments[0] = tryNumerator.remainder;
			algebraFunction.arguments[1] = tryDenominator.remainder;
			return { collapsed: true, algebraFunction, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.DIV_NUMERATOR_DENOMINATOR_COMMON_FACTOR, beforeFunctionIds: [numerator.id, denominator.id], afterFunctionIds: [algebraFunction.arguments[0].id, algebraFunction.arguments[1].id], additionalInfo: symbolPrimitive } };
		}
	}

	const dividedNumerator = DivInternal(numerator, denominator);

	if (dividedNumerator.collapsed) {
		algebraFunction.arguments[0] = dividedNumerator.remainder;
		algebraFunction.arguments[1] = (DivInternal(denominator, dividedNumerator.divisor) as DivisionSuccess).remainder;
		PrintDebug("Numerator is directly divisible by denominator");
		return { collapsed: true, algebraFunction, functionCollapseInfo: dividedNumerator.functionCollapseInfo };
	}
	else {

	}
	return { collapsed: false, algebraFunction };
}

function DivInternal(numerator: AlgebraFunction, denominator: AlgebraFunction): DivisionResult {
	const clonedNumerator = CloneAlgebraFunction(numerator);
	const clonedDenominator = CloneAlgebraFunction(denominator);
	// If we can divide out the quantity of the whole function, early return
	if (clonedDenominator.quantity != 1 && clonedNumerator.quantity / clonedDenominator.quantity == Math.floor(clonedNumerator.quantity / clonedDenominator.quantity)) {
		clonedNumerator.quantity /= clonedDenominator.quantity;
		return { collapsed: true, remainder: clonedNumerator, divisor: FunctionPrimitive(clonedDenominator.quantity), functionCollapseInfo: { functionCollapseType: FunctionCollapseType.DIV_NUMERATOR_DENOMINATOR_COMMON_FACTOR, beforeFunctionIds: [numerator.id, denominator.id], afterFunctionIds: [], additionalInfo: clonedDenominator } };
	}
	if (clonedNumerator.functionType == AlgebraFunctionType.PRIMITIVE && clonedDenominator.functionType == AlgebraFunctionType.PRIMITIVE) {
		if (clonedNumerator.symbol != AlgebraSymbol.NUMBER && clonedNumerator.symbol == clonedDenominator.symbol) {
			return { collapsed: true, remainder: FunctionPrimitive(clonedNumerator.quantity), divisor: FunctionPrimitive(1, clonedNumerator.symbol), functionCollapseInfo: { functionCollapseType: FunctionCollapseType.DIV_NUMERATOR_DENOMINATOR_COMMON_FACTOR, beforeFunctionIds: [numerator.id, denominator.id], afterFunctionIds: [], additionalInfo: clonedDenominator } };
		}
		return { collapsed: false };
	}
	else if (clonedNumerator.functionType == AlgebraFunctionType.ADD) {
		let divisor: AlgebraFunction | undefined;
		var functionCollapseInfo: FunctionCollapseInfo | undefined;
		for (let i = 0; i < clonedNumerator.arguments.length; i++) {
			const result = DivInternal(clonedNumerator.arguments[i], clonedDenominator);
			if (!result.collapsed) {
				return result;
			}
			else {
				functionCollapseInfo = result.functionCollapseInfo;
				clonedNumerator.arguments[i] = result.remainder;
				divisor = result.divisor;
			}
		}
		return { collapsed: true, remainder: clonedNumerator, divisor: divisor!, functionCollapseInfo: functionCollapseInfo! };
	}
	else if (clonedNumerator.functionType == AlgebraFunctionType.MUL) {
		for (let i = 0; i < clonedNumerator.arguments.length; i++) {
			const result = DivInternal(clonedNumerator.arguments[i], clonedDenominator);
			if (result.collapsed) {
				clonedNumerator.arguments[i] = result.remainder;
				return { collapsed: true, remainder: clonedNumerator, divisor: result.divisor, functionCollapseInfo: result.functionCollapseInfo };
			}
		}
		return { collapsed: false };
	}
	else if (clonedNumerator.functionType == AlgebraFunctionType.PRIMITIVE || clonedNumerator.functionType == AlgebraFunctionType.EXPONENTIAL) {
		if (CalculateResultHashes(clonedNumerator).mulHash == CalculateResultHashes(clonedDenominator).mulHash) {

			const numeratorExponentContents = numerator.functionType == AlgebraFunctionType.EXPONENTIAL ? CloneAlgebraFunction(numerator.arguments[1], true) : FunctionPrimitive(1);
			const denominatorExponentContents = denominator.functionType == AlgebraFunctionType.EXPONENTIAL ? CloneAlgebraFunction(denominator.arguments[1], true) : FunctionPrimitive(1);
			denominatorExponentContents.quantity *= -1;
			var newExponent = FunctionArguments(1, AlgebraFunctionType.ADD, numeratorExponentContents, denominatorExponentContents);
			const newBase = CloneAlgebraFunction(numerator.functionType == AlgebraFunctionType.EXPONENTIAL ? numerator.arguments[0] : numerator);
			newBase.quantity = 1;
			const newExponential = FunctionArguments(numerator.quantity, AlgebraFunctionType.EXPONENTIAL, newBase, newExponent);
			clonedDenominator.quantity = 1;
			return { collapsed: true, remainder: newExponential, divisor: clonedDenominator, functionCollapseInfo: { functionCollapseType: FunctionCollapseType.DIV_NUMERATOR_DENOMINATOR_COMMON_FACTOR, beforeFunctionIds: [numerator.id, denominator.id], afterFunctionIds: [], additionalInfo: clonedDenominator } };
		}
		return { collapsed: false };
	}
	return { collapsed: false };
}

export function FunctionPrimitive(quantity: number, symbol: string = AlgebraSymbol.NUMBER): AlgebraFunction {
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
		if (i == 1 && algebraFunction.functionType == AlgebraFunctionType.DIV) {
			resultHashes.addHash = subResults.exactHash;
		}
	}
	if (algebraFunction.functionType == AlgebraFunctionType.EXPONENTIAL) {
		resultHashes.addHash = resultHashes.exactHash;
	}
	return resultHashes;
}

function getAlgebraSymbolsInFunction(algebraFunction: AlgebraFunction): string[] {
	const functionsToInspect = [algebraFunction];
	const symbolsToReturn: string[] = [];
	while (functionsToInspect.length > 0) {
		const current = functionsToInspect.splice(functionsToInspect.length - 1, 1)[0];
		if (current.functionType === AlgebraFunctionType.PRIMITIVE && current.symbol !== AlgebraSymbol.NUMBER) {
			symbolsToReturn.push(current.symbol);
		} else if (current.arguments.length > 0) {
			functionsToInspect.push(...current.arguments);
		}
	}
	return symbolsToReturn;
}

export function PrintFunctionsWithoutColors(algebraFunction: AlgebraFunction): string {
	return PrintFunctions(algebraFunction, [], FunctionCollapseType.DISTRIBUTE_QUANTITY_INTO_FUNCTION);
}

export function PrintFunctions(algebraFunction: AlgebraFunction, affectedFunctionIds: number[], functionCollapseType: FunctionCollapseType): string {
	let output = "";
	let modifiedMatched = false;
	const toInspect: Printable[] = [{ isString: false, algebraFunction }];
	while (toInspect.length > 0) {
		const current = toInspect[toInspect.length - 1];
		toInspect.splice(toInspect.length - 1, 1);
		if (current.isString === true) {
			output += current.stringValue;
		} else {
			const affectedFunction = affectedFunctionIds != null && affectedFunctionIds.includes(current.algebraFunction.id);
			const collapseDocumentation = collapseTypeDocumentation[functionCollapseType];
			if (current.algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE) {
				if (affectedFunction) output += "__MODIFIED__";
				output += current.algebraFunction.quantity.toString();
				if (affectedFunction && collapseDocumentation.affectsQuantity) output += "__MODIFIED__";
				if (current.algebraFunction.symbol != AlgebraSymbol.NUMBER) output += current.algebraFunction.symbol;
				if (affectedFunction && !collapseDocumentation.affectsQuantity) output += "__MODIFIED__";
			}
			else {
				if (affectedFunction && !collapseDocumentation.affectsQuantity) {
					output += "__MODIFIED__";
					toInspect.push({ isString: true, stringValue: "__MODIFIED__" });
				}
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
				toInspect.push({ isString: true, stringValue: `(` });
				if (affectedFunction && collapseDocumentation.affectsQuantity) {
					toInspect.push({ isString: true, stringValue: "__MODIFIED__" });
				}
				toInspect.push({ isString: true, stringValue: current.algebraFunction.quantity.toString() });
				if (affectedFunction && collapseDocumentation.affectsQuantity) {
					toInspect.push({ isString: true, stringValue: "__MODIFIED__" });
				}
			}
		}
	}
	return output;
}

export function PrintFunctionsLatexWithoutColors(algebraFunction: AlgebraFunction) {
	return PrintFunctionsLatex(algebraFunction, [], FunctionCollapseType.COLLAPSE_DIV_WITH_DENOMINATOR_1);
}

export function PrintFunctionsLatex(algebraFunction: AlgebraFunction, affectedFunctionIds: number[], functionCollapseType: FunctionCollapseType, highlightColor: string = "black"): string {
	let output = affectedFunctionIds.length > 0 ? "\\color{black}" : "";
	const startColor = `\\color{${highlightColor}}`
	const endColor = `\\color{black}`
	const toInspect: Printable[] = [{ isString: false, algebraFunction }];
	while (toInspect.length > 0) {
		const current = toInspect[toInspect.length - 1];
		toInspect.splice(toInspect.length - 1, 1);
		if (current.isString === true) {
			output += current.stringValue;
		}
		else {
			const affectedFunction = affectedFunctionIds != null && affectedFunctionIds.includes(current.algebraFunction.id);
			const collapseDocumentation = collapseTypeDocumentation[functionCollapseType];
			if (current.algebraFunction.functionType == AlgebraFunctionType.PRIMITIVE) {
				if (affectedFunction) output += startColor;
				let quantity = Math.abs(current.algebraFunction.quantity).toString();
				if (current.algebraFunction.symbol != AlgebraSymbol.NUMBER) {
					if (quantity === "1") {
						quantity = "";
					}
				}
				if (current.algebraFunction === algebraFunction && current.algebraFunction.quantity !== 1) {
					quantity = current.algebraFunction.quantity.toString();
				}
				if (current.showSign) {
					quantity = (current.algebraFunction.quantity >= 0 ? "+" : "-") + quantity;
				}
				output += quantity;
				if (affectedFunction && collapseDocumentation.affectsQuantity) output += endColor;
				output += (current.algebraFunction.symbol != AlgebraSymbol.NUMBER ? current.algebraFunction.symbol.toLocaleLowerCase() : "");
				if (affectedFunction && !collapseDocumentation.affectsQuantity) output += endColor;
			} else {
				if (affectedFunction && !collapseDocumentation.affectsQuantity) {
					output += startColor;
					toInspect.push({ isString: true, stringValue: endColor });
				}
				if (current.algebraFunction.functionType === AlgebraFunctionType.DIV) {
					toInspect.push({ isString: true, stringValue: "}" });
				}
				if (current.algebraFunction.functionType === AlgebraFunctionType.EXPONENTIAL) {
					toInspect.push({ isString: true, stringValue: "}" });
				}
				var isRoot = current.algebraFunction.functionType === AlgebraFunctionType.EXPONENTIAL && current.algebraFunction.arguments[1].functionType == AlgebraFunctionType.DIV;
				if (current.algebraFunction.functionType === AlgebraFunctionType.ADD && current.algebraFunction.quantity != 1) {
					toInspect.push({ isString: true, stringValue: ")" });
				}
				if (!isRoot) {
					for (let i = current.algebraFunction.arguments.length - 1; i >= 0; i--) {
						if (i < current.algebraFunction.arguments.length - 1) {
							let separator = "";
							switch (current.algebraFunction.functionType) {
								case AlgebraFunctionType.ADD: {
									if (current.algebraFunction.arguments[i + 1].quantity > 0) {
										separator = " + ";
									} else {
										separator = " - ";
									}
									break;
								}
								case AlgebraFunctionType.MUL: {
									if (((current.algebraFunction.arguments[i].functionType == AlgebraFunctionType.PRIMITIVE && current.algebraFunction.arguments[i].symbol == AlgebraSymbol.NUMBER))
										|| (current.algebraFunction.arguments[i + 1].functionType == AlgebraFunctionType.PRIMITIVE && current.algebraFunction.arguments[i + 1].symbol === AlgebraSymbol.NUMBER)
										|| (current.algebraFunction.arguments[i + 1].functionType == AlgebraFunctionType.DIV && current.algebraFunction.arguments[i].functionType == AlgebraFunctionType.DIV)) {
										separator = " ⋅ ";
									} else {
										separator = "";
										if (current.algebraFunction.arguments[i + 1].quantity < 0) {
											separator += "-";
										}
									}
									break;
								}
								case AlgebraFunctionType.EXPONENTIAL: {
									separator = " ^{ ";
									break;
								}
								case AlgebraFunctionType.DIV: separator = " \\over "; break;
							}
							toInspect.push({ isString: true, stringValue: `${separator}` });
						}
						var useParenthesis = ((current.algebraFunction.functionType === AlgebraFunctionType.MUL || current.algebraFunction.functionType == AlgebraFunctionType.EXPONENTIAL) && current.algebraFunction.arguments[i].functionType === AlgebraFunctionType.ADD);
						if (useParenthesis) {
							toInspect.push({ isString: true, stringValue: ")" });
						}
						toInspect.push({ isString: false, algebraFunction: current.algebraFunction.arguments[i], showSign: i === 0 && current.algebraFunction.arguments[i].quantity < 0 });
						if (useParenthesis) {
							toInspect.push({ isString: true, stringValue: "(" });
						}
					}
				}
				if (current.algebraFunction.functionType === AlgebraFunctionType.ADD && current.algebraFunction.quantity != 1) {
					toInspect.push({ isString: true, stringValue: "(" });
				}
				if (isRoot) {
					toInspect.push({ isString: false, algebraFunction: current.algebraFunction.arguments[0] });
					toInspect.push({ isString: true, stringValue: "{" });
					toInspect.push({ isString: true, stringValue: "]" });
					if (current.algebraFunction.arguments[1].arguments[1].quantity > 2) {
						toInspect.push({ isString: false, algebraFunction: current.algebraFunction.arguments[1].arguments[1] });
					}
					toInspect.push({ isString: true, stringValue: "\\sqrt[" });
				}
				if (current.algebraFunction.functionType === AlgebraFunctionType.DIV) {
					toInspect.push({ isString: true, stringValue: "{" });
				}
				if (affectedFunction && collapseDocumentation.affectsQuantity) {
					toInspect.push({ isString: true, stringValue: endColor });
				}
				if (Math.abs(current.algebraFunction.quantity) !== 1) {
					toInspect.push({ isString: true, stringValue: `${Math.abs(current.algebraFunction.quantity)}` });
				}
				if (affectedFunction && collapseDocumentation.affectsQuantity) {
					toInspect.push({ isString: true, stringValue: startColor });
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
			newArguments.push(CloneAlgebraFunction(argument, newId));
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
	NUMBER = '\0',
}

export enum AlgebraFunctionType {
	NONE,
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
		symbol: string; // Only used for primitives
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
	functionCollapseInfo: FunctionCollapseInfo;
}
type DivisionResult = DivisionSuccess | {
	collapsed: false;
}

type FunctionCollapseTypeDocumentation = {
	functionCollapseType: FunctionCollapseType;
	devMessage: string;
	humanReadableMessage: string;
	affectsQuantity?: boolean;
	internalOnly?: boolean;
	hasAdditionalInfo?: boolean;
}

type FunctionCollapseInfo =
	{
		beforeFunctionIds: number[];
		afterFunctionIds: number[];
		functionCollapseType: FunctionCollapseType;
		additionalInfo?: AlgebraFunction;
	}

export type FunctionResult =
	{
		collapsed: boolean;
		algebraFunction: AlgebraFunction;
		functionCollapseInfo?: FunctionCollapseInfo;
	}

type Printable =
	{
		isString: true;
		stringValue: string;
	} |
	{
		isString: false;
		algebraFunction: AlgebraFunction;
		showSign?: boolean;
	}

const primesGenerated = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541];

export enum TestResult {
	SUCCESS,
	ASSERT_NOT_MATCH,
	INFINITE_LOOP
}