# BTA autonomous two-agent orchestrator

This adds a GitHub Actions entry point for a two-agent implementation and review
loop. It does not control an existing Antigravity browser conversation. It calls
Google's managed Antigravity agent API as a separate worker, then uses the OpenAI
Agents API as an independent reviewer.

## What happens

1. A task is submitted from Actions → Autonomous agent team → Run workflow.
   Alternatively, comment /agents run followed by the task on a normal GitHub issue.
2. The Antigravity agent receives a fresh remote sandbox with a read-only repository
   source. It plans, implements, and returns the resulting workspace snapshot.
3. The GitHub Actions runner imports the snapshot on a new agents/... branch.
   The raw GitHub write token never enters the Antigravity sandbox.
4. The runner executes npm test and the existing Chromium Playwright smoke suite.
5. The OpenAI reviewer independently reviews the diff and test results. Findings are
   sent to the same Antigravity environment for up to three repair rounds.
6. The workflow pushes the branch and opens a pull request. It never merges it.

A review that cannot be parsed, a failed test, a missing API capability, or an
unresolved finding results in a draft PR for a human to inspect. Only a clean
review and passing tests produce a non-draft PR; merging remains a human action.

## One-time setup

Add these repository Actions secrets (Settings → Secrets and variables → Actions):

- GEMINI_API_KEY — Google AI Studio API key with access to the Antigravity agent
  and Interactions API.
- OPENAI_API_KEY — OpenAI API key with access to the Agents API.

These are API credentials, not ChatGPT or Google AI consumer subscriptions. API
usage may be billed separately. The API models and preview availability are
controlled by their providers.

This starter uses the public GitHub source for ItsLeoIso/bta.github.com; no GitHub
PAT is given to the Antigravity worker. If the repository becomes private, add a
separate read-only repository credential to the Google managed environment before
using this workflow. Do not give the worker a write token.

Optional repository Actions variables:

- ANTIGRAVITY_AGENT_ID — defaults to antigravity-preview-09-2026.
- OPENAI_REVIEW_MODEL — defaults to gpt-6-astra; set to a model enabled for your
  OpenAI Agents API project if this default is unavailable.

## Running a task

From GitHub Actions:

1. Open the repository's Actions tab.
2. Select Autonomous agent team.
3. Select Run workflow.
4. Enter one instruction in the task field and run it.

Example:

Plan, discuss, and implement all of Phase 7. Read the roadmap and cooperation
rules first. Work in small milestones, run the tests, document remaining gaps,
and open a PR. Do not merge it.

From a GitHub issue, comment on a normal issue:

/agents run Plan, discuss, and implement all of Phase 7. Come back when done.

The comment trigger intentionally ignores pull-request conversations.

## Safety boundaries

- Antigravity works in a separate Google-managed sandbox. It cannot see this ChatGPT
  conversation or your existing Antigravity web session.
- The sandbox gets repository source access only; it does not receive GITHUB_TOKEN
  or OPENAI_API_KEY.
- The runner writes only to a new branch and opens a PR. No automatic merge, release,
  deployment, secret changes, branch-protection changes, or repository settings edits.
- Workflow concurrency prevents overlapping runs for the same issue (or dispatch run).
- Review is conservative: malformed or ambiguous reviewer output is not treated as
  approval.
- GitHub branch protection on main is still recommended. Review the PR and Actions
  logs before merging. Do not use this for untrusted issue text or repositories.

## Current limitations

- This is an API-driven Antigravity worker, not a remote-control bridge to the
  Antigravity browser tab you currently have open. That tab remains independent.
- This initial version is configured for this public repository. Private repositories
  need a Google-managed read-only GitHub credential.
- The OpenAI reviewer is an API agent, not the model in this chat session. It uses
  the configured OpenAI API model and API billing.
- The workflow has a three-round repair cap. If the agents disagree, tests fail, or
  the service is unavailable, it leaves a draft PR or fails visibly; it does not
  claim completion.
- GitHub Actions runtime, provider quotas, and API availability limit task duration.
  Very large tasks may need to be split into several runs.

## Troubleshooting

- Missing secret: add GEMINI_API_KEY and OPENAI_API_KEY in repository Actions secrets.
- Agent not available or quota: confirm the Antigravity agent preview and Interactions
  API are enabled for the Google project, and that the API key belongs to that project.
- Reviewer model unavailable: set OPENAI_REVIEW_MODEL to a model enabled for the
  OpenAI Agents API project.
- Tests fail: the workflow asks Antigravity to repair the reported failures. After
  three rounds, inspect the draft PR and the run log.
- No PR: check the run log for the provider error. The workflow does not push a PR
  if no valid snapshot or changes were produced.
