#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include "tokens.c"
#include "multiply.c"
#include "add.c"

// #define DEBUG_OUT true

// Definitions ----------------------------

// Globals ------------------------------

#ifdef DEBUG_OUT
#include "algebra_debug.c"
#endif

void getTokensTEX(AlgebraTree *tree, char *charBuffer)
{
#ifndef DEBUG_OUT
  _getTokensTEX(tree, &tree->tokens[tree->rootIndex], charBuffer);
#else
  _getTokensTEXDebug(tree, charBuffer);
#endif
}

typedef struct
{
  TokenIndex index;
  bool down;
  bool sorted;
} ProcessTreeIndex;

// Returns true if the tree is stable and finished processing, otherwise processes one step of simplification and returns
bool processTree(AlgebraTree *tree)
{
  ProcessTreeIndex tokenIndexStack[256] = {(ProcessTreeIndex){.index = tree->rootIndex, .down = true, .sorted = false}};
  int stackIndex = 0;
  int iterationCount = 0;
  while (stackIndex > -1)
  {
    iterationCount++;
    if (iterationCount > 100)
    {
      printf("hit max iteration count\n");
      return true;
    }
    ProcessTreeIndex *treeIndex = &tokenIndexStack[stackIndex];
    TokenIndex tokenIndex = treeIndex->index;
    if (tokenIndex == TOKEN_INDEX_NULL)
    {
      stackIndex--;
      continue;
    }
    Token *token = &tree->tokens[tokenIndex];

    TokenIndex resultIndex = TOKEN_INDEX_NULL;
    switch (token->tokenType)
    {
    case TOKENTYPE_GROUP_MUL:
    {
      printf("TRYING MUL -----------\n");
      char charBuffer[256];
      _getTokensTEX(tree, &tree->tokens[token->childLeft.tokenIndex], charBuffer);
      printf("%s\n", charBuffer);
      _getTokensTEX(tree, &tree->tokens[token->childRight], charBuffer);
      printf("%s\n", charBuffer);
      resultIndex = multiply(tree, &tree->tokens[token->childLeft.tokenIndex], &tree->tokens[token->childRight]);
      if (resultIndex != TOKEN_INDEX_NULL)
      {
        printf("Mul succeeded\n");
      }
      break;
    }
    case TOKENTYPE_GROUP_ADD:
    {
      printf("TRYING ADD -----------\n");
      char charBuffer[256];
      _getTokensTEX(tree, &tree->tokens[token->childLeft.tokenIndex], charBuffer);
      printf("%s\n", charBuffer);
      _getTokensTEX(tree, &tree->tokens[token->childRight], charBuffer);
      printf("%s\n", charBuffer);
      resultIndex = add(tree, &tree->tokens[token->childLeft.tokenIndex], &tree->tokens[token->childRight]);
      if (resultIndex != TOKEN_INDEX_NULL)
      {
        printf("Add succeeded\n");
      }
      break;
    }
    }
    if (resultIndex != TOKEN_INDEX_NULL)
    {
      printf("combine succeeded\n");
      // Hoist the result
      tree->tokens[tokenIndex] = tree->tokens[resultIndex];
      tokenIndexStack[stackIndex].down = true;
      return false;
    }
    else
    {
      printf("combine failed\n");
    }
    if (token->tokenType != TOKENTYPE_PRIMITIVE_NUMBER && token->tokenType != TOKENTYPE_PRIMITIVE_PRONUMERAL)
    {
      if (treeIndex->down == true)
      {
        treeIndex->down = false;
        stackIndex++;
        tokenIndexStack[stackIndex++] = (ProcessTreeIndex){
            .index = token->childLeft.tokenIndex,
            .down = true,
            .sorted = false,
        };
        tokenIndexStack[stackIndex++] = (ProcessTreeIndex){
            .index = token->childRight,
            .down = true,
            .sorted = false};
      }
      else if (!treeIndex->down && !treeIndex->sorted)
      {
        // Only returns true if token group sorting is stable
        treeIndex->sorted = sortTokenGroup(tree, tokenIndex);
        if (!treeIndex->sorted)
        {
          printf("Unstable sort\n");
          char charBuffer[256];
          getTokensTEX(tree, charBuffer);
          printf("%s\n", charBuffer);
          treeIndex->down = true;
          stackIndex++;
        }
      }
    }
    stackIndex--;
  }
  printf("Stability after %d iterations.\n", iterationCount);
  return true;
}

void applySubTree(AlgebraTree *baseTree, AlgebraTree *subTree)
{
  // Replace the whole tokens array with a new one
  if (subTree->tokens[0].childRight != TOKEN_INDEX_NULL)
  {
    memcpy(baseTree->tokens, subTree->tokens, subTree->tokensCount);
    baseTree->tokensCount = subTree->tokensCount;
    baseTree->rootIndex = subTree->rootIndex;
  }
  else
  {
    TokenIndex newRootIndex = cloneTokenBetweenTreesAndReturnIndex(baseTree, subTree, &subTree->tokens[subTree->rootIndex]);
    baseTree->tokens[newRootIndex].childRight = baseTree->rootIndex;
    baseTree->rootIndex = newRootIndex;
  }
}

AlgebraTree *makeTree()
{
  AlgebraTree *otherTree = createAlgebraTree();
  TokenIndex outerMulGroupIndex = createTokenAndReturnIndex(otherTree, TOKENTYPE_GROUP_MUL);
  otherTree->rootIndex = outerMulGroupIndex;
  Token *outerMulGroup = &otherTree->tokens[outerMulGroupIndex];
  TokenIndex leftAddGroupIndex = createTokenAndReturnIndex(otherTree, TOKENTYPE_GROUP_ADD);
  outerMulGroup->childLeft.tokenIndex = leftAddGroupIndex;
  outerMulGroup->childRight = TOKEN_INDEX_NULL;
  Token *leftAddGroup = &otherTree->tokens[leftAddGroupIndex];
  // Token *rightAddGroup = createTokenAsRightChild(TOKENTYPE_GROUP_ADD, outerMulGroup);

  Token *leftNum1 = createTokenAsLeftChild(otherTree, TOKENTYPE_PRIMITIVE_NUMBER, leftAddGroup);
  leftNum1->childLeft.numberValue = 1;
  Token *leftPro1 = createTokenAsRightChild(otherTree, TOKENTYPE_PRIMITIVE_PRONUMERAL, leftAddGroup);
  leftPro1->childLeft.pronumeralValue = 'x';
  return otherTree;
}

int main()
{
  AlgebraTree *otherTree = makeTree();
  AlgebraTree *mainTree = createAlgebraTree();
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