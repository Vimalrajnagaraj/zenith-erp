# Advanced POS cart reference alignment

The supplied reference is the source for the Advanced bill-item list: Item/Rate/Qty/Amount headers, compact white rows, borderless price inputs, coloured Retail/Wholesale/Custom mode chips, quiet quantity controls and plain red trash icons. The scan field stays visible below the last-bill strip; the existing payable has an angled purple amount surface. Long tables retain local scrolling on small screens.

All overrides are scoped to `.Terminal.pos-mode-advanced` and the checkout root. Normal billing, catalogue, header, payment actions and shared ERP navigation retain their existing presentation. Native and AJAX rows use the same styles. Existing price/quantity/mode/remove handlers, POST parameters, tax calculations, payment/rounding/offline engine and stored totals are unchanged. Product/rate inputs remain editable and focus outlines stay visible. Mode colour is presentation metadata derived from the selected label, never a pricing decision.

The local disposable POS_QA browser test verified quantity entry and decrement, manual price Enter, Wholesale and Custom mode changes, and the trash control; independent SQL checks verified persisted quantities, rates, modes, amounts and removal. No payments or numbered fixture bills were created. The 390px document stayed 390px wide; the 622px cart table scrolls in its 364px container. Images use synthetic records, not the reference's actual business data. Before/after captures use the same fixture products; interaction evidence additionally shows changed modes, quantities and one removed row.

Remaining native/browser verification was interrupted when the Mac locked. Full CI, final measured review and teardown must be recorded before readiness. Physical scanner/printer/payment hardware and Safari are not certified by Chromium checks. Actual source amounts are retained: no reference amount, last bill or save timestamp is fabricated.

The mode-card delete feature is tracked separately. This change does not deploy to production; maintainer review and the billing deployment gate remain required.
