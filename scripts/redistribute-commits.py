#!/usr/bin/env python3
"""
Redistribute commits across date range to fill gaps.

This script:
1. Takes all commits from both repos (in chronological order)
2. Spreads them evenly across all days in the range
3. Generates a git-filter-repo callback to rewrite dates

Usage:
  1. Run this script to generate the date mapping
  2. Use git-filter-repo with the generated callback
"""

import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
OPENHARNESS_PATH = "/Users/abuusama/projects/open-harness/open-harness"
OPENHARNESS_BRANCH = "001-effect-refactor"
OPENSCAFFOLD_PATH = "/Users/abuusama/projects/open-harness/open-scaffold"
OPENSCAFFOLD_BRANCH = "main"

# Date range (inclusive)
START_DATE = datetime(2025, 12, 23)
END_DATE = datetime(2026, 1, 28)


def get_commits(repo_path: str, branch: str) -> list[tuple[str, datetime, str]]:
    """Get all commits as (sha, date, subject) tuples, oldest first."""
    result = subprocess.run(
        ["git", "log", "--format=%H|%aI|%s", "--reverse", branch],
        cwd=repo_path,
        capture_output=True,
        text=True,
        check=True,
    )
    commits = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        sha, date_str, subject = line.split("|", 2)
        date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        commits.append((sha, date, subject))
    return commits


def generate_date_range(start: datetime, end: datetime) -> list[datetime]:
    """Generate all dates in range (inclusive)."""
    dates = []
    current = start
    while current <= end:
        dates.append(current)
        current += timedelta(days=1)
    return dates


def redistribute(
    commits: list[tuple[str, datetime, str]],
    dates: list[datetime]
) -> dict[str, datetime]:
    """
    Redistribute commits evenly across dates.

    Returns mapping of sha -> new_date
    """
    total_commits = len(commits)
    total_days = len(dates)

    # Calculate how many commits per day (as evenly as possible)
    base_per_day = total_commits // total_days
    extra = total_commits % total_days

    mapping = {}
    commit_idx = 0

    for day_idx, date in enumerate(dates):
        # Days at the start get one extra commit to distribute remainder
        commits_today = base_per_day + (1 if day_idx < extra else 0)

        for i in range(commits_today):
            if commit_idx >= total_commits:
                break
            sha, old_date, subject = commits[commit_idx]
            # Spread commits throughout the day (9am to 11pm)
            hour = 9 + int((i / max(commits_today, 1)) * 14)
            minute = (i * 7) % 60  # Vary minutes
            new_date = date.replace(hour=hour, minute=minute, second=0)
            mapping[sha] = new_date
            commit_idx += 1

    return mapping


def main():
    print("=" * 60)
    print("COMMIT REDISTRIBUTION SCRIPT")
    print("=" * 60)
    print()

    # Get commits from both repos
    print(f"Loading commits from OpenHarness ({OPENHARNESS_BRANCH})...")
    oh_commits = get_commits(OPENHARNESS_PATH, OPENHARNESS_BRANCH)
    print(f"  Found {len(oh_commits)} commits")

    print(f"Loading commits from open-scaffold ({OPENSCAFFOLD_BRANCH})...")
    os_commits = get_commits(OPENSCAFFOLD_PATH, OPENSCAFFOLD_BRANCH)
    print(f"  Found {len(os_commits)} commits")

    # Combine (OpenHarness first, then open-scaffold)
    all_commits = oh_commits + os_commits
    print(f"\nTotal commits: {len(all_commits)}")

    # Generate date range
    dates = generate_date_range(START_DATE, END_DATE)
    print(f"Date range: {START_DATE.date()} → {END_DATE.date()} ({len(dates)} days)")
    print(f"Average commits per day: {len(all_commits) / len(dates):.1f}")

    # Redistribute
    print("\nRedistributing commits...")
    mapping = redistribute(all_commits, dates)

    # Show sample of changes
    print("\nSample redistribution (first 10 and last 10):")
    print("-" * 60)
    items = list(mapping.items())
    for sha, new_date in items[:10]:
        old_commit = next(c for c in all_commits if c[0] == sha)
        old_date = old_commit[1]
        subject = old_commit[2][:40]
        print(f"  {sha[:8]} {old_date.date()} → {new_date.date()} | {subject}")
    print("  ...")
    for sha, new_date in items[-10:]:
        old_commit = next(c for c in all_commits if c[0] == sha)
        old_date = old_commit[1]
        subject = old_commit[2][:40]
        print(f"  {sha[:8]} {old_date.date()} → {new_date.date()} | {subject}")

    # Verify all days are covered
    print("\nVerifying coverage...")
    dates_used = set(d.date() for d in mapping.values())
    all_dates = set(d.date() for d in dates)
    missing = all_dates - dates_used
    if missing:
        print(f"  WARNING: Missing days: {sorted(missing)}")
    else:
        print(f"  ✓ All {len(dates)} days covered!")

    # Show commits per day distribution
    from collections import Counter
    day_counts = Counter(d.date() for d in mapping.values())
    print(f"\nCommits per day: min={min(day_counts.values())}, max={max(day_counts.values())}")

    # Write the mapping to a file
    mapping_file = Path(OPENSCAFFOLD_PATH) / "scripts" / "commit-date-mapping.txt"
    mapping_file.parent.mkdir(parents=True, exist_ok=True)
    with open(mapping_file, "w") as f:
        for sha, new_date in mapping.items():
            # Format: SHA TIMESTAMP (Unix timestamp with timezone)
            timestamp = int(new_date.timestamp())
            f.write(f"{sha} {timestamp} -0800\n")
    print(f"\nMapping written to: {mapping_file}")

    # Generate the git-filter-repo script
    filter_script = Path(OPENSCAFFOLD_PATH) / "scripts" / "rewrite-dates.py"
    with open(filter_script, "w") as f:
        f.write('''#!/usr/bin/env python3
"""
git-filter-repo callback to rewrite commit dates.
Generated by redistribute-commits.py

Usage:
  git filter-repo --commit-callback "$(cat scripts/rewrite-dates.py)"
"""

# Load the mapping
DATE_MAP = {
''')
        for sha, new_date in mapping.items():
            timestamp = int(new_date.timestamp())
            f.write(f'    b"{sha}": (b"{timestamp} -0800", b"{timestamp} -0800"),\n')
        f.write('''}

def process(commit):
    sha = commit.original_id
    if sha in DATE_MAP:
        author_date, committer_date = DATE_MAP[sha]
        commit.author_date = author_date
        commit.committer_date = committer_date
''')
    print(f"Filter script written to: {filter_script}")

    print("\n" + "=" * 60)
    print("NEXT STEPS")
    print("=" * 60)
    print("""
1. BACKUP FIRST:
   cd /Users/abuusama/projects/open-harness/open-harness
   git branch backup/001-effect-refactor 001-effect-refactor

   cd /Users/abuusama/projects/open-harness/open-scaffold
   git bundle create ~/open-scaffold-backup.bundle --all

2. CREATE UNIFIED REPO:
   cd /Users/abuusama/projects/open-harness
   mkdir unified-repo && cd unified-repo
   git init

   # Add OpenHarness and fetch
   git remote add openharness ../open-harness
   git fetch openharness
   git checkout -b main openharness/001-effect-refactor

   # Add open-scaffold and fetch
   git remote add scaffold ../open-scaffold
   git fetch scaffold

   # Graft open-scaffold onto OpenHarness
   FIRST_SCAFFOLD=$(git rev-list --max-parents=0 scaffold/main)
   git replace --graft $FIRST_SCAFFOLD HEAD

   # Cherry-pick or merge open-scaffold commits
   git cherry-pick $FIRST_SCAFFOLD..scaffold/main

3. REWRITE DATES:
   pip install git-filter-repo
   git filter-repo --commit-callback "
   exec(open('scripts/rewrite-dates.py').read())
   process(commit)
   "

4. VERIFY:
   git log --format="%ad %s" --date=short | head -50
   git log --format="%ad" --date=short | sort | uniq -c
""")


if __name__ == "__main__":
    main()
