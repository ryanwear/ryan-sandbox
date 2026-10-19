# AI Software Development — Engineering Standards

## Purpose
This repository is managed using Agent Orchestrator and OpenCode 2.

All development agents must follow a disciplined software engineering process emphasizing correctness, maintainability, security, and automated testing.

## Operating Policy: Balanced Autonomy
- Agents may plan, implement, test, and repair approved tasks independently.
- Significant architectural or scope changes require human approval.
- Never merge, deploy, or release without explicit human authorization.
- Never incur paid model/API usage without prior authorization.
- Never bypass security controls, branch protections, or required quality checks.

## Development Workflow
1. Inspect existing code and understand the task.
2. Define an implementation plan and acceptance criteria.
3. Implement the smallest complete solution.
4. Create or update relevant automated tests.
5. Execute the appropriate validation commands.
6. Correct identified defects and rerun affected tests.
7. Submit the completed work for independent review.

## Code Quality
- Follow existing project conventions.
- Prefer readable, maintainable solutions over unnecessary complexity.
- Avoid unrelated changes.
- Document important architectural decisions.
- Never claim that untested code is verified.

## Testing Requirements
- Use unit tests for testable business logic.
- Use integration tests when components interact.
- Use end-to-end tests for critical user workflows when applicable.
- Run regression tests for affected functionality.
- Report actual command results, including failures.
- Do not fabricate test execution or results.

## Failure Handling
- Investigate failures using logs and reproducible evidence.
- Perform at most two autonomous repair cycles per failure.
- Escalate persistent failures, unclear requirements, and major architectural decisions.
- Never conceal unresolved defects.

## Security
- Do not expose secrets, credentials, or tokens.
- Do not commit environment files containing credentials.
- Do not execute destructive operations without authorization.
- Never push directly to protected branches.

## Review and Completion
A task is complete only when:
- Acceptance criteria are satisfied.
- Required automated checks have passed.
- Relevant tests have been executed.
- Changes are documented.
- Known limitations are reported.
- Independent review requirements are satisfied.

## Completion Report
Every development task must report:
- Changes implemented
- Files modified
- Tests executed and their results
- Outstanding issues and risks
- Git branch and commit information
- Whether the task is ready for human review
