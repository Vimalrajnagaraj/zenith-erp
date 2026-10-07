import java.sql.*;

/** SELECT-only probe of the captured disposable PR13 contacts. Credentials stay in the environment. */
public class ContactsDbProbe {
    private static String json(String s) {
        return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
    }
    public static void main(String[] args) throws Exception {
        String url = System.getenv("CONTACTS_QA_DB_URL");
        if (url == null || !url.matches("jdbc:h2:tcp://(127\\.0\\.0\\.1|localhost):19093/.*"))
            throw new IllegalArgumentException("Only isolated local H2 TCP19093 is allowed");
        if (!url.toUpperCase().contains("IFEXISTS=")) url += ";IFEXISTS=TRUE";
        try (Connection c = DriverManager.getConnection(url, System.getenv("CONTACTS_QA_DB_USER"), System.getenv("CONTACTS_QA_DB_PASSWORD"))) {
            c.setReadOnly(true);
            StringBuilder out = new StringBuilder("[");
            boolean first = true;
            try (PreparedStatement p = c.prepareStatement("SELECT P.PARTY_ID,P.OWNER_PARTY_ID,P.DISABLED,N.FIRST_NAME,N.LAST_NAME FROM PARTY P JOIN PERSON N ON N.PARTY_ID=P.PARTY_ID WHERE P.PARTY_ID LIKE 'PR13QA_A_%' OR P.PARTY_ID LIKE 'PR13QA_B_%' ORDER BY P.PARTY_ID"); ResultSet r = p.executeQuery()) {
                while (r.next()) {
                    if (!first) out.append(','); first = false;
                    out.append("{\"id\":").append(json(r.getString(1))).append(",\"owner\":").append(json(r.getString(2)))
                        .append(",\"disabled\":").append(json(r.getString(3))).append(",\"first_name\":").append(json(r.getString(4)))
                        .append(",\"last_name\":").append(json(r.getString(5))).append('}');
                }
            }
            System.out.println(out.append(']'));
        }
    }
}
