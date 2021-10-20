# Zebes

Zebes: The least of all build systems.

**NOTE: THIS PROJECT IS CURRENTLY UNDER CONSTRUCTION!**

Zebes is a general-purpose build tool intended to be used for compiling and linking software projects. It is designed to be pragmatic, simple in concept, and easy to learn and use.

If your software build process is very complicated or unconventional, then Zebes might not be the right tool for you. You might be able to coax Zebes into working for you, anyway, but be aware that yours isn't the kind of use case that this tool is primarily intended for.

If what you want is a build tool that **"just works"** for common and conventional cases without hassle, without needing to learn a new and complicated configuration language, then Zebes just might be for you.

## Installation

Zebes is implemented in TypeScript and is registered as an NPM package. You must have [NodeJS](https://nodejs.org/en/) and [NPM](https://www.npmjs.com/) available on your system in order to use Zebes.

Here is the recommended installation process:

```
npm install -g zebes
```

Zebes can alternatively be installed directly from its git repository:

```
# Clone the git repository
git clone https://github.com/pineapplemachine/zebes-js.git
# Enter the newly created directory
cd zebes-js
# Install dependencies via NPM
npm install
# Build Zebes from TypeScript sources
npm run build
# Add "zebes" as a globally available command
npm install -g .
```

## Basic Usage

```
# Create a project configuration file from a template
zebes init c toml
# Run the project's "build" target
zebes build
```

### Getting started

Zebes relies on project config files. You can use `zebes init` in the root directory of your software project to initialize a config file from a template. This requires that you specify a language template and a config format.

For example, `zebes init cpp toml` will create a config file named `zebes.toml` in the current directory containing the skeleton of a C++ project config. Once there is a Zebes config file in your project's root directory, you will be able to use `zebes` commands like `zebes build` or `zebes test` to manage your project from anywhere in that project's directory tree.

Out-of-the-box Zebes project templates are available via `zebes init c`, `zebes init cpp`, and `zebes init d`.

Note that for anything but the barest projects, **you will very likely need to open the generated config file and modify it.** You'll likely need to provide additional details like include paths, library paths, and what libraries to link with.

The config templates ought to be mostly self-explanatory. However, here you can find complete documentation on the Zebes project configuration file format: (TODO)

The most important part of a Zebes project configuration file is the targets that are defined within it.


Each target is assigned a name. You can execute a target in the current project using `zebes run [target-name]`. For a small selection of targets, you can omit the `run` portion of the command. For example, `zebes build` runs the "build" target, `zebes test` runs the "test" target, and `zebes clean` runs the "clean" target.
