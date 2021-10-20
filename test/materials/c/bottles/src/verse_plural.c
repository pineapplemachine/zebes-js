#include <stdio.h>

void verse_plural(int bottles) {
    printf("%i bottles of beer on the wall, %i bottles of beer.\n", bottles, bottles);
    printf("Take one down and pass it around, %i bottles of beer on the wall.\n", bottles - 1);
}
