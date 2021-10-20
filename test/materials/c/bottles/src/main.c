#include "verse_plural.h"
#include "verse_singular.h"
#include "verse_final.h"

int main() {
    for(int i = 99; i > 2; i--) {
        verse_plural(i);
    }
    verse_singular();
    verse_final();
    return 0;
}
