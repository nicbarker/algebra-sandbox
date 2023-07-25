#pragma once

#include <stdbool.h>
#include "tokens.c"

TokenIndex add(AlgebraTree *tree, Token *token1, Token *token2);

TokenIndex addMulPrimitive(AlgebraTree *tree, Token *mulToken, Token *primitiveToken)
{
    TokenIndex newMulGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_MUL);
    Token *newMulGroup = &tree->tokens[newMulGroupIndex];
    Token *mulQuantity = createTokenAsLeftChild(tree, TOKENTYPE_PRIMITIVE_NUMBER, newMulGroup);
    mulQuantity->childLeft.numberValue = tree->tokens[mulToken->childLeft.tokenIndex].childLeft.numberValue + 1;
    newMulGroup->childRight = mulToken->childRight;
    return newMulGroupIndex;
}

TokenIndex addMulMul(AlgebraTree *tree, Token *token1, Token *token2)
{
    TokenIndex newMulGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_MUL);
    Token *newMulGroup = &tree->tokens[newMulGroupIndex];
    Token *mulQuantity = createTokenAsLeftChild(tree, TOKENTYPE_PRIMITIVE_NUMBER, newMulGroup);
    mulQuantity->childLeft.numberValue = tree->tokens[token1->childLeft.tokenIndex].childLeft.numberValue + tree->tokens[token2->childLeft.tokenIndex].childLeft.numberValue;
    newMulGroup->childRight = token1->childRight;
    return newMulGroupIndex;
}

TokenIndex addAddMul(AlgebraTree *tree, Token *addGroupToken, Token *mulGroupToken)
{
    TokenIndex newAddGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_ADD);
    Token *newAddGroup = &tree->tokens[newAddGroupIndex];
    TokenIndex left = add(tree, &tree->tokens[addGroupToken->childLeft.tokenIndex], mulGroupToken);
    if (left != TOKEN_INDEX_NULL)
    {
        newAddGroup->childLeft.tokenIndex = left;
        newAddGroup->childRight = addGroupToken->childRight;
        return newAddGroupIndex;
    }
    TokenIndex right = add(tree, &tree->tokens[addGroupToken->childRight], mulGroupToken);
    if (right != TOKEN_INDEX_NULL)
    {
        newAddGroup->childLeft.tokenIndex = right;
        newAddGroup->childRight = addGroupToken->childLeft.tokenIndex;
        return newAddGroupIndex;
    }
    return TOKEN_INDEX_NULL;
}

TokenIndex addPrimitivePrimitive(AlgebraTree *tree, Token *token1, Token *token2)
{
    if (token1->tokenType == TOKENTYPE_PRIMITIVE_NUMBER && token2->tokenType == TOKENTYPE_PRIMITIVE_NUMBER)
    {
        TokenIndex newPrimitiveIndex = createTokenAndReturnIndex(tree, TOKENTYPE_PRIMITIVE_NUMBER);
        tree->tokens[newPrimitiveIndex].childLeft.numberValue = token1->childLeft.numberValue + token2->childLeft.numberValue;
        return newPrimitiveIndex;
    }
    if (token1->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL && token2->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL && token1->childLeft.pronumeralValue == token2->childLeft.pronumeralValue)
    {
        TokenIndex newMulGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_MUL);
        Token *newMulGroup = &tree->tokens[newMulGroupIndex];
        Token *newNumber = createTokenAsLeftChild(tree, TOKENTYPE_PRIMITIVE_NUMBER, newMulGroup);
        newNumber->childLeft.numberValue = 2;
        Token *newPronumeral = createTokenAsRightChild(tree, TOKENTYPE_PRIMITIVE_PRONUMERAL, newMulGroup);
        newPronumeral->childLeft.pronumeralValue = token1->childLeft.pronumeralValue;
        return newMulGroupIndex;
    }
    return TOKEN_INDEX_NULL;
}

TokenIndex addAddAdd(AlgebraTree *tree, Token *token1, Token *token2)
{
    TokenIndex newAddGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_ADD);
    TokenIndex newSubAddGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_ADD);
    Token *newSubAddGroup = &tree->tokens[newSubAddGroupIndex];
    Token *newAddGroup = &tree->tokens[newAddGroupIndex];
    TokenIndex leftLeft = add(tree, &tree->tokens[token1->childLeft.tokenIndex], &tree->tokens[token2->childLeft.tokenIndex]);
    if (leftLeft != TOKEN_INDEX_NULL)
    {
        newAddGroup->childLeft.tokenIndex = leftLeft;
        newAddGroup->childRight = newSubAddGroupIndex;
        newSubAddGroup->childLeft.tokenIndex = token1->childRight;
        newSubAddGroup->childRight = token2->childRight;
        return newAddGroupIndex;
    }
    TokenIndex leftRight = add(tree, &tree->tokens[token1->childLeft.tokenIndex], &tree->tokens[token2->childRight]);
    if (leftRight != TOKEN_INDEX_NULL)
    {
        newAddGroup->childLeft.tokenIndex = leftRight;
        newAddGroup->childRight = newSubAddGroupIndex;
        newSubAddGroup->childLeft.tokenIndex = token1->childRight;
        newSubAddGroup->childRight = token2->childLeft.tokenIndex;
        return newAddGroupIndex;
    }
    TokenIndex rightLeft = add(tree, &tree->tokens[token1->childRight], &tree->tokens[token2->childLeft.tokenIndex]);
    if (rightLeft != TOKEN_INDEX_NULL)
    {
        newAddGroup->childLeft.tokenIndex = rightLeft;
        newAddGroup->childRight = newSubAddGroupIndex;
        newSubAddGroup->childLeft.tokenIndex = token1->childLeft.tokenIndex;
        newSubAddGroup->childRight = token2->childRight;
        return newAddGroupIndex;
    }
    TokenIndex rightRight = add(tree, &tree->tokens[token1->childRight], &tree->tokens[token2->childRight]);
    if (rightRight != TOKEN_INDEX_NULL)
    {
        newAddGroup->childLeft.tokenIndex = rightRight;
        newAddGroup->childRight = newSubAddGroupIndex;
        newSubAddGroup->childLeft.tokenIndex = token1->childLeft.tokenIndex;
        newSubAddGroup->childRight = token2->childLeft.tokenIndex;
        return newAddGroupIndex;
    }
    return TOKEN_INDEX_NULL;
}

TokenIndex addPowPow(AlgebraTree *tree, Token *token1, Token *token2)
{
    TokenIndex newMulGroupIndex = createTokenAndReturnIndex(tree, TOKENTYPE_GROUP_MUL);
    Token *newMulGroup = &tree->tokens[newMulGroupIndex];
    Token *newNumber = createTokenAsLeftChild(tree, TOKENTYPE_PRIMITIVE_NUMBER, newMulGroup);
    newNumber->childLeft.numberValue = 2;
    Token *newPronumeral = cloneTokenAsRightChild(tree, token1, newMulGroup);
    return newMulGroupIndex;
}

// Add ------------------------------------------------------------

TokenIndex add(AlgebraTree *tree, Token *token1, Token *token2)
{
    if (!tokensCanBeAdded(tree, token1, token2))
    {
        return TOKEN_INDEX_NULL;
    }
    switch (token1->tokenType)
    {
    case TOKENTYPE_PRIMITIVE_NUMBER:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_MUL:
        {
            return addMulPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * PRIMITIVE ------------
          //   return addPowPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // PRIMITIVE + PRIMITIVE -
            return addPrimitivePrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_MUL:
        {
            return addMulPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * PRIMITIVE ------------
          //   return addPowPrimitive(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // PRIMITIVE + PRIMITIVE -
            return addPrimitivePrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_ADD:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_ADD:
        {
            printf("add add add\n");
            return addAddAdd(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_MUL:
        {
            return addAddMul(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_MUL:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_ADD:
        {
            return addAddMul(tree, token2, token1);
        }
        case TOKENTYPE_GROUP_MUL:
        {
            return addMulMul(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_POW:
        { // POW * PRIMITIVE ------------
          //   return addPowMul(tree, token2, token1);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // MUL + PRIMITIVE -
            return addMulPrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_POW:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_MUL:
        {
            //   return addPowMul(tree, token1, token2);
        }
        case TOKENTYPE_GROUP_POW:
        {
            return addPowPow(tree, token1, token2);
        }
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        case TOKENTYPE_PRIMITIVE_NUMBER:
        { // PRIMITIVE + PRIMITIVE -
          //   return addPowPrimitive(tree, token1, token2);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_DIV:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_DIV:
        {
            //   return addDivDiv(tree, token1, token2);
        }
        }
    }
    }
    printf("Add group fell through with types %d, %d\n", token1->tokenType, token2->tokenType);
    return TOKEN_INDEX_NULL;
}