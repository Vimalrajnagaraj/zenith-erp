package com.zenith;
import java.util.regex.*;
/** Indian lakh/crore digit grouping for ZetaERP. Java's DecimalFormat/locales cannot do 3-2-2 grouping,
 *  so we regroup an already-formatted number string. Pure, null-safe, idempotent (re-grouping an
 *  Indian-grouped string is a no-op). Only call on CURRENCY/amount output (a bare year "2026" -> "2,026").
 *  - static regroup(...)  : for FreeMarker macro   ${Static['com.zenith.Fmt'].regroup(x)}
 *  - INSTANCE.inr(...)    : for a shared context var 'zinr', callable identically from Groovy AND FreeMarker. */
public final class Fmt {
    public static final Fmt INSTANCE = new Fmt();
    private Fmt(){}
    private static final Pattern NUM = Pattern.compile("([0-9][0-9,]*)([.][0-9]+)?");
    static String grp(String s){
        if (s == null || s.length() <= 3) return s;
        String last3 = s.substring(s.length()-3), rest = s.substring(0, s.length()-3);
        StringBuilder sb = new StringBuilder(); int c = 0;
        for (int i = rest.length()-1; i >= 0; i--){ sb.append(rest.charAt(i)); c++; if (c%2==0 && i!=0) sb.append(','); }
        return sb.reverse().toString() + "," + last3;
    }
    public static String regroup(Object in){
        if (in == null) return "";
        String s = in.toString();
        if (s.isEmpty()) return s;
        try {
            Matcher m = NUM.matcher(s); StringBuffer out = new StringBuffer();
            while (m.find()){
                String intp = m.group(1).replace(",",""), dec = m.group(2)==null?"":m.group(2);
                m.appendReplacement(out, Matcher.quoteReplacement(grp(intp)+dec));
            }
            m.appendTail(out); return out.toString();
        } catch (Exception e){ return s; }
    }
    /** instance alias for the shared 'zinr' context var (works in both Groovy and FreeMarker) */
    public String inr(Object in){ return regroup(in); }
}
