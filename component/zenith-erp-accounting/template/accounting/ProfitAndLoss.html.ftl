<#assign currencyFormat = currencyFormat!"#,##0.00;(#,##0.00)">
<#assign indentMult = indentMult!1>

<#macro showClass classInfo depth showLess=false scheduleRef="">
    <#if (classInfo.totalPostedNoClosingByTimePeriod['ALL']!0) == 0><#return></#if>
    <#if showLess><#assign negMult = -1><#else><#assign negMult = 1></#if>
    <tr class="<#if depth == 1>text-weight-bold bg-grey-2</#if>">
        <td style="padding-left: ${((depth-1) * indentMult) + 1}rem;">
            <#if scheduleRef != ""><strong>${scheduleRef}</strong> </#if>
            <#if depth == 1 && scheduleRef == ""><strong>&nbsp;&nbsp;&nbsp;&nbsp;</strong> </#if>
            ${ec.l10n.localize(classInfo.className)}
        </td>
        <#list displayTimePeriodIdList as timePeriodId>
            <#assign classPerAmount = (classInfo.postedNoClosingByTimePeriod[timePeriodId]!0)*negMult>
            <td class="text-right"><#if classPerAmount != 0>${Static["com.zenith.Fmt"].regroup(ec.l10n.format(classPerAmount, currencyFormat))}<#if (classPerAmount >= 0)>&nbsp;</#if><#else>-</#if></td>
        </#list>
    </tr>
    <#list classInfo.glAccountInfoList! as glAccountInfo>
        <#assign glAccountAllAmt = (glAccountInfo.postedNoClosingByTimePeriod['ALL']!0)*negMult>
        <#if glAccountAllAmt != 0>
            <tr class="text-grey-8">
                <td style="padding-left: ${(depth-1) * indentMult + (indentMult * 1.5) + 1}rem;">${glAccountInfo.accountCode}: ${glAccountInfo.accountName}</td>
                <#list displayTimePeriodIdList as timePeriodId>
                    <#assign currentAmt = (glAccountInfo.postedNoClosingByTimePeriod[timePeriodId]!0)*negMult>
                    <td class="text-right"><#if currentAmt != 0>${Static["com.zenith.Fmt"].regroup(ec.l10n.format(currentAmt, currencyFormat))}<#if (currentAmt >= 0)>&nbsp;</#if><#else>-</#if></td>
                </#list>
            </tr>
        </#if>
    </#list>
    <#list classInfo.childClassInfoList as childClassInfo>
        <@showClass childClassInfo depth+1 showLess/>
    </#list>
    <#if classInfo.childClassInfoList?has_content && depth != 1>
        <tr class="text-weight-medium bg-grey-1">
            <td style="padding-left: ${((depth-1) * indentMult) + 1}rem;">Total ${ec.l10n.localize(classInfo.className)}</td>
            <#list displayTimePeriodIdList as timePeriodId>
                <#assign currentAmt = (classInfo.totalPostedNoClosingByTimePeriod[timePeriodId]!0)*negMult>
                <td class="text-right">${Static["com.zenith.Fmt"].regroup(ec.l10n.format(currentAmt, currencyFormat))}<#if (currentAmt >= 0)>&nbsp;</#if></td>
            </#list>
        </tr>
    </#if>
</#macro>

<#if displayTimePeriodIdList?has_content && classInfoById?has_content>
<div class="q-markup-table q-table__container q-table__card q-table--horizontal-separator q-table--flat">
    <table class="q-table">
        <thead>
            <tr class="bg-indigo-8 text-white">
                <th class="text-left text-weight-bold" style="font-size: 1.1em;">Particulars</th>
                <#list displayTimePeriodIdList as timePeriodId>
                    <th class="text-right text-weight-bold" style="font-size: 1.1em;">${(timePeriodIdMap[timePeriodId].periodName)!"Unknown Period"} (INR)</th>
                </#list>
            </tr>
        </thead>
        <tbody>
            <@showClass classInfoById.REVENUE 1 false "I."/>
            <@showClass classInfoById.INCOME 1 false "II."/>
            
            <tr class="text-weight-bold text-primary bg-blue-1 text-subtitle2">
                <td style="padding-left: 1rem;">III. Total Revenue (I + II)</td>
                <#list displayTimePeriodIdList as timePeriodId>
                    <#assign revAmt = classInfoById.REVENUE.totalPostedNoClosingByTimePeriod[timePeriodId]!0>
                    <#assign incAmt = classInfoById.INCOME.totalPostedNoClosingByTimePeriod[timePeriodId]!0>
                    <#assign totalRev = revAmt + incAmt>
                    <td class="text-right">${Static["com.zenith.Fmt"].regroup(ec.l10n.format(totalRev, currencyFormat))}</td>
                </#list>
            </tr>

            <tr class="text-weight-bold bg-grey-3"><td colspan="${displayTimePeriodIdList?size + 1}" style="padding-left: 1rem;">IV. Expenses</td></tr>
            <@showClass classInfoById.COST_OF_SALES 2 true/>
            <@showClass classInfoById.EXPENSE 2 true/>
            <@showClass classInfoById.NON_OP_EXPENSE 2 true/>
            
            <tr class="text-weight-bold text-deep-orange bg-orange-1 text-subtitle2">
                <td style="padding-left: 1rem;">Total Expenses</td>
                <#list displayTimePeriodIdList as timePeriodId>
                    <#assign cogsAmt = (classInfoById.COST_OF_SALES.totalPostedNoClosingByTimePeriod[timePeriodId]!0) * -1>
                    <#assign expAmt = (classInfoById.EXPENSE.totalPostedNoClosingByTimePeriod[timePeriodId]!0) * -1>
                    <#assign nonOpAmt = (classInfoById.NON_OP_EXPENSE.totalPostedNoClosingByTimePeriod[timePeriodId]!0) * -1>
                    <#assign totalExp = cogsAmt + expAmt + nonOpAmt>
                    <td class="text-right">${Static["com.zenith.Fmt"].regroup(ec.l10n.format(totalExp, currencyFormat))}</td>
                </#list>
            </tr>

            <tr class="text-weight-bolder text-green-9 bg-green-1" style="font-size: 1.1em;">
                <td style="padding-left: 1rem;">V. Profit before Tax (III - IV)</td>
                <#list displayTimePeriodIdList as timePeriodId>
                    <#assign pbtAmt = netIncomeMap[timePeriodId]!0>
                    <td class="text-right">${Static["com.zenith.Fmt"].regroup(ec.l10n.format(pbtAmt, currencyFormat))}</td>
                </#list>
            </tr>
        </tbody>
    </table>
</div>
<#else>
<div class="q-pa-md text-center bg-orange-1 text-deep-orange text-weight-bold" style="border-radius: 8px;">
    No financial Time Periods found for this organization. Please create Fiscal Time Periods and post accounting transactions to view the Statement of Profit and Loss.
</div>
</#if>
