import java.sql.*;

/** Read-only ground truth for captured disposable UI QA groups, never production. */
public class GroupDbProbe {
    private static String json(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 3 || !args[0].startsWith("jdbc:h2:"))
            throw new IllegalArgumentException("Expected isolated local H2 connection");
        try (Connection c = DriverManager.getConnection(args[0], args[1], args[2])) {
            c.setReadOnly(true);
            String[] ids = {"CGQA_EMPTY_A", "CGQA_POPULATED_A", "CGQA_FOREIGN_B"};
            StringBuilder out = new StringBuilder("{\"groups\":[");
            for (int i=0; i<ids.length; i++) {
                if (i>0) out.append(',');
                try (PreparedStatement p = c.prepareStatement("SELECT CUSTOMER_GROUP_ID, ORGANIZATION_PARTY_ID, GROUP_NAME, IS_ACTIVE, PAYMENT_TERMS, DESCRIPTION FROM CUSTOMER_GROUP WHERE CUSTOMER_GROUP_ID=?")) {
                    p.setString(1,ids[i]);
                    try (ResultSet r=p.executeQuery()) {
                        if (!r.next()) { out.append("null"); continue; }
                        out.append("{\"id\":").append(json(r.getString(1)))
                            .append(",\"org\":").append(json(r.getString(2)))
                            .append(",\"name\":").append(json(r.getString(3)))
                            .append(",\"active\":").append(json(r.getString(4)))
                            .append(",\"terms\":").append(json(r.getString(5)))
                            .append(",\"description\":").append(json(r.getString(6))).append('}');
                    }
                }
            }
            out.append("],\"members\":[");
            try (Statement s=c.createStatement(); ResultSet r=s.executeQuery("SELECT CUSTOMER_GROUP_ID, PARTY_ID, FROM_DATE, THRU_DATE FROM CUSTOMER_GROUP_MEMBER WHERE CUSTOMER_GROUP_ID IN ('CGQA_EMPTY_A','CGQA_POPULATED_A','CGQA_FOREIGN_B') ORDER BY CUSTOMER_GROUP_ID,PARTY_ID,FROM_DATE")) {
                boolean first=true;
                while(r.next()) {
                    if (!first) out.append(','); first=false;
                    out.append("{\"group\":").append(json(r.getString(1)))
                        .append(",\"party\":").append(json(r.getString(2)))
                        .append(",\"fromDate\":").append(json(r.getString(3)))
                        .append(",\"thruDate\":").append(json(r.getString(4))).append('}');
                }
            }
            out.append("],\"parties\":[");
            try (Statement s=c.createStatement(); ResultSet r=s.executeQuery("SELECT PARTY_ID, OWNER_PARTY_ID FROM PARTY WHERE PARTY_ID IN ('CITEST_A_CUST','CITEST_B_CUST') ORDER BY PARTY_ID")) {
                boolean first=true;
                while(r.next()) {
                    if (!first) out.append(','); first=false;
                    out.append("{\"id\":").append(json(r.getString(1)))
                        .append(",\"owner\":").append(json(r.getString(2))).append('}');
                }
            }
            out.append("]}");
            System.out.println(out);
        }
    }
}
