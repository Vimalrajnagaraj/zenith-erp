// Native adapter for existing Shops/My Subscription acceptance, never deployed.
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
public class ModuleFixtureDb {
    static String json(String value) { return value==null ? "null" : "\""+value.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r").replace("\t","\\t")+"\""; }
    public static void main(String[] args) throws Exception {
        String profile=System.getenv("MODULE_QA_PROFILE"),sql=new String(System.in.readAllBytes(),StandardCharsets.UTF_8).trim();
        if (!Set.of("shops","mysub").contains(profile) || !"true".equals(System.getenv("MODULE_QA_DISPOSABLE"))) throw new IllegalArgumentException("Explicit fixture profile required");
        try(Connection c=DriverManager.getConnection("jdbc:h2:tcp://127.0.0.1:19097/mem:purchase-pricing-qa;IFEXISTS=TRUE","sa","")) {
            String guard=profile.equals("shops")?"SELECT count(*) FROM store WHERE store_id='SHOP_QA_A_S1'":"SELECT count(*) FROM saas_tenant WHERE tenant_id='MYSUB_QA_A'";
            try(Statement s=c.createStatement();ResultSet r=s.executeQuery(guard)){r.next();if(r.getInt(1)!=1)throw new IllegalStateException("Synthetic fixture missing");}
            if(!sql.toUpperCase(Locale.ROOT).startsWith("SELECT ")) {
                c.setAutoCommit(false);
                for(String part:sql.split(";")) {
                    String normalized=part.trim().toLowerCase(Locale.ROOT);
                    boolean allowed=profile.equals("shops") ? normalized.startsWith("insert into store (") && part.contains("'SHOP_QA_LEGACY','Synthetic Legacy'") :
                            normalized.matches("(?s)update (user_account|saas_subscription|saas_invoice|saas_tenant) set .* where .*'mysub_qa_[a-z0-9_]+'(?: and status_id='SubActive')?".toLowerCase(Locale.ROOT)) ||
                            normalized.startsWith("insert into saas_invoice (") && part.contains("'MYSUB_QA_MANUAL1','MYSUB_QA_S'") && part.contains("'MYSUB_QA_MANUAL2','MYSUB_QA_S'") ||
                            normalized.matches("insert into company_settings \\(organization_party_id,setting_key,setting_value\\) values \\('zetaerp','razorpay_(webhook_secret|key_secret)','[a-f0-9]{64}'\\)");
                    if(!allowed)throw new IllegalArgumentException("Fixture mutation outside existing acceptance selectors");
                    try(Statement s=c.createStatement()){s.executeUpdate(part);}
                }
                c.commit();System.out.println("[]");return;
            }
            c.setReadOnly(true);
            try(Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)) {
                var md=r.getMetaData();var rows=new ArrayList<String>();
                while(r.next()){var fields=new ArrayList<String>();for(int i=1;i<=md.getColumnCount();i++)fields.add(json(md.getColumnLabel(i).toLowerCase(Locale.ROOT))+":"+json(r.getString(i)));rows.add("{"+String.join(",",fields)+"}");}
                System.out.println("["+String.join(",",rows)+"]");
            }
        }
    }
}
