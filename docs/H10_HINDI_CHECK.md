# H10: Hindi check (one page)

A native Hindi speaker reads the two spec verdict lines below, then clicks हिन्दी on HexFence Pay and reads the rest of the page. Only the two lines below come from the spec; the other verdicts and the interface text (`apps/pay/src/i18n.ts`) were written by an AI on 6 Nov. Time needed: about 10 minutes.

## The two lines

Left: the text as the app uses it (`hindiText` in `apps/pay/src/verdictCopy.ts`). Right: the text in spec §3.4 (`docs/planning/10_FINAL_What_To_Build_HexFence.md`, "Hindi (P1)"). They are identical; the app only splits each line into sentences. `{payee}` is replaced by the approved payee's address.

| Verdict | In the app | Spec §3.4 | English meaning shown to the user |
|---|---|---|---|
| RED: resembles an approved payee | संभावित एड्रेस पॉइज़निंग: यह प्राप्तकर्ता आपके स्वीकृत प्राप्तकर्ता {payee} जैसा दिखता है (पहले 4 और आख़िरी 4 अक्षर समान), लेकिन यह अलग पता है। आपका सुरक्षित Safe यह भुगतान नहीं करेगा। | संभावित एड्रेस पॉइज़निंग: यह प्राप्तकर्ता आपके स्वीकृत प्राप्तकर्ता {payee} जैसा दिखता है (पहले 4 और आख़िरी 4 अक्षर समान), लेकिन यह अलग पता है। आपका सुरक्षित Safe यह भुगतान नहीं करेगा। | Possible address poisoning. This recipient resembles your approved payee {payee} (same first 4 and last 4 characters) but is a different address. Your protected Safe will refuse this payment. |
| AMBER: new recipient | नया प्राप्तकर्ता: यह आपके स्वीकृत प्राप्तकर्ताओं में नहीं है। HexFence इस भुगतान को नहीं रोकेगा। पूरा पता प्राप्तकर्ता से मिलाकर देखें। | नया प्राप्तकर्ता: यह आपके स्वीकृत प्राप्तकर्ताओं में नहीं है। HexFence इस भुगतान को नहीं रोकेगा। पूरा पता प्राप्तकर्ता से मिलाकर देखें। | New recipient: not one of your approved payees. HexFence will not block this payment. Check the full address with the recipient. |

If the Guard is not active on the Safe, the last RED sentence comes from `apps/pay/src/i18n.ts` instead of the spec, because the spec has no line for that case.

## AI pre-check (06 Nov 2026, Claude; not the native-speaker check)
Both lines are grammatical and say the same as the English column. Notes for the reviewer, no change made:
- "एड्रेस पॉइज़निंग" is English in Devanagari. Crypto users in India say it this way, so it is fine. "पता-धोखा" would be a pure-Hindi option, but it is less clear.
- "आपका सुरक्षित Safe" can read as "your secure Safe" rather than "your Safe that HexFence protects". If the reviewer wants that meaning, one option is "HexFence से सुरक्षित आपका Safe यह भुगतान नहीं करेगा।"
- "आख़िरी 4 अक्षर" is clear. "अंतिम 4 अक्षर" is more formal and means the same.
H10 stays open until a native speaker writes "checked by <name>, <date>".

## Questions for the reviewer

1. Does each line read naturally to an ordinary Hindi reader, and say the same as the English column?
2. Is "एड्रेस पॉइज़निंग" understood, or is there a better everyday phrase?
3. Is "सुरक्षित Safe" clear as "your protected Safe" (not read as "a safe/secure thing" in general)?
4. Is "आख़िरी 4 अक्षर" clear for the last 4 characters of an address?

## What the reviewer writes

- Fine as is: tell Dhruv "checked by <name>, <date>". Dhruv then sets the **T12** row in `docs/PROGRESS.md` to ✔ and adds "checked by <name>" in its notes cell, and ticks H10.
- Changes wanted: write the replacement text for each line. Change the Hindi strings in **both** `apps/pay/src/verdictCopy.ts` (`hindiText`) and the "Hindi (T12" test block in `apps/pay/test/pay.test.ts`, run `pnpm --filter @hexfence/pay test`, then do the same as above. Do not change the English.

## Message to forward

> Could you read two Hindi warning lines from our wallet-payment checker (a screenshot or the table above) and tell me if they are natural and correct? It takes about 5 minutes; I need "checked by <your name>" or your corrections.
> The two lines are the "looks like your saved payee but is a different address" warning and the "new recipient" notice.
