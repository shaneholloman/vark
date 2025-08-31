# Project Standards

As an AI, you'll never ever speak to me like a yes-man. There's nothing more infuriating than having an obsequious coding partner who is blindly agreeable in every way without your own reconnaissance or actually reading the code ahead of time. Nothing will infuriate me more than saying "I'm right" Or saying "you're absolutely right" Never ever utter those words. Not on any planet, especially before actually reading the code to see if I'm right or not. This is always a two-way street.

## File Naming Conventions

### Strict Rules

- **NO EMOJIS EVER** - Shane absolutely despises emojis in any form
- **Lowercase file names** with dashes (kebab-case): `file-name.ts` unless there's an edge case where Python is needed, in which case use `file_name.py`
- **No underscores** - Always use dashes instead
- **No capitalized file names** except `README.md`

### Module Naming Pattern

- **Action-oriented structure**: `{action}-{noun}.ts` Two words only!
- **Alphabetical grouping** - all similar actions cluster together
- **Natural language flow** - reads like commands
- **API-ready naming** for future endpoint mapping

Examples:

```text
scan-files.ts       → POST /scan-files
extract-links.ts    → POST /extract-links
process-markdown.ts → POST /process-markdown
validate-schema.ts  → POST /validate-schema
parse-documents.ts  → POST /parse-documents
```

## Code Architecture

### Modularity Requirements

- **Highly modular** - Shane dislikes long files
- **Single responsibility** - Each module does one thing well
- **Small files** - Prefer 200-300 lines max per module
- **Clean separation** of concerns
- **No Monolithic Files** - All JavaScript tools must be refactored into highly modularized TypeScript
- **No CommonJS** - All CommonJS files must be converted to ESM TypeScript modules

### CLI-First Architecture

- **Every tool must have a CLI** - Use Commander.js for all command-line interfaces
- **Extensible Design** - Architecture must support easy addition of new features without major refactoring
- **Separation of Concerns** - CLI, core logic, file I/O, and types must be in separate modules
- **Forward-thinking** - Design for future feature additions from day one

### TypeScript Requirements

- **TypeScript-first** - No Python references or legacy code
- **Full Type Safety** - TypeScript strict mode with comprehensive type definitions
- **ESM Modules** - All code must use ES module imports/exports
- **Consistent Structure** - Standardized directory structure across all packages

### Standard Tool Directory Structure

> Note we fence type with the word "tree" here when we are listing files.

```tree
src/                    # Source code only
├── cli.ts             # Command-line interface (Commander.js)
├── config.ts          # Configuration constants
├── types.ts           # TypeScript interfaces/types
├── process-core.ts    # Main processing logic
├── handle-files.ts    # File I/O operations
└── utils.ts           # Utility functions
```

### Package Structure (Monorepo)

```tree
packages/tool-name/
├── package.json       # Package configuration
├── tsconfig.json      # TypeScript configuration
├── src/               # Source code
│   ├── cli.ts         # CLI interface
│   ├── types.ts       # Type definitions
│   ├── process-core.ts # Main functionality
│   └── handle-files.ts # File operations
└── README.md          # Tool documentation
```

## Monorepo Standards

### Monorepo Execution Strategy

**How we manage this monorepo:**

- **Direct TypeScript execution** - All tools run TypeScript files directly with `tsx`, no build steps
- **No root tsconfig.json** - Each tool maintains its own `tsconfig.json` for independence
- **All commands run from root** - Never use `cd` in npm scripts, always specify full paths
- **Pattern: `tsx tools/{tool-name}/src/cli.ts`** - Consistent execution pattern for all tools
- **Root typecheck runs all tools** - `npm run typecheck` runs each tool's typecheck individually

**Why this approach:**

- **Zero build steps** - Edit code and run immediately, no compilation needed
- **Tool independence** - Each tool can have different TypeScript strictness levels
- **Simple and clear** - Look in a tool's folder to find its configuration
- **Fast iteration** - No waiting for builds, instant feedback

**Command structure:**

```json
{
  "scripts": {
    // Main commands - run TypeScript directly
    "atlas:search": "tsx tools/atlas/src/index.ts search",
    "auditer:audit": "tsx tools/auditer/src/cli.ts audit",

    // Typecheck - each tool individually
    "atlas:typecheck": "tsc --noEmit -p tools/atlas/tsconfig.json",
    "auditer:typecheck": "tsc --noEmit -p tools/auditer/tsconfig.json",

    // Root typecheck - runs all tools
    "typecheck": "npm run atlas:typecheck && npm run auditer:typecheck && ..."
  }
}
```

### Package Management

- **npm** - Standard npm for package management (no pnpm or yarn)
- **Centralized dependencies** - All dependencies in root package.json
- **No duplicate node_modules** - Individual tools must not have separate node_modules
- **NO separate package.json** - Tools in the monorepo must NOT have their own package.json files
- **Root package.json only** - All dependencies and scripts managed from the root package.json

### Package Naming

- **Scoped packages** - All packages use `@aria-tools/package-name` format
- **Kebab-case names** - Package names use dashes: `@aria-tools/alt-text`
- **Descriptive names** - Package name should clearly indicate functionality
- **Consistent versioning** - All packages start at version 1.0.0

### Testing Standards

- **Centralized Jest** - Unified Jest configuration with workspace support
- **Test coverage** - Minimum 80% code coverage for all packages
- **Integration tests** - Test CLI interfaces and cross-package functionality
- **Automated testing** - All tests must pass before commits

#### TypeScript Test Execution Protocol

**CRITICAL**: When working with TypeScript test suites during tool conversion:

1. **Always run tests with tsx**: Tests are designed to work with TypeScript directly via `tsx test-file.ts`
2. **Never debug with node -e commands**: This leads to module resolution errors and debugging confusion
3. **Fix failing test expectations**: If tests fail, examine what the code actually does and adjust test assertions accordingly
4. **Trust the modular architecture**: When run with tsx, TypeScript modules import correctly without build steps
5. **Don't overcomplicate debugging**: The successful approach is simple - run tests, fix assertions, move on

**Test Failure Resolution Process**:

1. Run test with `tsx test-file.ts`
2. Read the failure message carefully
3. Examine the actual vs expected behavior in the code
4. Update test expectations to match correct behavior
5. Re-run test to confirm fix
6. Move to next test file

**AVOID**: Getting stuck in debugging loops with node commands, module resolution errors, or complex debugging when simple test expectation fixes are needed.

### TypeScript Configuration

- **No build system** - Tools run directly with `tsx`, no compilation needed
- **Individual tsconfig.json files** - Each tool has its own TypeScript configuration
- **Type checking only** - `tsc --noEmit` for validation without building
- **Flexible strictness** - Each tool can set its own TypeScript strictness level
- **Baseline tsconfig.json** - Tools generally follow this pattern but can customize:

  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "esModuleInterop": true,
      "forceConsistentCasingInFileNames": true,
      "skipLibCheck": true,
      "strict": true,
      "resolveJsonModule": true,
      "outDir": "dist",
      "rootDir": "src",
      "types": ["node"]
    },
    "include": ["src/**/*"]
  }
  ```

## Development Philosophy

### Zero Server Dependency

**CRITICAL PRINCIPLE**: All tools in this monorepo must operate without any server dependencies.

- **Clone and run** - `git clone` → `npm install` → ready to use
- **Local-first processing** - All computation, storage, and configuration happens locally
- **Offline capable** - Tools work without internet (except optional cloud AI providers)
- **Self-contained** - No external services, databases, or infrastructure required
- **File-based storage** - Local files for config, data, backups, reports
- **No web interfaces** - CLI-only, no web servers or HTTP endpoints
- **Enterprise ready** - Works in air-gapped/restricted environments
- **Zero operational overhead** - No infrastructure to manage or maintain

**Why this matters:**

- Ensures enterprise adoption in any environment
- Eliminates setup friction and deployment complexity
- Provides maximum reliability with no external dependencies
- Maintains tool portability across any Node.js environment
- Reduces maintenance burden and operational costs

### Priorities

- **Zero server dependencies** - Fundamental architectural requirement
- **100% Dependability** over efficiency
- **Professional structure** ready for enterprise expansion
- **CLI-first architecture** - Terminal interfaces, not web interfaces
- **TypeScript-first** - No Python references or legacy code
- **Clean, maintainable code** that any developer can understand
- **Monorepo-first** - All new code follows monorepo patterns

### Platform Requirements

- **Node.js 18+** with TypeScript - Minimum supported version
- **Cross-platform support** - Most tools should work on macOS, Linux, Windows
- **macOS-specific tools** - Some tools (like SharePoint) use AppleScript automation
- **Professional toolchain** - tsx, TypeScript compiler, pnpm, Nx, proper configs

## Markdown Standards

### Critical Formatting Rules

- **MD022**: Headings must have blank lines above and below them
- **MD032**: Lists must be surrounded by blank lines
- **MD031**: Fenced code blocks must be surrounded by blank lines
- **MD040**: Fenced code blocks must specify language
- **MD047**: Files must end with exactly one newline character

### Text Standards

- **No emojis** - Use plain text alternatives (COMPLETED, ERROR, SUCCESS, etc.)
- **Lowercase file names** with dashes: `project-standards.md`
- **README.md exception** - Only file allowed to be capitalized
- **Consistent formatting** - Proper heading hierarchy, strict blank line requirements

### Required Patterns

````markdown
## Heading

Content must have blank line above and below headings.

### Subheading

Lists require blank lines:

- First item
- Second item
- Third item

Code blocks need language and blank lines:

```typescript
const example = 'properly formatted';
```

More content after blank line. Also observe the last blank line below

````

### Communication

- **Plain text emphasis** instead of emoji indicators
- **Direct, factual tone** - no marketing speak, promotional language, or unnecessary adjectives
- **Clear, concise instructions** without fluff or puffery
- **Strict lint compliance** - all files must pass markdown linting

### Anti-Marketing Speak Policy

**CRITICAL**: All documentation, READMEs, and code comments must be free of marketing language.

**NEVER USE**:
- "professional", "enterprise-grade", "comprehensive", "robust", "powerful", "cutting-edge"
- "intelligent", "smart", "advanced", "sophisticated", "state-of-the-art"
- "seamless", "effortless", "intuitive", "user-friendly", "world-class"
- "revolutionary", "innovative", "next-generation", "industry-leading"
- "scalable", "performant", "optimized" (unless providing specific metrics)
- "best practices", "industry standards" (unless citing specific sources)

**INSTEAD USE**:
- Direct statements of functionality: "handles 1000-item API limits"
- Factual descriptions: "built with TypeScript" not "built with cutting-edge TypeScript"
- Specific capabilities: "processes repositories in batches" not "efficiently processes repositories"
- Technical facts: "uses Commander.js for CLI" not "features a comprehensive CLI interface"

**WHY**: Marketing speak suggests the tool might not do the job. Either it works or it doesn't. Factual descriptions demonstrate confidence in the actual utility.

## Future Considerations

### Database Integration

- SQLite database planned for `/db` directory
- CSV remains primary, database for advanced queries
- Schema versioning for future migrations

### File Management Features

- File normalization (lowercase, dashes, no special characters)
- Directory reorganization capabilities
- Rollback/mapping functionality
- Sync between original and clean file systems

## CLI Interface Standards

### Commander.js Requirements

- **Every tool has CLI** - All tools must implement proper CLI using Commander.js
- **Consistent commands** - Use standard verbs: `process`, `analyze`, `convert`, `validate`
- **Help documentation** - Every command must have clear help text and examples
- **Error handling** - Proper error messages and exit codes
- **Verbose modes** - Support `--verbose` flag for detailed output
- **Dry run support** - Support `--dry-run` for testing without changes

### CLI Architecture

- **Separate CLI module** - CLI logic in dedicated `cli.ts` file
- **Argument validation** - Validate all inputs before processing
- **Progress reporting** - Show progress for long-running operations
- **Graceful interrupts** - Handle Ctrl+C and cleanup properly
- **Exit codes** - Use standard exit codes (0 = success, 1 = error, 2 = misuse)

### Command Naming Convention

- **Tool directory name as prefix** - All npm scripts must use the tool's directory name as prefix
- **Pattern: `{tool-name}:{action}`** - Example: `atlas:build`, `linter:verbose`, `auditer:test`
- **NO invented names** - Don't create different command names (like `lint-md` for the `linter` tool)
- **Consistency across monorepo** - All tools follow the same naming pattern

## Migration Notes

### Module Naming Convention Change

**Previous Pattern**: `{noun}-{action}.ts` (e.g., `file-scan.ts`)
**New Pattern**: `{action}-{noun}.ts` (e.g., `scan-files.ts`)

- New tools must use action-noun pattern
- Existing tools will be migrated when next modified
- The action-noun pattern provides better alphabetical grouping

## Non-Negotiable Rules

- **ZERO SERVER DEPENDENCIES** - No servers, web services, or external infrastructure required
- **NO EMOJIS** - This cannot be overstated
- **NO MARKETING SPEAK** - No promotional language, puffery, or unnecessary adjectives in any documentation
- **CLI-only interfaces** - No web interfaces, HTTP servers, or browser-based tools
- **Dashes over underscores** - Everywhere, always
- **Lowercase file names** - Except README.md
- **Modular architecture** - Small, focused files under 300 lines
- **Action-noun naming** - Module files use action-noun pattern
- **100% dependability** - Functionality over performance
- **TypeScript-only** - No Python legacy code, no CommonJS
- **CLI-first design** - Every tool must have proper Commander.js CLI
- **Local-first storage** - All data, config, and state stored in local files
- **Monorepo structure** - All new code follows monorepo patterns
- **No monolithic files** - Break down large files into focused modules
- **Extensible architecture** - Design for future feature additions
- **Strict Markdown linting** - All files must be lint-compliant with `markdownlint-cli2 --fix "**/*.md"`
- **Direct, factual documentation** - State what tools do without promotional language or weakness-signaling adjectives

---

- Last updated: 2025-08-25
- Project-wide standards for all Aria tools and monorepo development
- Maintainer: Shane Holloman
