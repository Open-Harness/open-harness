# Sample Tasks for Testing

**Input**: Test fixture for SDK validation
**Prerequisites**: None

## Phase 1: Setup

**Purpose**: Initialize test environment

- [ ] T001 Create src/utils/hello.ts with a function that returns "Hello, World!"
- [X] T002 [P] Verify TypeScript configuration exists

### Phase 1 Validation

- [ ] T003 Run typecheck to verify no errors

---

## Phase 2: Implementation

**Purpose**: Implement core functionality

**Independent Test**: The hello function should return the expected greeting string

- [ ] T004 Add unit test for hello function in tests/hello.test.ts (depends on T001)
- [ ] T005 [P] Add JSDoc documentation to hello function

### Phase 2 Validation

- [ ] T006 Run tests and ensure all pass

---

## Phase 3: Polish

**Purpose**: Final cleanup

- [ ] T007 Update README with usage example (depends on T004, T005)

### Phase 3 Validation

- [ ] T008 Run lint and fix any errors
