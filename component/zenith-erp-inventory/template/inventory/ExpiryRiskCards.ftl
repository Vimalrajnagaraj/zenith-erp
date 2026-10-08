<div class="er-stats">
  <article class="er-stat er-risk">
    <div class="er-stat-title">Value at Risk (Next 90 days) <span title="Available stock expiring today through 90 calendar days; valued at cost when recorded." aria-label="Value at risk information">ⓘ</span></div>
    <strong class="er-stat-value">${(currSymbol!'₹')?html}${vaRValueDisp?html}</strong>
    <div>${vaRItems} items &nbsp;•&nbsp; ${vaRUnitsDisp?html} units</div>
    <span class="er-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v6m0 3v.1"/></svg></span>
    <details><summary>View details</summary><p>Includes today through day 90. Expired stock is shown separately. Retail estimates and unvalued lots are marked in the table.</p></details>
  </article>
  <article class="er-stat er-expired">
    <div class="er-stat-title">Expired <span title="Stock whose expiry date is before today in your account time zone." aria-label="Expired stock information">ⓘ</span></div>
    <strong class="er-stat-value">${(currSymbol!'₹')?html}${expiredValueDisp?html}</strong>
    <div>${expiredCount} items &nbsp;•&nbsp; ${expiredUnitsDisp?html} units</div>
    <span class="er-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg></span>
    <details><summary>View details</summary><p>Expired lots still in available stock. Use Edit to correct a date, or record an expiry write-off. Reserved and serialized stock remain protected.</p></details>
  </article>
</div>
