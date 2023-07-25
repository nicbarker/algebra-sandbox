#pragma once

#include <stdbool.h>
#include "tokens.c"

TokenIndex multiply(AlgebraTree *tree, Token *token1, Token *token2);

// Multiply ------------------------------------------------------------

TokenIndex multiplyAddAdd(AlgebraTree *tree, Token *token1, Token *token2)
{
    TokenIndex newAddTokenIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_ADD);
    Token *newAddToken = &tree->tokens[newAddTokenIndex];
    Token *newAddTokenLeft = createTokenAsLeftChild(tree, TOKENTYPE_GROUP_ADD, newAddToken);
    Token *newAddTokenRight = createTokenAsRightChild(tree, TOKENTYPE_GROUP_ADD, newAddToken);

    Token *newMulGroupLeftLeft = createTokenAsLeftChild(tree, TOKENTYPE_GROUP_MUL, newAddTokenLeft);
    cloneTokenAsLeftChild(tree, &tree->tokens[token1->childLeft.tokenIndex], newMulGroupLeftLeft);
    cloneTokenAsRightChild(tree, &tree->tokens[token2->childLeft.tokenIndex], newMulGroupLeftLeft);

    Token *newMulGroupLeftRight = createTokenAsRightChild(tree, TOKENTYPE_GROUP_MUL, newAddTokenLeft);
    cloneTokenAsLeftChild(tree, &tree->tokens[token1->childLeft.tokenIndex], newMulGroupLeftRight);
    cloneTokenAsRightChild(tree, &tree->tokens[token2->childRight], newMulGroupLeftRight);

    Token *newMulGroupRightLeft = createTokenAsLeftChild(tree, TOKENTYPE_GROUP_MUL, newAddTokenRight);
    cloneTokenAsLeftChild(tree, &tree->tokens[token1->childRight], newMulGroupRightLeft);
    cloneTokenAsRightChild(tree, &tree->tokens[token2->childLeft.tokenIndex], newMulGroupRightLeft);

    Token *newMulGroupRightRight = createTokenAsRightChild(tree, TOKENTYPE_GROUP_MUL, newAddTokenRight);
    cloneTokenAsLeftChild(tree, &tree->tokens[token1->childRight], newMulGroupRightRight);
    cloneTokenAsRightChild(tree, &tree->tokens[token2->childRight], newMulGroupRightRight);

    return newAddTokenIndex;
}

TokenIndex multiplyAddPrimitive(AlgebraTree *tree, Token *addGroupToken, Token *primitiveToken)
{
    TokenIndex newAddTokenIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_ADD);
    Token *newAddToken = &tree->tokens[newAddTokenIndex];
    Token *newMulTokenLeft = createTokenAsLeftChild(tree, TOKENTYPE_GROUP_MUL, newAddToken);
    Token *newMulTokenRight = createTokenAsRightChild(tree, TOKENTYPE_GROUP_MUL, newAddToken);

    cloneTokenAsLeftChild(tree, &tree->tokens[addGroupToken->childLeft.tokenIndex], newMulTokenLeft);
    cloneTokenAsRightChild(tree, primitiveToken, newMulTokenLeft);

    cloneTokenAsLeftChild(tree, &tree->tokens[addGroupToken->childRight], newMulTokenRight);
    cloneTokenAsRightChild(tree, primitiveToken, newMulTokenRight);

    return newAddTokenIndex;
}

TokenIndex multiplyMulPrimitive(AlgebraTree *tree, Token *mulGroupToken, Token *primitiveToken)
{
    if (primitiveToken->childLeft.numberValue == 1)
    {
        return cloneTokenAndReturnIndex(tree, mulGroupToken);
    }
    return TOKEN_INDEX_NULL;
}

TokenIndex multiplyPrimitivePrimitive(AlgebraTree *tree, Token *token1, Token *token2)
{
    if (token1->tokenType == TOKENTYPE_PRIMITIVE_NUMBER && token2->tokenType == TOKENTYPE_PRIMITIVE_NUMBER)
    {
        TokenIndex newPrimitiveIndex = createTokenAndReturnIndex(tree, TOKENTYPE_PRIMITIVE_NUMBER);
        tree->tokens[newPrimitiveIndex].childLeft.numberValue = token1->childLeft.numberValue *= token1->childLeft.numberValue;
        return newPrimitiveIndex;
    }
    if (token1->tokenType == TOKENTYPE_PRIMITIVE_NUMBER && token1->childLeft.numberValue == 1 && token2->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL)
    {
        TokenIndex newPrimitiveIndex = createTokenAndReturnIndex(tree, TOKENTYPE_PRIMITIVE_PRONUMERAL);
        tree->tokens[newPrimitiveIndex].childLeft.pronumeralValue = token2->childLeft.pronumeralValue;
        return newPrimitiveIndex;
    }
    if (token2->tokenType == TOKENTYPE_PRIMITIVE_NUMBER && token2->childLeft.numberValue == 1 && token1->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL)
    {
        TokenIndex newPrimitiveIndex = createTokenAndReturnIndex(tree, TOKENTYPE_PRIMITIVE_PRONUMERAL);
        tree->tokens[newPrimitiveIndex].childLeft.pronumeralValue = token1->childLeft.pronumeralValue;
        return newPrimitiveIndex;
    }
    // x * x = x^2
    if (token1->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL && token2->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL && token1->childLeft.pronumeralValue == token2->childLeft.pronumeralValue)
    {
        TokenIndex newPowGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_POW);
        Token *newPowGroup = &tree->tokens[newPowGroupIndex];
        Token *newBase = createTokenAsLeftChild(tree, TOKENTYPE_PRIMITIVE_PRONUMERAL, newPowGroup);
        newBase->childLeft.pronumeralValue = token1->childLeft.pronumeralValue;
        Token *newExponent = createTokenAsRightChild(tree, TOKENTYPE_PRIMITIVE_NUMBER, newPowGroup);
        newExponent->childLeft.numberValue = 2;
        return newPowGroupIndex;
    }
    return TOKEN_INDEX_NULL;
}

TokenIndex multiplyPowPrimitive(AlgebraTree *tree, Token *powGroupToken, Token *primitiveToken)
{
    if (primitiveToken->tokenType == TOKENTYPE_PRIMITIVE_NUMBER)
    {
        if (primitiveToken->childLeft.numberValue == 1)
        {
            return cloneTokenAndReturnIndex(tree, powGroupToken);
        }
        else
        {
            return TOKEN_INDEX_NULL;
        }
    }
    if (tokensCanBeAdded(tree, &tree->tokens[powGroupToken->childLeft.tokenIndex], primitiveToken))
    {
        TokenIndex newPowTokenIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_POW);
        Token *newPowToken = &tree->tokens[newPowTokenIndex];
        newPowToken->childLeft.tokenIndex = powGroupToken->childLeft.tokenIndex;
        TokenIndex newExponentIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_ADD);
        Token *newExponent = &tree->tokens[newExponentIndex];
        newPowToken->childRight = newExponentIndex;
        // Clone the exponent and add to it
        Token *newMulTokenLeft = cloneTokenAsLeftChild(tree, &tree->tokens[powGroupToken->childRight], newExponent);
        Token *newMulTokenRight = createTokenAsRightChild(tree, TOKENTYPE_PRIMITIVE_NUMBER, newExponent);
        newMulTokenRight->childLeft.numberValue = 1;

        return newPowTokenIndex;
    }
}

TokenIndex multiplyPowMul(AlgebraTree *tree, Token *powGroupToken, Token *mulGroupToken)
{
    // Swap the pow into a group with the mul right child
    if (tokensCanBeAdded(tree, &tree->tokens[powGroupToken->childLeft.tokenIndex], mulGroupToken))
    {
        TokenIndex newMulTokenIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_MUL);
        Token *newMulToken = &tree->tokens[newMulTokenIndex];
        newMulToken->childLeft = mulGroupToken->childLeft;
        Token *newRightSideMulToken = createTokenAsRightChild(tree, TOKENTYPE_GROUP_MUL, newMulToken);
        newRightSideMulToken->childLeft.tokenIndex = mulGroupToken->childRight;
        newRightSideMulToken->childRight = cloneTokenAndReturnIndex(tree, powGroupToken);
        return newMulTokenIndex;
    }
}

TokenIndex multiply(AlgebraTree *tree, Token *token1, Token *token2)
{
    switch (token1->tokenType)
    {
    case TOKENTYPE_GROUP_ADD:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_ADD:
        { // ADD * ADD ------------------
            return multiplyAddAdd(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_MUL:
        { // ADD * MUL ------------------
          // return multiplyAddMul(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * ADD ------------------
          // return multiplyPowAdd(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // ADD * PRIMITIVE -----
            return multiplyAddPrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_MUL:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_ADD:
        { // MUL * ADD ------------------
          // return multiplyAddMul(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_DIV:
        { // MUL * DIV ------------------
          // return multiplyMulDiv(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * MUL ------------------
            return multiplyPowMul(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        {
            return TOKEN_INDEX_NULL;
        }
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // MUL * PRIMITIVE -----
            return multiplyMulPrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_DIV:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_MUL:
        { // DIV * MUL ------------------
          // return multiplyMulDiv(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_DIV:
        { // DIV * DIV ------------------
          // return multiplyDivDiv(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * DIV ------------------
          // return multiplyPowDiv(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // DIV * PRIMITIVE -
          // return multiplyDivPrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_POW:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_ADD:
        { // POW * ADD ------------------
          // return multiplyPowAdd(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_MUL:
        { // POW * DIV ------------------
            return multiplyPowMul(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_DIV:
        { // POW * DIV ------------------
          // return multiplyPowDiv(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * DIV ------------------
          // return multiplyPowPow(tree, token1, token2);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // POW * PRIMITIVE -
            return multiplyPowPrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_PRIMITIVE_NUMBER:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_ADD:
        { // ADD * PRIMITIVE ------------
            return multiplyAddPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_MUL:
        { // PRIMITIVE * MUL ------------
            return multiplyMulPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_DIV:
        { // DIV * PRIMITIVE ------------
          // return multiplyDivPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * PRIMITIVE ------------
            return multiplyPowPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // PRIMITIVE * PRIMITIVE -
            return multiplyPrimitivePrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_ADD:
        { // ADD * PRIMITIVE ------------
            return multiplyAddPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_MUL:
        {
            // return multiplyMulPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_DIV:
        { // DIV * DIV ------------------
          // return multiplyDivPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * PRIMITIVE -
            return multiplyPowPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // PRIMITIVE * PRIMITIVE -
            return multiplyPrimitivePrimitive(tree, token1, token2);
        }
        }
    }
    }
    printf("Warning: multiply case fell through for %d, %d\n", token1->tokenType, token2->tokenType);
    return TOKEN_INDEX_NULL;
}