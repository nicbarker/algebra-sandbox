#include <stdio.h>
#include <stdbool.h>

typedef unsigned char u8;
typedef unsigned short u16;

// Constants ------------------------------
u16 NULL_TOKEN_ID = 65535;

// Definitions ----------------------------
typedef u16 TokenId; // NOTE: High bit of 16 is used for storage of various concepts

typedef enum
{
  TOKENTYPE_NONE,
  TOKENTYPE_PRIMITIVE_NUMBER,
  TOKENTYPE_PRIMITIVE_PRONUMERAL,
  TOKENTYPE_GROUP_ADD,
  TOKENTYPE_GROUP_MUL,
  TOKENTYPE_GROUP_DIV,
  TOKENTYPE_GROUP_POW,
  TOKENTYPE_GROUP_ROOT,
} TokenType;

typedef enum
{
  GROUPMEMBER_NONE,
  GROUPMEMBER_ADD,
  GROUPMEMBER_MUL,
  GROUPMEMBER_DIV_NUMERATOR,
  GROUPMEMBER_DIV_DENOMINATOR,
  GROUPMEMBER_POW_BASE,
  GROUPMEMBER_POW_EXPONENT
} GroupMemberType;

typedef struct
{
  // This is sparse-ish and a small waste of cache
  union PrimitiveValue
  {
    int numberValue;
    char pronumeral;
  } primitiveValue;
  TokenId tokenId;
  TokenId groupTokenId;
  GroupMemberType groupMemberType;
  TokenType tokenType;
  u8 childCount;
} Token;

typedef struct
{
  TokenId tokenIndex;
  int value;
} TokenPrimitiveNumberValue;

typedef struct
{
  TokenId tokenIndex;
  char numeral;
} TokenPrimitivePronumeralValue;

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

// Globals ------------------------------
Token *childTokenBuffer[256];
Token *childTokenBuffer2[256];

Token tokens[1000];
TokenId tokensCount = 0;
TokenId nextTokenId = 0;

PrintableToken printableTokens[1000];

static inline Token *createToken(TokenType tokenType)
{
  tokens[tokensCount++] = (Token){
      .tokenId = nextTokenId++,
      .tokenType = tokenType,
      .groupTokenId = NULL_TOKEN_ID,
      .groupMemberType = GROUPMEMBER_NONE,
      .childCount = 0};
  return &tokens[tokensCount - 1];
}

static inline Token *createTokenPrimitiveNumber(int numberValue)
{
  tokens[tokensCount++] = (Token){
      .tokenId = nextTokenId++,
      .tokenType = TOKENTYPE_PRIMITIVE_NUMBER,
      .groupTokenId = NULL_TOKEN_ID,
      .groupMemberType = GROUPMEMBER_NONE,
      .childCount = 0,
      .primitiveValue.numberValue = numberValue};
  return &tokens[tokensCount - 1];
}

static inline Token *createTokenPrimitivePronumeral(char pronumeral)
{
  tokens[tokensCount++] = (Token){
      .tokenId = nextTokenId++,
      .tokenType = TOKENTYPE_PRIMITIVE_PRONUMERAL,
      .groupTokenId = NULL_TOKEN_ID,
      .groupMemberType = GROUPMEMBER_NONE,
      .childCount = 0,
      .primitiveValue.pronumeral = pronumeral};
  return &tokens[tokensCount - 1];
}

void addTokenToGroup(Token *token, Token *groupToken, GroupMemberType groupMemberType)
{
  token->groupTokenId = groupToken->tokenId;
  token->groupMemberType = groupMemberType;
  groupToken->childCount++;
}

void removeTokenWithId(TokenId tokenId)
{
  for (int i = 0; i < tokensCount; i++)
  {
    if (tokens[i].tokenId == tokenId)
    {
      tokens[i] = tokens[--tokensCount];
    }
  }
}

// Returns count of tokens added to childTokenBuffer
u8 getChildTokens(TokenId groupId, Token **childTokenBuffer)
{
  u8 childTokenCount = 0;
  for (int i = 0; i < tokensCount; i++)
  {
    if (tokens[i].groupTokenId == groupId)
    {
      childTokenBuffer[childTokenCount++] = &tokens[i];
    }
  }
  return childTokenCount;
}

bool multiply(Token *token1, Token *token2);

// Multiply ------------------------------------------------------------

bool multiplyAddAdd(Token *token1, Token *token2)
{
  // Otherwise, create a new MUL group for each member of the ADD group, with the primitive and the old ADD member
  u8 oldChildCount1 = getChildTokens(token1->tokenId, childTokenBuffer);
  u8 oldChildCount2 = getChildTokens(token2->tokenId, childTokenBuffer2);

  token1->tokenId = nextTokenId++;
  token1->childCount = 0;
  for (int i = 0; i < oldChildCount1; i++)
  {
    for (int j = 0; j < oldChildCount2; j++)
    {
      Token *oldChildToken1 = childTokenBuffer[i];
      Token *oldChildToken2 = childTokenBuffer2[j];
      Token *newMulGroup = createToken(TOKENTYPE_GROUP_MUL);
      addTokenToGroup(newMulGroup, token1, GROUPMEMBER_ADD);
      addTokenToGroup(oldChildToken1, newMulGroup, GROUPMEMBER_MUL);
      addTokenToGroup(oldChildToken2, newMulGroup, GROUPMEMBER_MUL);
      // multiply(oldChildToken1, oldChildToken2);
    }
  }

  // Remove the old add group 2
  removeTokenWithId(token2->tokenId);
  return true;
}

bool multiplyAddPrimitive(Token *addGroupToken, Token *primitiveToken)
{
  bool isPrimitiveNumber = primitiveToken->tokenType == TOKENTYPE_PRIMITIVE_NUMBER;
  // Just ignore multiply by 1 - delete the token
  if (isPrimitiveNumber && primitiveToken->primitiveValue.numberValue == 1)
  {
    removeTokenWithId(primitiveToken->tokenId);
    addGroupToken->childCount--;
    return true;
  }

  // Otherwise, create a new MUL group for each member of the ADD group, with the primitive and the old ADD member
  u8 oldChildCount = getChildTokens(addGroupToken->tokenId, childTokenBuffer);

  addGroupToken->tokenId = nextTokenId++;
  addGroupToken->childCount = 0;
  for (int i = 0; i < oldChildCount; i++)
  {
    Token *oldChildToken = childTokenBuffer[i];
    Token *newMulGroup = createToken(TOKENTYPE_GROUP_MUL);
    addTokenToGroup(newMulGroup, addGroupToken, GROUPMEMBER_ADD);
    addTokenToGroup(oldChildToken, newMulGroup, GROUPMEMBER_MUL);

    // Clone the primitive for each mul group
    Token *primitive;
    if (isPrimitiveNumber)
    {
      primitive = createTokenPrimitiveNumber(primitiveToken->primitiveValue.numberValue);
    }
    else
    {
      primitive = createTokenPrimitivePronumeral(primitiveToken->primitiveValue.pronumeral);
    }
    addTokenToGroup(primitive, newMulGroup, GROUPMEMBER_MUL);
    multiply(primitive, oldChildToken);
  }

  // Remove the old primitive
  removeTokenWithId(primitiveToken->tokenId);
  return true;
}

bool multiplyPrimitivePrimitive(Token *token1, Token *token2)
{
  if (token1->tokenType == TOKENTYPE_PRIMITIVE_NUMBER && token2->tokenType == TOKENTYPE_PRIMITIVE_NUMBER)
  {
    token1->primitiveValue.numberValue *= token2->primitiveValue.numberValue;
    removeTokenWithId(token2->tokenId);
    return true;
  }
  if (token1->tokenType == TOKENTYPE_PRIMITIVE_NUMBER && token1->primitiveValue.numberValue == 1 && token2->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL)
  {
    removeTokenWithId(token1->tokenId);
    return true;
  }
  if (token2->tokenType == TOKENTYPE_PRIMITIVE_NUMBER && token2->primitiveValue.numberValue == 1 && token1->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL)
  {
    removeTokenWithId(token2->tokenId);
    return true;
  }
  return false;
  // else if (token1->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL && token2->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL && token1.numeral == token2.numeral) {
  //   return {
  //     type: TOKENTYPE_GROUP_POW,
  //     base: { type: TOKENTYPE_GROUP_ADD, id: nextTokenId++, tokens: [token1] },
  //     exponent: { type: TOKENTYPE_GROUP_ADD, id: nextTokenId++, tokens: [{ type: TOKENTYPE_PRIMITIVE_NUMBER, id: nextTokenId++, value: 2 }] }
  //   }
  // } else {
  //   const number = (token1->tokenType == TOKENTYPE_PRIMITIVE_NUMBER ? token1 : token2) as TokenPrimitiveNumber;
  //   const numeral = (token1->tokenType == TOKENTYPE_PRIMITIVE_PRONUMERAL ? token1 : token2) as TokenPrimitivePronumeral;
  //   if (number.value == 1) {
  //     return numeral;
  //   }
  // }
}

bool multiply(Token *token1, Token *token2)
{
  switch (token1->tokenType)
  {
  case TOKENTYPE_GROUP_ADD:
  {
    switch (token2->tokenType)
    {
    case TOKENTYPE_GROUP_ADD:
    { // ADD * ADD ------------------
      return multiplyAddAdd(token1, token2);
    }
    case TOKENTYPE_GROUP_MUL:
    { // ADD * MUL ------------------
      // return multiplyAddMul(token1, token2);
    }
    case TOKENTYPE_GROUP_POW:
    { // POW * ADD ------------------
      // return multiplyPowAdd(token2, token1);
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    case TOKENTYPE_PRIMITIVE_NUMBER:
    { // ADD * PRIMITIVE -----
      return multiplyAddPrimitive(token1, token2);
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
      // return multiplyAddMul(token2, token1);
    }
    case TOKENTYPE_GROUP_DIV:
    { // MUL * DIV ------------------
      // return multiplyMulDiv(token1, token2);
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    case TOKENTYPE_PRIMITIVE_NUMBER:
    { // MUL * PRIMITIVE -----
      // return multiplyMulPrimitive(token1, token2);
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
      // return multiplyMulDiv(token2, token1);
    }
    case TOKENTYPE_GROUP_DIV:
    { // DIV * DIV ------------------
      // return multiplyDivDiv(token1, token2);
    }
    case TOKENTYPE_GROUP_POW:
    { // POW * DIV ------------------
      // return multiplyPowDiv(token2, token1);
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    case TOKENTYPE_PRIMITIVE_NUMBER:
    { // DIV * PRIMITIVE -
      // return multiplyDivPrimitive(token1, token2);
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
      // return multiplyPowAdd(token1, token2);
    }
    case TOKENTYPE_GROUP_DIV:
    { // POW * DIV ------------------
      // return multiplyPowDiv(token1, token2);
    }
    case TOKENTYPE_GROUP_POW:
    { // POW * DIV ------------------
      // return multiplyPowPow(token1, token2);
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    case TOKENTYPE_PRIMITIVE_NUMBER:
    { // POW * PRIMITIVE -
      // return multiplyPowPrimitive(token1, token2);
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
      return multiplyAddPrimitive(token2, token1);
    }
    case TOKENTYPE_GROUP_MUL:
    { // PRIMITIVE * MUL ------------
      // return multiplyMulPrimitive(token2, token1);
    }
    case TOKENTYPE_GROUP_DIV:
    { // DIV * PRIMITIVE ------------
      // return multiplyDivPrimitive(token2, token1);
    }
    case TOKENTYPE_GROUP_POW:
    { // POW * PRIMITIVE ------------
      // return multiplyPowPrimitive(token2, token1)
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    case TOKENTYPE_PRIMITIVE_NUMBER:
    { // PRIMITIVE * PRIMITIVE -
      return multiplyPrimitivePrimitive(token1, token2);
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
      // return multiplyMulPrimitive(token2, token1);
    }
    case TOKENTYPE_GROUP_DIV:
    { // DIV * DIV ------------------
      // return multiplyDivPrimitive(token2, token1);
    }
    case TOKENTYPE_GROUP_POW:
    { // POW * PRIMITIVE -
      // return multiplyPowPrimitive(token2, token1);
    }
    case TOKENTYPE_PRIMITIVE_PRONUMERAL:
    case TOKENTYPE_PRIMITIVE_NUMBER:
    { // PRIMITIVE * PRIMITIVE -
      return multiplyPrimitivePrimitive(token1, token2);
    }
    }
  }
  }
  return false;
}

int compareTokens(const void *a, const void *b)
{
  Token *token_a = (Token *)a;
  Token *token_b = (Token *)b;

  if (token_a->groupTokenId == token_b->groupTokenId)
    return token_a->tokenId - token_b->tokenId;
  else if (token_a->groupTokenId < token_b->groupTokenId)
    return -1;
  else
    return 1;
}

void printTokensTEX()
{
  printableTokens[0] = (PrintableToken){
      .printableType = PRINTABLETYPE_EVALUATE,
      .printableValue.token = &tokens[0]};

  int i = 1;
  while (i > -1)
  {
    i--;
    PrintableToken *printable = &printableTokens[i];
    if (printable->printableType == PRINTABLETYPE_CHAR)
    {
      printf("%c", printable->printableValue.printableChar);
    }
    else if (printable->printableType == PRINTABLETYPE_INT)
    {
      printf("%d", printable->printableValue.printableInt);
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
        char operator= isAdd ? '+' : '*';
        u8 childTokensCount = getChildTokens(token->tokenId, childTokenBuffer);
        if (isAdd /* && childTokensCount > 1*/)
        {
          printableTokens[i++] = (PrintableToken){
              .printableType = PRINTABLETYPE_CHAR,
              .printableValue.printableChar = ')'};
        }
        else
        {
          printableTokens[i++] = (PrintableToken){
              .printableType = PRINTABLETYPE_CHAR,
              .printableValue.printableChar = ']'};
        }
        // Clip off the last operator
        if (childTokensCount > 0)
        {
          printableTokens[i++] = (PrintableToken){
              .printableType = PRINTABLETYPE_EVALUATE,
              .printableValue.token = childTokenBuffer[childTokensCount - 1]};
          for (int j = childTokensCount - 2; j > -1; j--)
          {
            printableTokens[i++] = (PrintableToken){
                .printableType = PRINTABLETYPE_CHAR,
                .printableValue.printableChar = operator};
            printableTokens[i++] = (PrintableToken){
                .printableType = PRINTABLETYPE_EVALUATE,
                .printableValue.token = childTokenBuffer[j]};
          }
        }
        if (isAdd /* && childTokensCount > 1*/)
        {
          printableTokens[i++] = (PrintableToken){
              .printableType = PRINTABLETYPE_CHAR,
              .printableValue.printableChar = '('};
        }
        else
        {
          printableTokens[i++] = (PrintableToken){
              .printableType = PRINTABLETYPE_CHAR,
              .printableValue.printableChar = '['};
        }
        break;
      }
      case TOKENTYPE_PRIMITIVE_NUMBER:
      {
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_INT,
            .printableValue.printableInt = token->primitiveValue.numberValue};
        break;
      }
      case TOKENTYPE_PRIMITIVE_PRONUMERAL:
      {
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_CHAR,
            .printableValue.printableChar = token->primitiveValue.pronumeral};
        break;
      }
      }
    }
  }
  printf("\n");
}

int main()
{
  Token *outerAddGroup = createToken(TOKENTYPE_GROUP_ADD);
  Token *outerMulGroup = createToken(TOKENTYPE_GROUP_MUL);
  addTokenToGroup(outerMulGroup, outerAddGroup, GROUPMEMBER_ADD);
  Token *addGroup1 = createToken(TOKENTYPE_GROUP_ADD);
  addTokenToGroup(addGroup1, outerMulGroup, GROUPMEMBER_MUL);
  addTokenToGroup(createTokenPrimitiveNumber(1), addGroup1, GROUPMEMBER_ADD);
  addTokenToGroup(createTokenPrimitivePronumeral('x'), addGroup1, GROUPMEMBER_ADD);
  Token *addGroup2 = createToken(TOKENTYPE_GROUP_ADD);
  addTokenToGroup(addGroup2, outerMulGroup, GROUPMEMBER_MUL);
  addTokenToGroup(createTokenPrimitiveNumber(1), addGroup2, GROUPMEMBER_ADD);
  addTokenToGroup(createTokenPrimitivePronumeral('x'), addGroup2, GROUPMEMBER_ADD);

  printTokensTEX();
  TokenId multiplyResult = multiply(addGroup1, addGroup2);
  if (multiplyResult)
  {
    qsort(tokens + 1, tokensCount - 1, sizeof(Token), compareTokens);
  }
  printTokensTEX();
}
