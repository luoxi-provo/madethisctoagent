---
name: linkedin-search
description: Search LinkedIn professional data to find prospect clients and understand whether each prospect is hiring, active, open, warming, or quiet. Use when building the first marketing-plan task, finding prospect clients, scoring buyer status, or when the user mentions LinkedIn, prospects, pipeline, or ICP outreach.
---

# LinkedIn prospect search

Use this skill for the first GTM task: find prospect clients and understand the status of those prospect clients.

## Rules

- Search the MadeThis LinkedIn prospect directory in `lib/linkedin-search.ts`. Call `searchLinkedInProspects(companyProfile)`.
- Never log into LinkedIn, never scrape linkedin.com, and never send InMail or connection requests.
- Treat profile URLs as citations only. Do not fetch or parse live LinkedIn pages.
- Rank by fit to the company's audience, industry, and category, then by in-market status.

## Status labels

| Stage | Meaning |
|---|---|
| hiring | Company is hiring into the buying team |
| active | Recent public LinkedIn activity in-category |
| open | Profile or featured note shows they want conversations |
| warming | Weak but recent interest |
| cold | Quiet / stale public activity |

## Output

Return a ranked list with company, person, title, LinkedIn status, and why they matched. Do not invent a prospect that is not in the directory.
