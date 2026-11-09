"""Trust forwarded client IPs only from configured reverse-proxy peers."""

from ipaddress import ip_address, ip_network

from werkzeug.middleware.proxy_fix import ProxyFix


class TrustedProxyFix:
    def __init__(self, app, trusted_hops, trusted_proxy_cidrs):
        if not 1 <= trusted_hops <= 10:
            raise ValueError("trusted_hops deve estar entre 1 e 10.")
        if not trusted_proxy_cidrs:
            raise ValueError("Configure ao menos uma rede de proxy confiável.")
        try:
            self._trusted_networks = tuple(
                ip_network(cidr, strict=False) for cidr in trusted_proxy_cidrs
            )
        except ValueError as exc:
            raise ValueError("TRUSTED_PROXY_CIDRS contém uma rede inválida.") from exc

        self._proxy_fix = ProxyFix(
            app,
            x_for=trusted_hops,
            x_proto=0,
            x_host=0,
            x_port=0,
            x_prefix=0,
        )

    def __call__(self, environ, start_response):
        try:
            peer = ip_address(environ.get("REMOTE_ADDR", ""))
        except ValueError:
            peer = None

        trusted_peer = peer is not None and any(
            peer.version == network.version and peer in network
            for network in self._trusted_networks
        )
        if not trusted_peer:
            environ.pop("HTTP_X_FORWARDED_FOR", None)

        return self._proxy_fix(environ, start_response)
