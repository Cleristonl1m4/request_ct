# Git Workflow and Repository Governance

## Branching strategy

This project uses a simplified trunk-based workflow. `main` is the only permanent branch. Work must be performed in short-lived branches created from `main`:

- `feature/<issue>-<description>` for compatible functionality.
- `bugfix/<issue>-<description>` for development defects.
- `hotfix/<issue>-<description>` for urgent production fixes.

Pull requests are required before merging into `main`. Temporary branches should be deleted after merge when retention is not required for audit purposes.

## Commits

Use Conventional Commits with an imperative, focused description. Each commit must represent one coherent logical change. Never commit credentials, local environment files, generated build output, or dependency directories.

## Releases

Use Semantic Versioning (`MAJOR.MINOR.PATCH`) and annotated tags such as `v1.0.0`. A major version indicates a breaking change; a minor version adds compatible functionality; a patch version fixes a compatible defect.

## Pull request checklist

- Explain the objective and context.
- Describe functional, database, and configuration changes.
- Include the validation commands and their results.
- Review security, authorization, and migration risks.
- Document deployment and rollback actions when applicable.

## Required validation

Before merging, run `npm run lint`, `npm run typecheck`, and `npm run build`. Additional tests must be added as the application gains unit and integration test coverage.
