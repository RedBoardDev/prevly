# Image for the prevly daemon. The binary is provided by goreleaser; this image
# only adds the runtime dependencies the daemon shells out to.
#
# The daemon drives the HOST Docker daemon, so run it with the host docker
# socket mounted (the socket is mounted into the DAEMON only, never previews):
#   docker run -v /var/run/docker.sock:/var/run/docker.sock \
#     -v /etc/prevly:/etc/prevly -v /var/lib/prevly:/var/lib/prevly \
#     -p 80:80 -p 443:443 --env-file /etc/prevly/prevly.env ghcr.io/redboarddev/prevly
FROM alpine:3.20

RUN apk add --no-cache ca-certificates git docker-cli

COPY prevly /usr/local/bin/prevly

ENTRYPOINT ["/usr/local/bin/prevly"]
CMD ["run"]
