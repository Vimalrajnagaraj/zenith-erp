import java.sql.*;
import java.nio.charset.StandardCharsets;
public class ContactSecurityDbProbe {
    static String json(String value) {
        if(value==null)return "null";
        return "\""+value.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r").replace("\t","\\t")+"\"";
    }
    public static void main(String[] args) throws Exception {
        String url=System.getenv("CONTACTS_QA_DB_URL");
        if(url==null||!url.startsWith("jdbc:h2:tcp://127.0.0.1:19094/")||!url.toUpperCase().contains("IFEXISTS=TRUE"))throw new IllegalArgumentException("Native probe requires this task's existing loopback database");
        String sql=new String(System.in.readAllBytes(),StandardCharsets.UTF_8).trim();
        boolean bootstrap=args.length>0&&args[0].equals("bootstrap");
        if(!bootstrap&&!sql.toUpperCase().startsWith("SELECT "))throw new IllegalArgumentException("Read-only probe accepts SELECT only");
        if(bootstrap&&(!sql.startsWith("UPDATE user_account SET current_password=")||!sql.contains("user_id IN ('CITEST_P14_USER_A','CITEST_P14_USER_NULL','CITEST_P14_USER_EMPTY','CITEST_P14_USER_NA')")))throw new IllegalArgumentException("Bootstrap must target the four captured disposable accounts");
        try(var connection=DriverManager.getConnection(url,System.getenv().getOrDefault("CONTACTS_QA_DB_USER","sa"),System.getenv().getOrDefault("CONTACTS_QA_DB_PASSWORD",""))) {
            connection.setReadOnly(!bootstrap);
            try(var statement=connection.createStatement()) {
                if(bootstrap){int updated=statement.executeUpdate(sql);if(updated!=4)throw new IllegalStateException("Expected four disposable accounts");System.out.println("[]");return;}
                try(var rows=statement.executeQuery(sql)) {
                    var meta=rows.getMetaData();var output=new StringBuilder("[");boolean first=true;
                    while(rows.next()){if(!first)output.append(',');first=false;output.append('{');for(int i=1;i<=meta.getColumnCount();i++){if(i>1)output.append(',');output.append(json(meta.getColumnLabel(i).toLowerCase())).append(':').append(json(rows.getString(i)));}output.append('}');}
                    System.out.println(output.append(']'));
                }
            }
        }
    }
}
