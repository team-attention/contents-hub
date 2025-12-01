# Context Directory

This directory contains project-wide context documentation.

## Registries

- `local-context-registry.yml` - Index of all local context files (*.ctx.md)
- `global-context-registry.yml` - Index of all global context files (ctx/**/*.md)

These registries are auto-generated. Do not edit manually.

## Templates

The `templates/` directory contains template files for creating contexts:

- `local-context.md` - Template for local context files (*.ctx.md)
- `global-context.md` - Template for global context documents

**Customization**: You can modify these templates to fit your project's needs. The `ctx create` command will use your customized templates automatically.

## Recommended Structure

You can organize your context files however you like. Here are some common patterns:

- `architecture/` - Architecture documentation
- `rules/` - Development rules and guidelines
- `stories/` - Feature stories and specifications

Feel free to create your own structure that fits your project needs.
