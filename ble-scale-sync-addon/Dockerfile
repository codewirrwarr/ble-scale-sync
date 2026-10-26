ARG BUILD_FROM
FROM ${BUILD_FROM}

# HA add-ons run as root (/data/ is root-owned by the Supervisor)
USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends jq curl \
    && rm -rf /var/lib/apt/lists/*

COPY run.sh /app/run.sh
# Next to the app on purpose: its `import 'yaml'` resolves from
# /app/node_modules, the same YAML library the app reads config.yaml with.
COPY addon-config.mjs /app/addon-config.mjs
RUN chmod +x /app/run.sh

# Fork only: Healthkeep S11 support on top of the pinned application image,
# until it is part of an upstream release (the script is a no-op then).
COPY patches/robi-s9-a7.mjs /tmp/robi-s9-a7.mjs
RUN node /tmp/robi-s9-a7.mjs /app/dist/scales/robi-s9.js && rm /tmp/robi-s9-a7.mjs

ENTRYPOINT ["tini", "--", "/app/run.sh"]
