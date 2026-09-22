# WP-MAINTENANCE-BASELINE — Baseline Build/Type-Check/Test Health

## Status: Planning ONLY — no code change
## Branch: master (from verified origin/master f3aea2f)
## Preflight: PASS
## Note: Document existing build/test failures to distinguish regressions in future QA

## Summary

Documented baseline build/type-check/test state to provide reproducible commands and expected failure patterns. This packet establishes the known-good health envelope so future QA can detect new regressions, not re-report existing ones.

## Verified Baseline State

### Build System
- Command: `npm run build`
  - **Status**: FAILS (pre-existing)
  - **Error**: Missing dependency `qrcode` (resolution: `npm install qrcode` or add to package.json)
  - **Root cause**: Vite Rollup cannot resolve import "qrcode" from "src/components/CompanionConnect.tsx"
  - **Note**: Not introduced by any Phase 1A branch; pre-existing on master at `f3aea2f`

- Command: `npx tsc --noEmit`
  - **Status**: FAILS (pre-existing)
  - **Errors**: ~20 TypeScript errors across multiple files
  - **Sample errors**:
    - `contract.test.ts:49:5` "Cannot find name 'expect'" (no test runner configured)
    - `Settings.tsx:432:44` Property 'json' does not exist on type 'Response | { ok: boolean; }'
    - WhatsApp.tsx type mismatches (UserRole vs "sales_rep"; Chat property 'contactId'; array-to-element setter errors; Icon component misuse)
  - **Files with errors**:
    - `src/lib/inbox/contract.test.ts` (jest globals missing)
    - `src/pages/Settings.tsx` (Response typing)
    - `src/pages/WhatsApp.tsx` (multiple type mismatches, Icon title prop)
  - **Note**: All errors pre-exist on master; not introduced by Phase 1A changes

- Command: `npm test`
  - **Status**: FAILS (no test script defined)
  - **Missing**: jest, @types/jest, test environment setup
  - **Note**: `contract.test.ts` contains valid Jest structure (11 test cases) but cannot execute due to missing test runner

### Test Runner Configuration
- Package.json does not contain:
  ```json
  "scripts": {
    "test": "jest",
    "test:contract": "jest --testPathPattern=\"contract\""
  }
  "devDependencies": {
    "jest": "...",
    "@types/jest": "...",
    "ts-jest": "..."
  }
  ```
- Missing jest configuration: `jest.config.js` or `jest.config.ts`
- Missing test environment: JSDOM for React component testing

### Build/Test Health Checklist

| Command | Expected status | Current status | Note |
|---|---|---|---|
| `npm run build` | Should succeed after `qrcode` install | FAILS (qrcode missing) | Pre-existing baseline issue |
| `npx tsc --noEmit` | Should report zero errors | FAILS (20+ TS errors) | Pre-existing baseline; includes contract.test.ts (no jest globals) |
| `npm test` | Should run all tests | FAILS (no script) | Missing jest config; contract.test.ts cannot run |
| `npm run test:contract` | Should run contract tests specifically | FAILS (no script) | Post-Phase 1A expectation; needs jest setup |

## Dependencies Required for Baseline Health

### Production Build Fix
- Add `qrcode` dependency:
  ```bash
  npm install qrcode
  ```
- OR add to `devDependencies` if only needed during build:
  ```json
  "devDependencies": {
    "qrcode": "latest"
  }
  ```

### TypeScript Test Environment
Install jest and related dependencies for contract tests:
```bash
npm install --save-dev jest @types/jest ts-jest
```

### Test Configuration
Create `jest.config.js` with appropriate React testing setup:
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|tsx)?$',\n  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Test Scripts
Update package.json scripts:
```json
"scripts": {
  "test": "jest",
  "test:contract": "jest --testPathPattern=\"contract\""
}
```

## Baseline Health Verification Commands

Once dependencies and configuration are in place, run:

1. **Install missing dependencies**:
   ```bash
   npm install qrcode jest @types/jest ts-jest
   ```

2. **Create test configuration**:
   ```bash
   cat > jest.config.js << 'EOF'
   module.exports = {
     testEnvironment: 'jsdom',
     transform: {
       '^.+\\.(ts|tsx)?$': 'ts-jest',
     },
     testRegex: '(/__tests__/.*|(\\\\.|/)(test|spec))\\\\.(ts|tsx)?$',
     moduleNameMapping: {
       '^@/(.*)$': '<rootDir>/src/$1',
     },
   };
   EOF
   ```

3. **Run build** (should succeed after qrcode install):
   ```bash
   npm run build
   ```

4. **Run type-check** (should still have WhatsApp.tsx non-contract errors, but contract.test.ts should be recognized):
   ```bash
   npx tsc --noEmit
   ```

5. **Run contract tests**:
   ```bash
   npm run test:contract
   ```

6. **Verify no regressions**:
   - Build passes (qrcode issue resolved)
   - Type-check errors limited to WhatsApp.tsx (no new errors in new files)
   - Contract tests run and pass/fail based on actual implementation, not missing test runner

## Dependencies and Scope

- No code changes in this packet
- No DB/RLS/credential mutation
- No deployment
- No Git-history rewrite
- WP-001 preserved
- All Phase 1A branches already merged; this is baseline maintenance for master branch

## Acceptance Criteria

1. `npm run build` succeeds after adding `qrcode` dependency
2. `npx tsc --noEmit` errors are limited to existing WhatsApp.tsx files (no new errors introduced by future work)
3. `npm test` runs and can execute `contract.test.ts` after Jest setup
4. Future QA can distinguish:
   - Regressions (new build/type-check failures) from baseline issues
   - New test failures vs. inability to run tests due to missing runner

## Security Review Required

- This packet only documents existing build/test issues; no security changes
- Security review not required (no mutation, no new code paths)

## Maintenance Timeline

This baseline health packet should be actively maintained:
- When new PRs add dependencies that affect build (e.g., new vite imports)
- When TypeScript changes in existing code (WhatsApp.tsx, Settings.tsx)
- When test infrastructure evolves (new jest patterns, test patterns)

## Rollback Strategy

Not applicable (documentation only). If baseline health degrades, revert to last successful build/test state and re-establish this document with updated failure patterns.

## Implementation Report (to be filled upon PA approval)

- Work Packet: WP-MAINTENANCE-BASELINE
- Branch: master
- Files Changed (this document only): `docs/work-packets/active/WP-MAINTENANCE-BASELINE.md`
- Summary: Documented baseline build/type-check/test health; provides reproducible commands to distinguish regressions from existing issues.
- Build/Test: N/A (documentation only)

Co-Authored-By: Claude Code <noreply@anthropic.com>