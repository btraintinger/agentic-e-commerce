#!/bin/sh
# Totals the time recorded in commit messages for each person
echo "# Time Tracking"
echo ""
echo "| Person | Time |"
echo "|---|---|"
git log --format='AUTHOR:%an%n%B' | awk '
/^AUTHOR:/ { a = substr($0, 8); next }
/\| time: / {
  t = $0; sub(/.*\| time: /, "", t)
  h = 0; m = 0
  if (t ~ /h/) { h = t; sub(/h.*/, "", h); sub(/.*h/, "", t) }
  if (t ~ /m/) { m = t; sub(/m.*/, "", m) }
  min[a] += h * 60 + m
}
END {
  for (p in min) printf "| %s | %dh %02dm |\n", p, min[p] / 60, min[p] % 60
}' | sort
