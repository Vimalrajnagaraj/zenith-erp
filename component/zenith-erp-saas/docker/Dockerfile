FROM eclipse-temurin:21-jre-alpine

LABEL maintainer="Zenith ERP <admin@zenitherp.com>"
LABEL description="ZenithERP SaaS - Retail & Wholesale ERP"

WORKDIR /opt/zenith

COPY moqui.war .
COPY runtime runtime

RUN mkdir -p runtime/log runtime/txlog runtime/sessions runtime/db && \
    addgroup -S zenith && adduser -S zenith -G zenith && \
    chown -R zenith:zenith /opt/zenith

USER zenith

EXPOSE 8080

ENV ZENITH_PORT=8080 \
    ZENITH_DB_HOST=postgres \
    ZENITH_DB_PORT=5432 \
    ZENITH_DB_NAME=zenith_saas \
    ZENITH_DB_USER=zenith \
    ZENITH_DB_PASSWORD=changeme \
    ZENITH_CRYPT_PASS=ZenithSaaSEncKey:CHANGEME \
    JAVA_OPTS="-Xms512m -Xmx2g -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -Djava.security.egd=file:/dev/./urandom"

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:${ZENITH_PORT}/status || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar moqui.war conf=conf/MoquiProductionConf.xml port=$ZENITH_PORT"]
