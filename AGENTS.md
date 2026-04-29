# Repository Guidelines

## Project Structure & Module Organization

This repository is a TypeScript CLI package that generates API code from Swagger/OpenAPI documents. Source files live in `src/`: `src/index.ts` exposes the main API, `src/cli/` contains command-line entry points, `src/core/` contains parsing and code generation logic, `src/types/` defines shared types, and `src/utils/` holds reusable helpers. Tests live in `__tests__/` and use helpers from `__tests__/helpers.ts`. Build output is emitted to `dist/`; do not edit generated files there. `swagger_temp.json` is sample/input data for local generation work.

## Build, Test, and Development Commands

Use the package manager declared in `package.json` (`pnpm@10.11.0`) when possible.

- `pnpm test`: run the Jest test suite.
- `pnpm test:watch`: run Jest in watch mode during development.
- `pnpm test:coverage`: generate coverage under `coverage/`.
- `pnpm build`: clean and compile TypeScript into `dist/`.
- `pnpm dev`: build, then run the compiled CLI.
- `pnpm generate`, `pnpm init`, `pnpm validate`: build, then run the matching CLI command.
- `pnpm lint`: format the repository with Prettier.

## Coding Style & Naming Conventions

Write strict TypeScript targeting ES2020 and CommonJS. Keep modules focused and prefer existing helper functions in `src/utils/` before adding new logic. Use two-space indentation, single quotes, semicolons, and Prettier-compatible formatting. Classes and types use `PascalCase`; functions, methods, variables, and files use `camelCase` or existing local patterns. Add JSDoc comments for all functions and methods, including private helpers.

## Testing Guidelines

Jest with `ts-jest` runs all `*.test.ts` and `*.spec.ts` files under `__tests__/`. Name tests after the behavior or module being covered, for example `parser.test.ts` or `addMethodSuffix.test.ts`. Add or update tests when changing parser, generator, config, or utility behavior. Run `pnpm test` before submitting changes; use `pnpm test:coverage` for broader changes.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, often with scopes: `fix(utils): ...`, `fix(parser): ...`, `refactor(config): ...`, and `feat: ...`. Keep commit messages imperative and specific. Pull requests should include a short problem statement, implementation summary, relevant command output, and linked issues when applicable. For CLI behavior changes, include before/after examples or generated output snippets.

## Agent-Specific Instructions

Keep changes minimal and targeted. Do not add test files unless explicitly requested or the change meaningfully alters behavior. Preserve user edits in the working tree, avoid unrelated refactors, and keep generated artifacts out of commits unless they are intentionally part of the change.
