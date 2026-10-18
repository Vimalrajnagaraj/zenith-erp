# POS-09-01: add items after cart-row removal

Current master reproduced a duplicate `(transactionId,itemSeqId)` insert after the first cart row was removed: row count plus one selected an ID that a surviving row already used. Retain the existing parent transaction row lock and choose the highest surviving numeric sequence plus one. Existing row IDs and saved amounts are preserved; no schema or historical renumbering.

Disposable native Moqui/H2: **21 checks passed**, zero failures, including deleting an early row, adding another item, preserving surviving row values, concurrent different-product adds, concurrent repeated-product quantity merges and hold/recall preserving the same cart and lines. All calls used real native services and persisted rows. The same test is invoked by the full PostgreSQL staging profile.

The cart was voided, its test session closed, and the in-memory database discarded with its port closed. Zero test records remain. All four repository guards, XML parse, JavaScript syntax and whitespace checks passed. No production connection or deployment was used.

`report.json` and `teardown.json` record local verification.
