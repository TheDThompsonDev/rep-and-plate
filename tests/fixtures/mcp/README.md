# Frozen deployed MCP card

`coaching-b34d29c.html` is the exact static HTML advertised as `ui://rep-and-plate/coaching-c045f8ff1d97819f.html` by production commit `b34d29cc538b11dca5ce6982a8842ce18e239924`.

SHA-256: `c045f8ff1d97819fbb0e74d27800bc33cdcb94d2959f3a952a30e234cf7a6836`.

It was generated from that commit's `coaching-app.ts` with unchanged banner/style/pose dependencies. It contains static renderer code and artwork, no account records or credentials. Keep its bytes frozen: upgrading the fixture would erase the backwards-compatibility consumer that caught the missing-Spot regression.

The browser regression first gives this cached card the broken payload shape (Spot only in metadata), then restores current responses and clicks its existing Refresh plan button. The same page, HTML and SDK connection recover Spot without fetching a new resource. The same frozen view also exercises report, explicit approval, persistence once and refresh.
