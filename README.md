# CT Request and Inventory Replenishment

Web application for requesting, reviewing, and approving inventory replenishment. The system calculates material turnover, supports a two-stage approval workflow, and guides the manual creation of CTs in the external ERP system.

## Status

This project is under active development. Business decisions marked as pending still require confirmation.

## Features

- Create replenishment requests with multiple materials.
- Query the CIGAM material catalog.
- Save drafts and edit requests before submission.
- Review, adjust, approve, or reject requests.
- Support management and executive approval stages.
- Request a re-analysis with a required reason.
- Record CT generation by item and request.
- Manage user roles and access permissions.
- Preserve an auditable request history.

The application does not create CTs automatically. It provides the information required for manual creation in the external system.

## Workflow

1. A requester creates a draft and adds materials.
2. The system validates the materials against the CIGAM catalog.
3. Management reviews, adjusts, approves, or rejects the request.
4. The executive stage approves or rejects the request.
5. The CT operator records the items generated in the external system.
6. The requester can follow the current status and approval history.

## Roles

| Level | Role | Main permissions |
| --- | --- | --- |
| 1 | Requester | Create and follow replenishment requests |
| 2 | Management | Review, adjust, approve, and reject requests |
| 3 | Executive | Approve, reject, and manage permissions |
| 4 | CT Operator | Request re-analysis and record CT generation |
| 5 | Administrator | Full administrative access |

Permissions are enforced by the backend. The client must never define its own role or authorization level.

## Architecture

- Frontend: React, TypeScript, Vite, and Tailwind CSS.
- Backend: Node.js HTTP server.
- Database: Microsoft SQL Server.
- ERP integration: CIGAM login and material catalog APIs/databases.
- Authentication: HTTP-only server session cookie.

## Requirements

- Node.js 18 or newer.
- Access to the REPTEC and CIGAM SQL Server databases.
- Access to the configured CIGAM login API.

## Configuration

1. Copy `.env.example` to `.env`.
2. Set the SQL Server, database, user, password, and login API values.
3. Never commit `.env` or any credential to Git.
4. Apply `sqlserver/schema.sql` and the SQL Server migrations in order.
5. Install dependencies with `npm ci`.

## Development

Run the API and frontend in separate terminals:

```bash
npm run dev:api
npm run dev
```

Useful validation commands:

```bash
npm run lint
npm run typecheck
npm run build
```

## Versioning and Git workflow

The repository uses short-lived branches and pull requests. `main` is the protected production-ready branch. Use Conventional Commits and annotated Semantic Versioning tags:

```text
feature/123-add-material-filter
bugfix/456-fix-request-transition
feat(requests): add material filter
```

See `docs/GIT_WORKFLOW.md` for the repository governance policy.

## Security

- Keep credentials outside version control.
- Use HTTPS in every deployed environment.
- Do not log passwords or session tokens.
- Keep authorization checks in the backend.
- Rotate any credential that was previously exposed.
- Review database migrations and rollback implications before deployment.
