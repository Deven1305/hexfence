# H9 human review

1. Open `apps/detector/labels/h9-review.html` in a browser; enter your name and choose `h9-sample.csv` from the same folder. Imported labels and notes are discarded.
2. Open both Etherscan transaction links for each row. Compare the impersonated and lookalike addresses; the first 4 and last 4 hex characters are highlighted.
3. Use `h9-evidence.md` as the facts sheet: check the victim’s reference payment to the impersonated address, the different lookalike with matching first/last 4 hex characters, what the attack moved, its sender/recipient and Transfer logs. A true positive is a row you judge to be address poisoning from those facts; the facts sheet itself does not assign labels.
4. Choose `yes`, `no` or `unsure` yourself. The AI does not supply your answers.
5. Download the answers CSV and summary before closing the tab. Allow both downloads if the browser asks. Nothing is saved automatically.
6. Precision is `yes / (yes + no)` from your answers only; `unsure` and unanswered rows are excluded. An incomplete review is marked as such.
7. To check an exported CSV: `corepack pnpm@10.34.9 --filter @hexfence/detector precision --sheet "C:/path/to/h9-human-labels.csv"`.
