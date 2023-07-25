#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include "tokens.c"
#include "multiply.c"

void _getTokensTEXDebug(char *charBuffer)
{
  u8 charBufferCount = 0;
  printableTokens[0] = (PrintableToken){
      .printableType = PRINTABLETYPE_EVALUATE,
      .printableValue.token = &tokens[0]};

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
        bool isNestedAdd = tokens[token->childLeft.tokenIndex].tokenType == TOKENTYPE_GROUP_ADD || tokens[token->childRight].tokenType == TOKENTYPE_GROUP_ADD;
        char operator= isAdd ? '+' : '*';
        if (isAdd)
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
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_EVALUATE,
            .printableValue.token = &tokens[token->childRight]};
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_CHAR,
            .printableValue.printableChar = operator};
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_EVALUATE,
            .printableValue.token = &tokens[token->childLeft.tokenIndex]};
        if (isAdd)
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
      case TOKENTYPE_GROUP_POW:
      {
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_CHAR,
            .printableValue.printableChar = '}'};
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_EVALUATE,
            .printableValue.token = &tokens[token->childRight]};
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_CHAR,
            .printableValue.printableChar = '{'};
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_CHAR,
            .printableValue.printableChar = '^'};
        printableTokens[i++] = (PrintableToken){
            .printableType = PRINTABLETYPE_EVALUATE,
            .printableValue.token = &tokens[token->childLeft.tokenIndex]};
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