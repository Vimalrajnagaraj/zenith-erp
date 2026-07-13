#!/bin/sh
# ZE-SEC-JSON f/u (2026-07-13) — restore Moqui ES-backed search against OpenSearch 2.15.
#
# Symptom: EVERY org.moqui.search.SearchServices.search#DataDocuments call threw
#   org.moqui.BaseException: Error calling HTTP request to http://opensearch:9200/<index>/_search
#   Caused by: org.eclipse.jetty.http.BadMessageException: 400: BAD_QUOTES_IN_TOKEN
# so all ElasticSearch-backed search (party pickers, any DataDocument search box) silently
# returned nothing. NOT an outage — OpenSearch is up, reachable, and indexed; indexing/writes work.
#
# Root cause: OpenSearch 2.15 adds a non-standard *response* header to /_search:
#   TASK_RESOURCE_USAGE: {"action":"...","taskResourceUsage":{...}}
# whose value is raw JSON containing double-quotes. Moqui's Jetty HTTP client (RestClient) parses
# the response strictly (RFC 7230) and rejects that header as BAD_QUOTES_IN_TOKEN. Elasticsearch
# never sent this header; it is OpenSearch-specific and emitted whenever the DYNAMIC cluster setting
# task_resource_tracking.enabled is true (it was true here; note task_resource_consumers.enabled was
# already false — that is a DIFFERENT setting and is NOT the one that emits the header).
#
# Fix: disable task_resource_tracking. It is a dynamic cluster setting (no OpenSearch restart) and
# feeds only search-backpressure/telemetry (search_backpressure.mode here is "monitor_only", so
# nothing enforced). Persistent so it survives a cluster restart. Fully reversible:
#   curl -XPUT .../_cluster/settings -d '{"persistent":{"task_resource_tracking.enabled":null}}'
#
# A more durable backstop (survives future OpenSearch upgrades re-adding such headers) is the
# Moqui-side option: relax the Jetty response-parsing compliance in the framework RestClient. Not
# applied — see docs/infra/framework-patches for that route if this needs revisiting.
#
# NOTE: a persistent cluster setting lives in OpenSearch cluster metadata (the data volume), NOT in
# opensearch.yml/compose — so RE-RUN THIS SCRIPT if the OpenSearch data volume is ever recreated.
#
# Usage: disable-task-resource-tracking.sh            # runs against the opensearch container
#        ES=http://host:9200 disable-task-resource-tracking.sh   # or an explicit endpoint via curl
set -e
ES="${ES:-http://localhost:9200}"

# Prefer running inside/against the opensearch container (has curl). If curl is absent, fall back to
# wget (the moqui container has wget but not curl).
put() {
  if command -v curl >/dev/null 2>&1; then
    curl -s -XPUT "$ES/_cluster/settings" -H "Content-Type: application/json" \
      -d '{"persistent":{"task_resource_tracking.enabled":false}}'
  else
    wget -qO- --method=PUT --header="Content-Type: application/json" \
      --body-data='{"persistent":{"task_resource_tracking.enabled":false}}' "$ES/_cluster/settings"
  fi
}
get_headers() {
  if command -v curl >/dev/null 2>&1; then
    curl -s -D - -o /dev/null -XPOST "$ES/mantle_party/_search" -H "Content-Type: application/json" -d '{"size":0}'
  else
    wget -S -qO- --post-data='{"size":0}' --header="Content-Type: application/json" "$ES/mantle_party/_search" 2>&1
  fi
}

echo "disable-task-resource-tracking: applying to $ES ..."
put; echo
# Self-verify: the TASK_RESOURCE_USAGE header must be gone from a /_search response.
if get_headers | grep -qi 'TASK_RESOURCE_USAGE'; then
  echo "disable-task-resource-tracking: FAILED — TASK_RESOURCE_USAGE header still present on _search." >&2
  exit 1
fi
echo "disable-task-resource-tracking: OK — TASK_RESOURCE_USAGE header no longer present; ES search restored."
