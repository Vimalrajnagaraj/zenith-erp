# POS dashboard week filter

On Sunday 25 October 2026, a Sunday-start JVM locale generated both Today and
This Week as `2026-10-25` to `2026-10-25`. The screen now uses Monday through today,
matching its existing Monday-based weekly chart buckets.

The updated `docs/qa/check-pos-chart.groovy` executes the actual screen actions:
the regression fails on master with that one-day Sunday URL and passes after
the fix. It covers every weekday under US/UK JVM locales, year rollover, and
a synthetic weekly total/chart sum of 225, alongside the existing chart tests.

Eleven loopback browser checks pass, including initialization, real This Week
clicks, matching chart dates, Sunday highlighting, reload persistence and custom
seven-day form submission on both `/apps` and `/qapps`. See `browser-report.json`
and the two screenshots. Existing staging dashboard browser checks now exercise
week selection and the custom range on both surfaces on every run.

All data is disposable and synthetic. The owned JVM was stopped, both loopback
listeners were confirmed absent and its in-memory database was destroyed. No live
data, issued documents, billing services or tenant filters were changed.
