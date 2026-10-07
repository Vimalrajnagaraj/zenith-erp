          <details class="zc-morenav">
            <summary><i class="fa fa-th" style="font-size:12px"></i> More <span style="font-size:10px;opacity:.7">&#9662;</span></summary>
            <div class="zc-morenav-panel">
              <div class="zc-morenav-hd">Go to module</div>
              <#if showSales><a class="zc-morenav-item" href="${sri.buildUrl(contactsModuleNavPrefix + 'goSales').url}"><i class="fa fa-line-chart" style="color:#7C3AED"></i> Sales</a></#if>
              <#if showPurchase><a class="zc-morenav-item" href="${sri.buildUrl(contactsModuleNavPrefix + 'goPurchase').url}"><i class="fa fa-shopping-cart" style="color:#0D9488"></i> Purchase</a></#if>
              <#if showAccounting><a class="zc-morenav-item" href="${sri.buildUrl(contactsModuleNavPrefix + 'goAccounting').url}"><i class="fa fa-calculator" style="color:#10B981"></i> Accounting</a></#if>
              <#if showCrm><a class="zc-morenav-item" href="${sri.buildUrl(contactsModuleNavPrefix + 'goCrm').url}"><i class="fa fa-bullseye" style="color:#D97706"></i> CRM</a></#if>
              <#if showHr><a class="zc-morenav-item" href="${sri.buildUrl(contactsModuleNavPrefix + 'goHr').url}"><i class="fa fa-users" style="color:#DC2626"></i> HR</a></#if>
              <#if showMarketing><a class="zc-morenav-item" href="${sri.buildUrl(contactsModuleNavPrefix + 'goMarketing').url}"><i class="fa fa-bullhorn" style="color:#8E28ED"></i> Marketing</a></#if>
            </div>
          </details>
