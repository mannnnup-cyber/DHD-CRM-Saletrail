# DHD six-post content pilot

**Draft content and development handoff — nothing scheduled or published.**

This pack contains six generated single-image concepts, twelve tailored captions (Instagram + Facebook), alt text, a proposed two-week calendar, asset fingerprints, creative prompts and an implementation work packet. All images are AI concept mockups. Brand treatment is provisional pending owner review.

## Start here

1. Open [REVIEW.html](REVIEW.html) locally to inspect all six images and captions.
2. Review [brand-profile.md](brand-profile.md) and [posting-instructions.md](posting-instructions.md).
3. Give your coding AI the full [IMPLEMENTATION-PROMPT.md](IMPLEMENTATION-PROMPT.md).
4. The manifest [content-pack.json](content-pack.json) is a **proposed interchange format**, not an API already implemented by FollOps.

## Existing implementation baseline

Repository: mannnnup-cyber/DHD-CRM-Saletrail (use canonical GitHub owner from the branch URL).
Content Studio parent branch: feat/brightbean-content-studio.
Inspected parent commit: c38d7417e48a64d820b034a65144a01cd1828f06.
Existing report: docs/BRIGHTBEAN-CONTENT-STUDIO-DELIVERY.md.

The existing studio accepts one JPEG/PNG image, at most 2 MiB/25 MP, per post intent. This pilot stays within that image-first scope. Twelve separate draft intents preserve platform-specific captions. Do not add video/carousel support for this pack.

This content branch changes no application code, secrets, hosted schema, provider settings, accounts, or release gates. It inherits the earlier implementation branch; that inherited code has not been independently re-certified here. The prior report's tests are historical results, not new tests of this content commit.

