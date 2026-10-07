# Edit Customer Group runtime verification

The updated screen was driven through the real Moqui renderer and services on both `/apps` and `/qapps`. `checks.json` records **199 passing checks, zero failures, and zero browser page errors**. The final CSS-only switch and mobile summary refinements received **114 further passing checks**, including four source/runtime SHA-256 comparisons, in `visual-checks.json` and `final-overlay-parity.json`.

Those captured hash pairs compare the physical Windows source and runtime files. Git normalizes CRLF to LF in `cpe-tabs.js` and `ZenithApp.xml`; [committed-source-parity.json](committed-source-parity.json) records the submitted blob hashes and confirms all four tested files match after only that line-ending normalization. The screen XML and dedicated CSS also match byte-for-byte.

The functional run covered widths 320, 390, 800 and 1440, empty and populated member states, compact desktop columns and mobile stacking, overflow, button colors, input borders and the contextual header. Space and Enter changed Active, the captured POST values were asserted as `N` and `Y`, and read-only H2 queries proved that each value persisted. Arbitrary valid Payment Terms and Description text survived save/reload. Adding a customer created the expected membership; removing it expired that same membership and restored the empty state. The customer choices excluded the foreign fixture customer. The Back link retained its shell, and enabling/disabling the new stylesheet left the separate Create Group form's computed styles unchanged.

The final read-only pass covered 320, 390, 800, 1440 and 1492 pixels in both shells. Below 600 pixels, summary item gaps become 8 pixels and icon chips become 40 pixels; desktop retains the 14-pixel gaps and 46-pixel chips. Actual text rectangles prove that `Wholesale` stays on one line, including at width 320. Card columns, summary bounds, page overflow, the purple submit/Active switch, the white switch knob and input borders were rechecked. The scripts wait for transient notifications to finish before capturing the four final frames. These presentation-only refinements did not change the form or service behavior covered by the 199-check functional run.

Before final screenshots, the empty group was restored through the real form to `Import`, `Wholesale`, Active `Y`, and blank Payment Terms/Description; the database confirmed the result. The foreign fixture group and the pre-existing populated membership remained unchanged. Only four representative screenshots are packaged: `apps-desktop.png` and `qapps-desktop.png` at the supplied reference's 1492 × 720 size, plus `apps-mobile.png` and `qapps-mobile.png` at 320 × 1400 to show all stacked cards. Full responsive geometry remains in `checks.json`; its original screenshot filenames describe the functional run's temporary artifacts.

## Runtime provenance and limits

This was a fresh, disposable Windows runtime using Java 21.0.12.1, Chrome 147.0.7727.56, H2 2.4.240 and Moqui 4.0.0. The framework JAR MD5 was **`df7e767ac4dbefdb4aac35fbccb86192`**, matching the supplied image's framework. The original Docker image was not loaded. Compiled runtime libraries and public browser assets were copied through an allowlist into a clean runtime assembled from public source and the application components. No image environment/configuration, image history, production database, private key or mail credential was copied.

Initial seed/demo discovery loaded 7,634 records and reported 33 unrelated baseline skips. The targeted fixture contains 21 entity records, including updates to the standard disposable demo account's party/preference, two synthetic organizations, two synthetic customers, three groups and one initial membership. The tested H2 queries confirm those captured IDs and owners before any browser write.

This establishes framework and changed-application-file parity, **not full Linux/PostgreSQL production-container parity**. OpenSearch, mail and QZ signing were omitted. The shared application navigation/header was preserved; the reference's page content was aligned within that shell. Payment Terms remains an unrestricted valid text field because this application has no authoritative payment-terms option catalog. Existing non-UI tenant access hardening in the separate contacts PR is not certified by this presentation verification.

## Reproduce on a fresh local runtime

1. Prepare a clean Moqui runtime outside the repository, following the local-development setup. Use a new H2 database, synthetic seed/demo data, disabled external mail/search integrations and no production configuration. Do not reuse an existing tenant database.
2. Apply the four application files listed in `final-overlay-parity.json`. In the local configuration enable the transactional H2 TCP server with `start-server-args="-tcpPort 19092 -ifExists"`, and start the JVM with `-Dh2.bindAddress=127.0.0.1`. Keep HTTP on loopback port 18080. Keep the configuration and all database files outside the repository.
3. From the runtime root, load normal seed/demo discovery **before** loading the fixture. These are separate invocations; combining `types` and an explicit `location` skips normal discovery:

   ```text
   java -Dmoqui.conf=conf/CustomerGroupQaConf.xml -cp . MoquiStart load types=seed,seed-initial,demo
   java -Dmoqui.conf=conf/CustomerGroupQaConf.xml -cp . MoquiStart load location=/absolute/path/to/fixture.xml
   java -Dh2.bindAddress=127.0.0.1 -Dmoqui.conf=conf/CustomerGroupQaConf.xml -cp . MoquiStart port=18080 no-run-es
   ```

4. Install Playwright in a disposable Node workspace and install Chromium, or point `CGQA_CHROME` at an installed Chrome executable. Set the following local environment variables; credentials stay in that local environment:

   | Variable | Value |
   | --- | --- |
   | `CGQA_BASE_URL` | `http://127.0.0.1:18080` |
   | `CGQA_RUNTIME_DIR` | Absolute isolated runtime root containing `WEB-INF` and `runtime` |
   | `CGQA_H2_JAR` | Optional explicit H2 JAR path, instead of deriving it from the runtime root |
   | `CGQA_DB_URL` | `jdbc:h2:tcp://127.0.0.1:19092/` followed by the isolated absolute database path, with `;IFEXISTS=TRUE` |
   | `CGQA_DB_USER`, `CGQA_DB_PASSWORD` | Disposable local H2 account |
   | `CGQA_JAVA` | Java 21 executable; defaults to `java` |
   | `CGQA_USERNAME`, `CGQA_PASSWORD` | Standard fresh-demo account, or its disposable replacement |
   | `CGQA_SOURCE_DIR` | Repository root, for optional final application-file parity assertions |
   | `CGQA_OUTPUT_DIR` | Output folder outside the repository |

   Then run `node run-group-qa.cjs`, followed by `node capture-final.cjs`. Both scripts restrict HTTP to loopback port 18080; the functional script restricts H2 to loopback TCP port 19092. `GroupDbProbe.java` uses only SELECT statements for the captured fixture IDs. Recorded POST data is limited to group ID, Active and Payment Terms; session tokens, passwords, cookies and raw request bodies are never recorded.

## Cleanup

The recorded run's cleanup completed successfully: [cleanup.json](cleanup.json) confirms the task server stopped and both fresh synthetic databases were removed through verified exact file paths. No test records remain in those databases.

Stop the isolated JVM and close its H2 connections. Verify the resolved absolute database target belongs to the disposable runtime prepared for this check, then remove that fresh database's files and any fixture/log files from the external runtime. Do not issue broad prefix deletes against a shared database. The expected IDs are `CITEST_ORG_A`, `CITEST_ORG_B`, `CITEST_A_CUST`, `CITEST_B_CUST`, `CITEST_REL_JD_A`, `CGQA_EMPTY_A`, `CGQA_POPULATED_A` and `CGQA_FOREIGN_B`, plus the fixture's updates to the standard demo account. Removing the entire verified fresh database removes those updates and all seeded records together. Preserve a small cleanup confirmation as review evidence; it must not contain credentials or production data.

## Rebased PostgreSQL verification

The same native browser assertions can use `CGQA_POSTGRES_CONTAINER` instead of H2. The probe accepts only a container labelled `com.docker.compose.project=zenith-pr20-qa`, executes the fixed SELECT-only `postgres-state.sql` for captured synthetic IDs, and requires fixtures before any form actions. HTTP remains restricted to loopback port 18080. Use the clean checksum-pinned staging image with this candidate overlay and the existing fixture in a fresh tmpfs database; remove the entire disposable stack afterwards. Original recorded H2 results remain historical evidence for their named commit. Fresh candidate results are linked in PR #20.

Fresh current-master results: [PostgreSQL rebase verification](POSTGRES-REBASE.md), **199/199 passing**, with zero disposable containers/volumes remaining.
