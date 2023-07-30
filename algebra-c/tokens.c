#pragma once

#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

typedef unsigned char u8;
typedef unsigned short u16;

typedef u16 TokenIndex; // NOTE: High bit of 16 is used for storage of various concepts

const TokenIndex TOKEN_INDEX_NULL = 1 << 15;

typedef enum
{
    TOKENTYPE_NONE,
    TOKENTYPE_PRIMITIVE_NUMBER,     // 1
    TOKENTYPE_PRIMITIVE_PRONUMERAL, // 2
    TOKENTYPE_GROUP_ADD,            // 3
    TOKENTYPE_GROUP_MUL,            // 4
    TOKENTYPE_GROUP_DIV,            // 5
    TOKENTYPE_GROUP_POW,            // 6
    TOKENTYPE_GROUP_ROOT,           // 7
} TokenType;

typedef union
{
    TokenIndex tokenIndex;
    int numberValue;
    char pronumeralValue;
} ChildTokenIndexOrPrimitiveValue;

typedef struct
{
    int path;
    ChildTokenIndexOrPrimitiveValue childLeft;
    TokenIndex childRight;
    TokenType tokenType;
} Token;

typedef struct
{
    TokenIndex tokenIndex;
    int value;
} TokenPrimitiveNumberValue;

typedef struct
{
    TokenIndex tokenIndex;
    char numeral;
} TokenPrimitivePronumeralValue;

typedef struct
{
    Token *tokens;
    TokenIndex index;
    u16 frequency;
} SortableTokenIndex;

typedef struct
{
    Token *tokens;
    TokenIndex tokensCount;
    TokenIndex rootIndex;
    bool disposed;
} AlgebraTree;

typedef enum
{
    PRINTABLETYPE_CHAR,
    PRINTABLETYPE_INT,
    PRINTABLETYPE_EVALUATE
} PrintableTokenType;

typedef struct
{
    union PrintableValue
    {
        Token *token;
        int printableInt;
        char printableChar;
    } printableValue;
    PrintableTokenType printableType;
} PrintableToken;

// Functions -------------------------------------------
PrintableToken printableTokens[1000];

void _getTokensTEX(AlgebraTree *tree, Token *root, char *charBuffer)
{
    u8 charBufferCount = 0;
    printableTokens[0] = (PrintableToken){
        .printableType = PRINTABLETYPE_EVALUATE,
        .printableValue.token = root};

    int i = 1;
    while (i > 0)
    {
        i--;
        PrintableToken *printable = &printableTokens[i];
        if (printable->printableType == PRINTABLETYPE_CHAR)
        {
            charBufferCount += snprintf(&charBuffer[charBufferCount], 256, "%c", printable->printableValue.printableChar);
        }
        else if (printable->printableType == PRINTABLETYPE_INT)
        {
            charBufferCount += snprintf(&charBuffer[charBufferCount], 256, "%d", printable->printableValue.printableInt);
        }
        else
        {
            // Otherwise, evaluate the top token on the stack
            Token *token = printable->printableValue.token;
            switch (token->tokenType)
            {
            case TOKENTYPE_GROUP_ADD:
            case TOKENTYPE_GROUP_MUL:
            {
                bool isAdd = token->tokenType == TOKENTYPE_GROUP_ADD;
                bool isNestedAdd = (tree->tokens[token->childLeft.tokenIndex].tokenType == TOKENTYPE_GROUP_ADD || tree->tokens[token->childRight].tokenType == TOKENTYPE_GROUP_ADD) && i != 0;
                if (isAdd && isNestedAdd)
                {
                    printableTokens[i++] = (PrintableToken){
                        .printableType = PRINTABLETYPE_CHAR,
                        .printableValue.printableChar = ')'};
                }
                // else
                // {
                //     printableTokens[i++] = (PrintableToken){
                //         .printableType = PRINTABLETYPE_CHAR,
                //         .printableValue.printableChar = ']'};
                // }
                // Clip off the last operator
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_EVALUATE,
                    .printableValue.token = &tree->tokens[token->childRight]};
                if (isAdd)
                {
                    printableTokens[i++] = (PrintableToken){
                        .printableType = PRINTABLETYPE_CHAR,
                        .printableValue.printableChar = isAdd ? '+' : '*'};
                }
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_EVALUATE,
                    .printableValue.token = &tree->tokens[token->childLeft.tokenIndex]};
                if (isAdd && isNestedAdd)
                {
                    printableTokens[i++] = (PrintableToken){
                        .printableType = PRINTABLETYPE_CHAR,
                        .printableValue.printableChar = '('};
                }
                // else
                // {
                //     printableTokens[i++] = (PrintableToken){
                //         .printableType = PRINTABLETYPE_CHAR,
                //         .printableValue.printableChar = '['};
                // }
                break;
            }
            case TOKENTYPE_GROUP_POW:
            {
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_CHAR,
                    .printableValue.printableChar = '}'};
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_EVALUATE,
                    .printableValue.token = &tree->tokens[token->childRight]};
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_CHAR,
                    .printableValue.printableChar = '{'};
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_CHAR,
                    .printableValue.printableChar = '^'};
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_EVALUATE,
                    .printableValue.token = &tree->tokens[token->childLeft.tokenIndex]};
                break;
            }
            case TOKENTYPE_PRIMITIVE_NUMBER:
            {
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_INT,
                    .printableValue.printableInt = token->childLeft.numberValue};
                break;
            }
            case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            {
                printableTokens[i++] = (PrintableToken){
                    .printableType = PRINTABLETYPE_CHAR,
                    .printableValue.printableChar = token->childLeft.pronumeralValue};
                break;
            }
            }
        }
    }
}

static inline AlgebraTree *createAlgebraTree()
{
    Token *tokens = (Token *)(malloc(sizeof(Token) * 1000));
    AlgebraTree *tree = (AlgebraTree *)(malloc(sizeof(AlgebraTree)));
    *tree = (AlgebraTree){
        .tokens = tokens,
        .tokensCount = 0,
        .disposed = false,
        .rootIndex = 0};
    return tree;
}

static inline void disposeAlgebraTree(AlgebraTree *tree)
{
    if (!tree->disposed)
    {
        tree->disposed = true;
        free(tree->tokens);
        free(tree);
    }
    else
    {
        printf("Warning: disposeAlgebraTree was called with a tree that has already been disposed\n");
    }
}

static inline TokenIndex createTokenAndReturnIndex(AlgebraTree *tree, TokenType tokenType)
{
    for (TokenIndex i = 0; i < tree->tokensCount; i++)
    {
        if (tree->tokens[i].tokenType == TOKENTYPE_NONE)
        {
            tree->tokens[i] = (Token){.tokenType = tokenType, .childLeft.tokenIndex = TOKEN_INDEX_NULL, .childRight = TOKEN_INDEX_NULL};
            return i;
        }
    }
    tree->tokens[tree->tokensCount++] = (Token){.tokenType = tokenType};
    return tree->tokensCount - 1;
}

static inline Token *createToken(AlgebraTree *tree, TokenType tokenType)
{
    return &tree->tokens[createTokenAndReturnIndex(tree, tokenType)];
}

static inline Token *createTokenAsLeftChild(AlgebraTree *tree, TokenType tokenType, Token *parent)
{
    TokenIndex index = createTokenAndReturnIndex(tree, tokenType);
    parent->childLeft.tokenIndex = index;
    return &tree->tokens[index];
}

static inline Token *createTokenAsRightChild(AlgebraTree *tree, TokenType tokenType, Token *parent)
{
    TokenIndex index = createTokenAndReturnIndex(tree, tokenType);
    parent->childRight = index;
    return &tree->tokens[index];
}

void removeTokenAtIndex(AlgebraTree *tree, TokenIndex tokenIndex)
{
    tree->tokens[tokenIndex].tokenType = TOKENTYPE_NONE;
}

Token *cloneToken(AlgebraTree *tree, Token *token);

TokenIndex cloneTokenAndReturnIndex(AlgebraTree *tree, Token *token)
{
    TokenIndex newTokenIndex = createTokenAndReturnIndex(tree, token->tokenType);
    Token *newToken = &tree->tokens[newTokenIndex];
    // Left side
    if (token->tokenType == TOKENTYPE_PRIMITIVE_NUMBER)
    {
        newToken->childLeft.numberValue = token->childLeft.numberValue;
        return newTokenIndex;
    }
    else if (token->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL)
    {
        newToken->childLeft.pronumeralValue = token->childLeft.pronumeralValue;
        return newTokenIndex;
    }
    else
    {
        newToken->childLeft.tokenIndex = cloneTokenAndReturnIndex(tree, &tree->tokens[token->childLeft.tokenIndex]);
    }

    // Right side
    newToken->childRight = cloneTokenAndReturnIndex(tree, &tree->tokens[token->childRight]);
    return newTokenIndex;
}

TokenIndex cloneTokenBetweenTreesAndReturnIndex(AlgebraTree *destTree, AlgebraTree *sourceTree, Token *token)
{
    TokenIndex newTokenIndex = createTokenAndReturnIndex(destTree, token->tokenType);
    Token *newToken = &destTree->tokens[newTokenIndex];
    // Left side
    if (token->tokenType == TOKENTYPE_PRIMITIVE_NUMBER)
    {
        newToken->childLeft.numberValue = token->childLeft.numberValue;
        return newTokenIndex;
    }
    else if (token->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL)
    {
        newToken->childLeft.pronumeralValue = token->childLeft.pronumeralValue;
        return newTokenIndex;
    }
    else
    {
        if (token->childLeft.tokenIndex != TOKEN_INDEX_NULL)
        {
            newToken->childLeft.tokenIndex = cloneTokenBetweenTreesAndReturnIndex(destTree, sourceTree, &sourceTree->tokens[token->childLeft.tokenIndex]);
        }
    }

    // Right side
    if (token->childRight != TOKEN_INDEX_NULL)
    {
        newToken->childRight = cloneTokenBetweenTreesAndReturnIndex(destTree, sourceTree, &sourceTree->tokens[token->childRight]);
    }
    return newTokenIndex;
}

Token *cloneToken(AlgebraTree *tree, Token *token)
{
    return &tree->tokens[cloneTokenAndReturnIndex(tree, token)];
}

Token *cloneTokenAsLeftChild(AlgebraTree *tree, Token *token, Token *parent)
{
    TokenIndex newIndex = cloneTokenAndReturnIndex(tree, token);
    parent->childLeft.tokenIndex = newIndex;
    return &tree->tokens[newIndex];
}

Token *cloneTokenAsRightChild(AlgebraTree *tree, Token *token, Token *parent)
{
    TokenIndex newIndex = cloneTokenAndReturnIndex(tree, token);
    parent->childRight = newIndex;
    return &tree->tokens[newIndex];
}

int compareTokensAdd(const void *a, const void *b)
{
    SortableTokenIndex *tokenIndexA = (SortableTokenIndex *)a;
    SortableTokenIndex *tokenIndexB = (SortableTokenIndex *)b;
    Token *token_a = &tokenIndexA->tokens[tokenIndexA->index];
    Token *token_b = &tokenIndexB->tokens[tokenIndexB->index];
    if (tokenIndexA->frequency != tokenIndexB->frequency)
    {
        return tokenIndexB->frequency - tokenIndexA->frequency;
    }
    switch (token_a->tokenType)
    {
    case TOKENTYPE_PRIMITIVE_NUMBER:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return 0;
        default:
            return 1;
        }
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return -1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return token_a->childLeft.pronumeralValue - token_b->childLeft.pronumeralValue;
        default:
            return 1;
        }
    }
    case TOKENTYPE_GROUP_MUL:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return -1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return -1;
        case TOKENTYPE_GROUP_MUL:
            return 0;
        default:
            return 1;
        }
    }
    case TOKENTYPE_GROUP_ADD:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return -1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return -1;
        case TOKENTYPE_GROUP_MUL:
            return -1;
        case TOKENTYPE_GROUP_ADD:
            return 0;
        default:
            return 1;
        }
    }
    case TOKENTYPE_GROUP_POW:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return -1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return -1;
        case TOKENTYPE_GROUP_MUL:
            return -1;
        case TOKENTYPE_GROUP_ADD:
            return -1;
        case TOKENTYPE_GROUP_POW:
            return 0;
        default:
            return 1;
        }
    }
    }
    return 0;
}

int compareTokensMul(const void *a, const void *b)
{
    SortableTokenIndex *tokenIndexA = (SortableTokenIndex *)a;
    SortableTokenIndex *tokenIndexB = (SortableTokenIndex *)b;
    Token *token_a = &tokenIndexA->tokens[tokenIndexA->index];
    Token *token_b = &tokenIndexB->tokens[tokenIndexB->index];
    if (tokenIndexA->frequency != tokenIndexB->frequency)
    {
        return tokenIndexB->frequency - tokenIndexA->frequency;
    }
    switch (token_a->tokenType)
    {
    case TOKENTYPE_PRIMITIVE_NUMBER:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return 0;
        default:
            return -1;
        }
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return 1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return token_a->childLeft.pronumeralValue - token_b->childLeft.pronumeralValue;
        default:
            return -1;
        }
    }
    case TOKENTYPE_GROUP_MUL:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return 1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return 1;
        case TOKENTYPE_GROUP_MUL:
            return 0;
        default:
            return -1;
        }
    }
    case TOKENTYPE_GROUP_ADD:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return 1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return 1;
        case TOKENTYPE_GROUP_MUL:
            return 1;
        case TOKENTYPE_GROUP_ADD:
            return 0;
        default:
            return -1;
        }
    }
    case TOKENTYPE_GROUP_POW:
    {
        switch (token_b->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
            return 1;
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
            return 1;
        case TOKENTYPE_GROUP_MUL:
            return 1;
        case TOKENTYPE_GROUP_ADD:
            return 1;
        case TOKENTYPE_GROUP_POW:
            return 0;
        default:
            return -1;
        }
    }
    default:
    {
        return 0;
    }
    }
}

bool _tokensCanBeAdded(AlgebraTree *tree, Token *token1, Token *token2, bool respectNumericValue)
{
    printf("subadd %d, %d\n", token1->tokenType, token2->tokenType);
    char charBuffer[256];
    _getTokensTEX(tree, token1, charBuffer);
    printf("%s\n", charBuffer);
    _getTokensTEX(tree, token2, charBuffer);
    printf("%s\n", charBuffer);
    switch (token1->tokenType)
    {
    case TOKENTYPE_PRIMITIVE_NUMBER:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
        {
            if (respectNumericValue)
            {
                return token1->childLeft.numberValue == token2->childLeft.numberValue;
            }
            else
            {
                return true;
            }
        }
        }
        break;
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        {
            return token1->childLeft.pronumeralValue == token2->childLeft.pronumeralValue;
        }
        case TOKENTYPE_GROUP_MUL:
        {
            return tree->tokens[token2->childLeft.tokenIndex].tokenType == TOKENTYPE_PRIMITIVE_NUMBER && _tokensCanBeAdded(tree, token1, &tree->tokens[token2->childRight], respectNumericValue);
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
            return _tokensCanBeAdded(tree, &tree->tokens[token1->childLeft.tokenIndex], &tree->tokens[token2->childLeft.tokenIndex], respectNumericValue) // left left
                   || _tokensCanBeAdded(tree, &tree->tokens[token1->childLeft.tokenIndex], &tree->tokens[token2->childRight], respectNumericValue)        // left right
                   || _tokensCanBeAdded(tree, &tree->tokens[token1->childRight], &tree->tokens[token2->childLeft.tokenIndex], respectNumericValue)        // right left
                   || _tokensCanBeAdded(tree, &tree->tokens[token1->childRight], &tree->tokens[token2->childRight], respectNumericValue);                 // right right
        }
        case TOKENTYPE_GROUP_MUL:
        {
            return _tokensCanBeAdded(tree, &tree->tokens[token1->childLeft.tokenIndex], token2, respectNumericValue) //
                   && _tokensCanBeAdded(tree, &tree->tokens[token1->childRight], token2, respectNumericValue);       //
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_MUL:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        {
            return _tokensCanBeAdded(tree, token1, &tree->tokens[token2->childRight], respectNumericValue);
        }
        case TOKENTYPE_GROUP_ADD:
        {
            return _tokensCanBeAdded(tree, &tree->tokens[token2->childLeft.tokenIndex], token1, respectNumericValue) //
                   || _tokensCanBeAdded(tree, &tree->tokens[token2->childRight], token1, respectNumericValue);       //
        }
        case TOKENTYPE_GROUP_MUL:
        {
            return _tokensCanBeAdded(tree, &tree->tokens[token1->childLeft.tokenIndex], &tree->tokens[token2->childLeft.tokenIndex], respectNumericValue) //
                   && _tokensCanBeAdded(tree, &tree->tokens[token1->childRight], &tree->tokens[token2->childRight], respectNumericValue);
        }
        }
        break;
    }
    case TOKENTYPE_GROUP_POW:
    {
        switch (token2->tokenType)
        {
        case TOKENTYPE_GROUP_POW:
        {
            return _tokensCanBeAdded(tree, &tree->tokens[token1->childLeft.tokenIndex], &tree->tokens[token2->childLeft.tokenIndex], true) //
                   && _tokensCanBeAdded(tree, &tree->tokens[token1->childRight], &tree->tokens[token2->childRight], true);
        }
        }
        break;
    }
    }
    return false;
}

bool tokensCanBeAdded(AlgebraTree *tree, Token *token1, Token *token2)
{
    return _tokensCanBeAdded(tree, token1, token2, false);
}

void updateSortableTokenFrequencyForLikeTerms(AlgebraTree *tree, Token *token, SortableTokenIndex (*sortableTokenIndexes)[], u8 sortableTokenIndexesCount)
{
    u8 frequency = 1;
    for (int i = 0; i < sortableTokenIndexesCount; i++)
    {
        SortableTokenIndex *sortableIndex = &(*sortableTokenIndexes)[i];
        if (token != &tree->tokens[sortableIndex->index] && tokensCanBeAdded(tree, token, &tree->tokens[sortableIndex->index]))
        {
            frequency++;
            sortableIndex->frequency++;
        }
    }
    (*sortableTokenIndexes)[sortableTokenIndexesCount - 1].frequency = frequency;
}

// Returns false if re ordering occured, or true if the sort is stable
bool sortTokenGroup(AlgebraTree *tree, TokenIndex groupIndex)
{
    TokenType rootType = tree->tokens[groupIndex].tokenType;
    SortableTokenIndex indexesToSort[256];
    u8 indexesToSortCount = 0;
    TokenIndex indexesToInvestigate[256] = {groupIndex};
    u8 indexesToInvestigateCount = 1;
    while (indexesToInvestigateCount > 0)
    {
        TokenIndex tokenIndex = indexesToInvestigate[--indexesToInvestigateCount];
        Token *token = &tree->tokens[tokenIndex];
        switch (token->tokenType)
        {
        case TOKENTYPE_PRIMITIVE_NUMBER:
        case TOKENTYPE_PRIMITIVE_PRONUMERAL:
        {
            indexesToSort[indexesToSortCount++] = (SortableTokenIndex){
                .index = tokenIndex,
                .frequency = 1,
                .tokens = tree->tokens};
            updateSortableTokenFrequencyForLikeTerms(tree, token, &indexesToSort, indexesToSortCount);
            break;
        }
        case TOKENTYPE_GROUP_ADD:
        case TOKENTYPE_GROUP_MUL:
        {
            if (token->tokenType == rootType)
            {
                indexesToInvestigate[indexesToInvestigateCount++] = token->childRight;
                indexesToInvestigate[indexesToInvestigateCount++] = token->childLeft.tokenIndex;
            }
            else
            {
                indexesToSort[indexesToSortCount++] = (SortableTokenIndex){
                    .index = tokenIndex,
                    .frequency = 1,
                    .tokens = tree->tokens};
                updateSortableTokenFrequencyForLikeTerms(tree, token, &indexesToSort, indexesToSortCount);
            }
            break;
        }
        case TOKENTYPE_GROUP_POW:
        {
            indexesToSort[indexesToSortCount++] = (SortableTokenIndex){
                .index = tokenIndex,
                .frequency = 1,
                .tokens = tree->tokens};
            updateSortableTokenFrequencyForLikeTerms(tree, token, &indexesToSort, indexesToSortCount);
            break;
        }
        }
    }

    if (indexesToSortCount > 1)
    {
        printf("sorting %d tokens\n", indexesToSortCount);
        SortableTokenIndex sortedIndexes[256];
        Token copiedTokens[256];
        memcpy(sortedIndexes, indexesToSort, indexesToSortCount * sizeof(SortableTokenIndex));
        if (rootType == TOKENTYPE_GROUP_MUL)
        {
            qsort(sortedIndexes, indexesToSortCount, sizeof(SortableTokenIndex), compareTokensMul);
        }
        else if (rootType == TOKENTYPE_GROUP_ADD)
        {
            qsort(sortedIndexes, indexesToSortCount, sizeof(SortableTokenIndex), compareTokensAdd);
        }
        bool stable = true;
        for (int i = 0; i < indexesToSortCount; i++)
        {
            stable &= indexesToSort[i].index == sortedIndexes[i].index;
            copiedTokens[i] = tree->tokens[sortedIndexes[i].index];
        }
        for (int i = 0; i < indexesToSortCount; i++)
        {
            tree->tokens[indexesToSort[i].index] = copiedTokens[i];
        }
        return stable;
    }
    return true;
}
