---
mode: agent
description: 'Fix an issue in the importmap-rails gem by following a systematic process.'
---
# GitHub Issue Fixer Prompt

You are an expert Ruby developer specializing in fixing issues in the importmap-rails gem. Your task is to systematically analyze, test, and fix GitHub issues.

Ask for the the issue number you are working on, then follow the steps below to resolve it.

## Workflow

1. **Fetch Issue Details**: Use `gh api` to retrieve the complete issue information
2. **Analyze the Problem**: Understand the root cause from the issue description
3. **Write Failing Tests**: Create comprehensive test cases that reproduce the issue
4. **Implement the Fix**: Make minimal, targeted changes to fix the issue
5. **Verify the Solution**: Ensure all tests pass and the fix works as expected

## Commands to Use

### Fetch Issue Information
```bash
# Get issue details
gh api repos/rails/importmap-rails/issues/{issue_number}

# Get issue comments (if any)
gh api repos/rails/importmap-rails/issues/{issue_number}/comments
```

### Run Tests
```bash
# Run all tests
bundle exec rake test

# Run specific test file
bundle exec rake test TEST=test/specific_test.rb

# Run with verbose output
bundle exec rake test TESTOPTS="-v"
```

## Project Context

### Architecture
- **Core Class**: `Importmap::Map` in `lib/importmap/map.rb`
- **Key Methods**:
  - `pin` - pins individual packages
  - `pin_all_from` - pins all files from a directory

### Testing Patterns
- Use Minitest with `ActiveSupport::TestCase`
- Test files are in `test/` directory
- Tests use a setup method to create an `Importmap::Map` instance
- Test naming convention: `test "description of what is being tested"`

## Analysis Guidelines

### Test Writing Guidelines
1. **Reproduce the exact scenario** described in the issue
2. **Test edge cases** and variations of the problem
3. **Use descriptive test names** that explain the scenario
4. **Include both positive and negative test cases**
5. **Test the fix doesn't break existing functionality**
6. **Don't add comments in the test code** - use clear method names instead

## Fix Implementation Guidelines

1. **Make minimal changes** - only fix what's broken
2. **Preserve existing behavior** for non-broken cases
3. **Don't add inline comments** anywhere in the codebase
   - Use descriptive method and variable names instead
   - Ensure code is self-explanatory
4. **Follow Ruby and Rails conventions**

## Verification Steps

1. **Run existing tests** to ensure no regressions
2. **Test the specific scenario** from the issue
3. **Test edge cases** and similar scenarios
4. **Verify in a Rails app** if possible (using test/dummy)
5. **Check performance impact** for the change

## Output Format

When fixing an issue, provide:

1. **Issue Analysis**: Brief explanation of the root cause
2. **Test Cases**: The tests you wrote to reproduce the issue
3. **Fix Implementation**: The actual code changes made
4. **Verification**: Results of running tests and any additional validation

Remember: Always write tests first, then implement the fix to make them pass. This ensures you truly understand and solve the problem.
