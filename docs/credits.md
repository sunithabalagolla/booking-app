# Credits – Talkies

Outside files used in the app, with their source and licence (Section 16.6 asks for this list).

## Fonts in the PDFs (U-17 ticket + GST invoice)

The server puts these font files into the ticket and invoice PDFs (pdfkit). They are in `server/assets/fonts/`, each with its licence text next to it. Added 2026-10-07.

| Font | Files | Used for | Licence | Source |
| --- | --- | --- | --- | --- |
| Rye | `Rye-Regular.ttf` | Headings ("TALKIES", movie title) | SIL Open Font License 1.1 (`Rye-OFL.txt`). Copyright 2011 Sorkin Type Co, Reserved Font Name "Rye" | github.com/google/fonts `ofl/rye` |
| Special Elite | `SpecialElite-Regular.ttf` | Typewriter labels | Apache License 2.0 (`SpecialElite-LICENSE.txt`) | github.com/google/fonts `apache/specialelite` |
| Courier Prime | `CourierPrime-Regular.ttf`, `CourierPrime-Bold.ttf` | Details, numbers, table | SIL Open Font License 1.1 (`CourierPrime-OFL.txt`). Copyright 2015 The Courier Prime Project Authors | github.com/google/fonts `ofl/courierprime` |
| Noto Sans | `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf` | Every text with the ₹ sign (the 3 fonts above have no ₹) | SIL Open Font License 1.1 (`NotoSans-OFL.txt`). Copyright 2022 The Noto Project Authors | github.com/notofonts (`notofonts.github.io`, hinted TTF) |

- OFL and Apache 2.0 both allow using and shipping the fonts inside an app and inside made PDFs. The licence text must stay with the font files (done).
- The web pages load Rye, Special Elite and Courier Prime from Google Fonts (UI-03); no files are kept in the client.

## Sounds (UI-40)

None yet (Phase 10).
