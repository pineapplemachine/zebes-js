import std.stdio;

import numbers : Numbers;
import twice : twice;
import negate : negate;
import square : square;

int main() {
    foreach(number; Numbers) {
        writeln("Negate ", number, ": ", negate(number));
        writeln("Twice  ", number, ": ", twice(number));
        writeln("Square ", number, ": ", square(number));
    }
    return 0;
}
