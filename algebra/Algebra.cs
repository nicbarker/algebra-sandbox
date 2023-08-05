public class Algebra
{
    public struct Value
    {
        public char value;
        public int quantity;
        public Value()
        {
            value = '1';
            quantity = 1;
        }
    };
    public struct ValueContainer
    {
        public Value baseValue;
        public Value pow;
        public ValueContainer()
        {
            baseValue = new Value();
            pow = new Value();
        }
    };
    public struct Token
    {
        public ValueContainer numerator;
        public ValueContainer denominator;

        public Token()
        {
            numerator = new ValueContainer();
            denominator = new ValueContainer();
        }
    }

    public struct TokenGroup
    {
        public uint groupId;
        public Token[] tokens;
    }

    public enum Operator
    {
        ADD,
        SUB,
        MUL,
        DIV,
        POW
    }

    private static string PrintValue(ref Value value, bool showQuantity = true, bool negative = false)
    {
        var quantity = negative && value.quantity == -1 ? "-" : value.quantity.ToString();
        if (value.value == '1' && showQuantity)
        {
            return quantity;
        }
        else if (value.value != '1')
        {
            return showQuantity ? $"{quantity}{value.value}" : value.value.ToString();
        }
        return "";
    }

    private static bool HasValue(Value value)
    {
        return value.value != '1' || value.quantity != 1;
    }

    public static string PrintTokens(TokenGroup[] groups)
    {
        var output = "";
        for (var gi = 0; gi < groups.Length; gi++)
        {
            var group = groups[gi];
            var denominators = new List<Token>(group.tokens).ConvertAll(t => t.denominator).Where(d => HasValue(d.baseValue)).ToArray();
            output += gi == 0 || (group.tokens[0].numerator.baseValue.quantity < 0 && !HasValue(group.tokens[0].denominator.baseValue)) ? "" : '+';
            if (denominators.Length > 0)
            {
                output += "{";
            }
            for (var i = 0; i < group.tokens.Length; i++)
            {
                var token = group.tokens[i];
                output += PrintValue(ref token.numerator.baseValue, token.numerator.baseValue.quantity != 1 || (token.numerator.baseValue.value == '1' && group.tokens.Length == 1), token.numerator.baseValue.quantity < 0);
                output += HasValue(token.numerator.pow) ? "^{${ printValue(token.numerator.pow)} }" : "";

            }
            if (denominators.Length > 0)
            {
                output += " \\over ";
                foreach (var denominator in denominators)
                {
                    output += "${ printValue(denominator.baseValue, denominator.baseValue.quantity != 1)}";
                    output += HasValue(denominator.pow) ? "^{${ printValue(denominator.pow)} }" : "";
                }
                output += "}";
            }
        }
        return output;
    }

    private static bool CanMultiply(ref Value value1, ref Value value2)
    {
        return value1.value == '1' || value2.value == '1' || value1.value == value2.value;
    }

    private static void Multiply(ref ValueContainer value1, ref ValueContainer value2)
    {
        value1.baseValue.quantity *= value2.baseValue.quantity;
        if (value1.baseValue.value == '1')
        {
            value1.baseValue.value = value2.baseValue.value;
            value1.pow.quantity = value2.pow.quantity;
        }
        else if (value1.baseValue.value == value2.baseValue.value)
        {
            value1.pow.quantity += value2.pow.quantity;
        }
        value2.baseValue = value1.baseValue;
    }

    private static void SubtractPow(ValueContainer value, int sub)
    {
        value.pow.quantity -= sub;
        if (value.pow.quantity == 0)
        {
            value.baseValue.value = '1';
            value.pow.quantity = 1;
        }
    }

    private static void Simplify(ref Token token, bool alone)
    {
        if (token.numerator.baseValue.value != '1' && token.numerator.baseValue.value == token.denominator.baseValue.value)
        {
            var min = Math.Min(token.numerator.pow.quantity, token.denominator.pow.quantity);
            SubtractPow(token.numerator, min);
            SubtractPow(token.denominator, min);
        }
        if (Math.Floor((float)token.numerator.baseValue.quantity / token.denominator.baseValue.quantity) == token.numerator.baseValue.quantity / token.denominator.baseValue.quantity)
        {
            token.numerator.baseValue.quantity /= token.denominator.baseValue.quantity;
            token.denominator.baseValue.quantity = 1;
        }
        if (!alone && !HasValue(token.numerator.baseValue) && !HasValue(token.denominator.baseValue))
        {
            token.numerator.baseValue.value = '0'; // Token has been destroyed
        }
    }

    private static void ProcessMultiply(TokenGroup[] groups)
    {
        for (var gi = 0; gi < groups.Length; gi++)
        {
            var group = groups[gi];
            for (var i = 0; i < group.tokens.Length; i++)
            {
                ref var leaf1 = ref group.tokens[i];
                for (var j = i + 1; j < group.tokens.Length; j++)
                {
                    ref var leaf2 = ref group.tokens[j];
                    var canMultiplyNumerator = CanMultiply(ref leaf1.numerator.baseValue, ref leaf2.numerator.baseValue);
                    var canMultiplyDenominator = CanMultiply(ref leaf1.denominator.baseValue, ref leaf2.denominator.baseValue);
                    if (canMultiplyNumerator)
                    {
                        Multiply(ref leaf1.numerator, ref leaf2.numerator);
                        leaf2.numerator = new ValueContainer();
                    }
                    if (canMultiplyDenominator)
                    {
                        Multiply(ref leaf1.denominator, ref leaf2.denominator);
                        leaf2.denominator = new ValueContainer();
                    }
                    if (leaf1.numerator.baseValue.value == leaf2.denominator.baseValue.value || leaf2.numerator.baseValue.value == leaf1.denominator.baseValue.value)
                    {
                        var temp = leaf1.denominator;
                        leaf1.denominator = leaf2.denominator;
                        leaf2.denominator = temp;
                    }
                    Simplify(ref leaf2, group.tokens.Length == 1);
                }
                Simplify(ref leaf1, group.tokens.Length == 1);
            }
        }
    }

    private static void ProcessAdd(TokenGroup[] groups)
    {
        for (var i = 0; i < groups.Length - 1; i++)
        {
            var group1 = groups[i];
            for (var j = i + 1; j < groups.Length; j++)
            {
                var quantity1 = 0;
                var quantity2 = 0;
                var group2 = groups[j];
                if (group1.tokens.Length != group2.tokens.Length)
                {
                    continue;
                }
                var valid = true;
                for (var k = 0; k < group1.tokens.Length; k++)
                {
                    var token1 = group1.tokens[k];
                    var token2 = group2.tokens[k];
                    if (token1.numerator.baseValue.value != token2.numerator.baseValue.value
                        || token1.numerator.pow.value != token2.numerator.pow.value
                        || token1.numerator.pow.quantity != token2.numerator.pow.quantity
                        || token1.denominator.baseValue.value != token2.denominator.baseValue.value
                        || token1.denominator.pow.value != token2.denominator.pow.value
                        || token1.denominator.pow.quantity != token2.denominator.pow.quantity)
                    {
                        valid = false;
                        break;
                    }
                    if (token1.numerator.baseValue.value == '0') continue;
                    quantity1 = Math.Abs(Math.Abs(token1.numerator.baseValue.quantity)) > quantity1 ? token1.numerator.baseValue.quantity : quantity2;
                    quantity2 = Math.Abs(Math.Abs(token2.numerator.baseValue.quantity)) > quantity2 ? token2.numerator.baseValue.quantity : quantity1;
                }
                if (valid)
                {
                    for (var k = 0; k < group2.tokens.Length; k++)
                    {
                        group2.tokens[k].numerator.baseValue.value = '0';
                    }
                    group1.tokens[0].numerator.baseValue.quantity = quantity1 + quantity2;
                    if (group1.tokens[0].numerator.baseValue.quantity == 0)
                    {
                        for (var k = 0; k < group1.tokens.Length; k++)
                        {
                            group1.tokens[k].numerator.baseValue.value = '0';
                        }
                    }
                }
            }
        }
    }

    public static TokenGroup[] RemoveDestroyedTokens(TokenGroup[] groups)
    {
        var newGroups = new List<TokenGroup>(groups.Length);
        for (int i = 0; i < groups.Length; i++)
        {
            var group = groups[i];
            var newTokens = new List<Token>(group.tokens.Length);
            for (int j = 0; j < group.tokens.Length; j++)
            {
                var token = group.tokens[j];
                if (token.numerator.baseValue.value != '0')
                {
                    newTokens.Add(token);
                }
            }
            if (newTokens.Count > 0)
            {
                group.tokens = newTokens.ToArray();
                newGroups.Add(group);
            }
        }
        return newGroups.ToArray();
    }

    public static TokenGroup[] Command(TokenGroup[] oldGroups, TokenGroup[] newGroups, Operator operatorType)
    {
        uint nextGroupId = 0;
        TokenGroup[] createdGroups;
        if (operatorType == Operator.ADD || operatorType == Operator.SUB)
        {
            createdGroups = new TokenGroup[oldGroups.Length + newGroups.Length];
            Array.Copy(oldGroups, createdGroups, oldGroups.Length);
            Array.Copy(newGroups, 0, createdGroups, oldGroups.Length, newGroups.Length);
        }
        else if (operatorType == Operator.MUL || operatorType == Operator.DIV)
        {
            createdGroups = new TokenGroup[oldGroups.Length * newGroups.Length];
            for (var i = 0; i < oldGroups.Length; i++)
            {
                for (var j = 0; j < newGroups.Length; j++)
                {
                    var newTokens = new Token[oldGroups[i].tokens.Length + oldGroups[j].tokens.Length];
                    Array.Copy(oldGroups[i].tokens, newTokens, oldGroups[i].tokens.Length);
                    Array.Copy(newGroups[j].tokens, 0, newTokens, oldGroups[i].tokens.Length, newGroups[j].tokens.Length);
                    var newGroup = new TokenGroup
                    {
                        groupId = nextGroupId++,
                        tokens = newTokens
                    };
                }
            }
        }
        else
        {
            createdGroups = new TokenGroup[0];
        }
        ProcessMultiply(createdGroups);
        ProcessAdd(createdGroups);
        return RemoveDestroyedTokens(createdGroups);
    }
}