# Radar and Auto-Fence integration

Pay recognizes the V2 address recorded in `contracts/deployments/v2-sepolia.json`; it does not infer enforcement from an arbitrary contract exposing a similar ABI. It keeps the existing configured v1 Guard path. V2 bulk-loads `recipientDetails(Safe)` and its per-Safe learning setting. The v1 path still reads `payees(Safe)` once. Pasting an address and checking a payment use `verdictForV2` for V2 snapshots. Learned recipients are described as recorded recipients, with on-chain execution timestamps; they are not labelled explicitly approved.

After a direct V2 transaction confirms, Pay refreshes the bulk recipient snapshot. If refresh fails, another payment requires reloading the Safe. In Safe App mode, an external proposal invalidates the snapshot and asks the user to reload after execution. V2 configuration remains through owner-signed contract calls/scripts; the v1 setup controls are hidden for an active V2 Guard. The v1 flow is preserved.

Radar reads `alertsOf(Safe)` once per loaded snapshot through the **same read client**, including its Nox route when active. It never queries a server for each recipient. Re-rendering does not repeat the request; explicitly reloading the Safe gets a new snapshot. An unavailable read is distinct from an empty result. No alert read controls the Guard or lowers a verdict.

The recorded consumer uses the public **simulation** forwarder. Every Radar banner labels this status, treats reports as advisory and makes no claim of DON-authenticated monitoring or current enforcement based on an old report. Its X-Ray and Sepolia trigger link inspect the downloaded data locally. A successful CRE simulation is still pending human login; there is no actual CRE-produced alert to demonstrate yet.

New V2 copy is English and marked `lang=en` even when the existing Hindi interface is selected. The established v1 Hindi strings are unchanged. Native review/translation of the new text remains a gap.

Tests include bulk-read assertions, v1 preservation, learned versus approved copy, date handling, V2 custom-error/forced-gas handling, synthetic resemblance wording and unavailable Radar state. The read-only browser check uses the actual isolated V2 Safe and deployed consumer at 375/1440 in light/dark. It sends no transactions and creates no alert fixtures. This does not substitute for a human wallet payment or a CRE simulation.
