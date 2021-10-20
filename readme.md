# Zebes

Zebes: The least of all build systems.

**NOTE: THIS PROJECT IS CURRENTLY UNDER CONSTRUCTION!**

Zebes is a general-purpose build tool intended to be used for compiling and linking software projects. It is designed to be pragmatic, simple in concept, and easy to learn and use.

If your software build process is very complicated or unconventional, then Zebes might not be the right tool for you. You might be able to contort Zebes into working for you, anyway, but you aren't the kind of user who this tool is primarily intended for.

**If what you want is a build tool that "just works" for common and conventional cases without hassle, without needing to learn a new and complicated configuration language, then Zebes just might be for you.**

## Installation

Zebes is implemented in TypeScript and is registered as an NPM package. You must have NodeJS and NPM available on your system in order to use Zebes.

Here is the recommended installation process:

```
npm install -g [TODO]
```

Zebes can also be installed like so:

```
git clone [TODO]
cd zebes-js
npm install
npm run build
npm TODO
```

## Basic Usage

Zebes operates based on project configuration files. You should use `zebes init` in the root directory of your software project to initialize a configuration file. You will need to specify a language template and a configuration format. For example, `zebes init cpp toml` will create a configuration file named `zebes.toml` in the current directory containing the skeleton of a C++ project configuration. After running `zebes init`, you will be able to use `zebes` commands to manage your project from anywhere in that directory tree.

The most important part of a Zebes project configuration file is the targets that are defined within it. Each target is assigned a name. You can execute a target in the current project using `zebes run [target-name]`. For a small selection of targets, you can omit the `run` portion of the command. For example, `zebes build` runs the "build" target, `zebes test` runs the "test" target, and `zebes clean` runs the "clean" target.
