# Current-master rebase verification

On 7 October 2026 the application at `7f8128e62c8cdd3e17308c1a029b6092727a1201` was overlaid onto the checksum-pinned clean staging image (SHA-256 `0305b2d2f7124781c41de04eb8aa8a7847ee5116ee01f09dc52d7f12dc513b93`). The fresh PostgreSQL 15 database contained only demo data and captured synthetic group fixtures. External integrations were disabled; HTTP was loopback-only.

**199/199 native browser and database assertions passed**, including both `/apps` and `/qapps`, widths 320/390/800/1440, keyboard Active changes and persisted Y/N values, text save/reload, member add/remove, foreign-customer exclusion, shared navigation and unchanged Create Group styling. [Case results](postgres-rebase-checks.json) list each assertion.

A final SELECT confirmed the empty group restored to Import/Active Y with blank terms/description; its two temporary memberships expired. The foreign group and populated group remained unchanged, and the original populated membership remained active. The Docker Compose project `zenith-pr20-qa` was removed with its volumes; label queries returned zero containers and zero volumes. No production configuration, records or credentials were used.

The rebase retains current master ownership assertions and shared CSS/navigation behavior. Only this screen stylesheet registration and the existing accessible tab behavior were reconciled. Historical Windows/H2 images and evidence retain their original provenance; they are not presented as this PostgreSQL run.
