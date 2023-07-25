#include <emscripten/emscripten.h>
#include "algebra.c"

char *charBuffer;
AlgebraTree *mainTree;

#define EXTERN

EXTERN EMSCRIPTEN_KEEPALIVE void initialize()
{
    charBuffer = (char *)malloc(sizeof(char) * 256);
    AlgebraTree *otherTree = makeTree();
    mainTree = createAlgebraTree();
    // TokenIndex outerMulGroupIndex = createTokenAndReturnIndex(TOKENTYPE_GROUP_MUL);
    // Token *outerMulGroup = tree->tokens[outerMulGroupIndex];
    TokenIndex leftAddGroupIndex = createTokenAndReturnIndex(mainTree, TOKENTYPE_GROUP_ADD);
    Token *leftAddGroup = &mainTree->tokens[leftAddGroupIndex];
    // Token *rightAddGroup = createTokenAsRightChild(TOKENTYPE_GROUP_ADD, outerMulGroup);

    Token *leftNum1 = createTokenAsLeftChild(mainTree, TOKENTYPE_PRIMITIVE_NUMBER, leftAddGroup);
    leftNum1->childLeft.numberValue = 1;
    Token *leftPro1 = createTokenAsRightChild(mainTree, TOKENTYPE_PRIMITIVE_PRONUMERAL, leftAddGroup);
    leftPro1->childLeft.pronumeralValue = 'x';

    // Token *rightNum1 = createTokenAsLeftChild(TOKENTYPE_PRIMITIVE_NUMBER, rightAddGroup);
    // rightNum1->childLeft.numberValue = 1;
    // Token *rightPro1 = createTokenAsRightChild(TOKENTYPE_PRIMITIVE_PRONUMERAL, rightAddGroup);
    // rightPro1->childLeft.pronumeralValue = 'x';

    applySubTree(mainTree, otherTree);

    char charBuffer[256];
    while (!processTree(mainTree))
    {
        getTokensTEX(mainTree, charBuffer);
        printf("%s\n", charBuffer);
    }
    getTokensTEX(mainTree, charBuffer);
    printf("%s\n", charBuffer);

    AlgebraTree *otherTree2 = makeTree();
    applySubTree(mainTree, otherTree2);
    while (!processTree(mainTree))
    {
        getTokensTEX(mainTree, charBuffer);
        printf("%s\n", charBuffer);
    }
    getTokensTEX(mainTree, charBuffer);
    printf("%s\n", charBuffer);

    AlgebraTree *otherTree3 = makeTree();
    applySubTree(mainTree, otherTree3);
    while (!processTree(mainTree))
    {
        getTokensTEX(mainTree, charBuffer);
        printf("%s\n", charBuffer);
    }
    getTokensTEX(mainTree, charBuffer);
    printf("%s\n", charBuffer);

    // TokenIndex multiplyResult = multiply(leftAddGroup, rightAddGroup);
    // if (multiplyResult)
    // {
    //   qsort(tokens + 1, tokensCount - 1, sizeof(Token), compareTokens);
    // }
    // printf("%s\n", charBuffer);
}

EXTERN EMSCRIPTEN_KEEPALIVE char *getTokenString()
{
    getTokensTEX(mainTree, charBuffer);
    return charBuffer;
}