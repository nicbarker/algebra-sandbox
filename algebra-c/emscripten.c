#include <emscripten/emscripten.h>
#include "algebra.c"

#define EXTERN

EXTERN EMSCRIPTEN_KEEPALIVE void
emscriptenEntrypoint()
{
    printf("debug");
}