# SSL Certificate Expiry Checker — Live TLS Cert Status

Check the live TLS certificate actually installed on a host: issuer,
subject, valid dates, days until expiry, and whether it's expired or
self-signed. Connects directly over TLS, the same way a browser would —
not a WHOIS/registration lookup, and not a certificate-transparency-log
search, but the real cert being served right now.

Built for ops and IT teams checking a list of hosts for certs approaching
expiry, before it causes an outage.

## Input

```json
{
  "hosts": ["google.com", "example.com:8443"]
}
```

| Field | Type | Description |
|---|---|---|
| `hosts` | array of strings | Hostnames to check, without protocol. Add `:port` for a non-standard port (default `443`). One check is billed per host. |

## Output

One record per host:

```json
{
  "host": "google.com",
  "port": 443,
  "reachable": true,
  "subjectCN": "*.google.com",
  "issuerCN": "WR2",
  "issuerO": "Google Trust Services",
  "validFrom": "2026-07-21T08:32:00.000Z",
  "validTo": "2026-10-13T08:31:59.000Z",
  "daysUntilExpiration": 61,
  "isExpired": false,
  "isSelfSigned": false,
  "trustedByNode": true,
  "trustError": null,
  "trustFailureReason": null,
  "chainComplete": true,
  "terminalIssuerTrusted": true,
  "subjectAltNames": ["DNS:*.google.com", "DNS:google.com"],
  "fingerprint256": "AB:CD:...",
  "error": null
}
```

A host that can't be reached (wrong port, connection refused, DNS
failure) returns `"reachable": false` with an `error` message instead —
still billed once, since a completed check is the result either way.

When `trustedByNode` is `false`, `trustFailureReason` says which of three
different repairs is needed, instead of leaving you to parse
`trustError`'s raw string yourself:

| `trustFailureReason` | Meaning | Fix |
|---|---|---|
| `self-signed-leaf` | The host's own certificate is self-signed | Replace it with one from a real CA |
| `chain-incomplete` | The server didn't send an intermediate certificate | Fix the server's TLS config |
| `unknown-root` | The chain is complete but terminates at a root this Node install doesn't have bundled | Not a server problem — the client's trust store is stale or the CA is niche/private |
| `other` | Chain terminates at a known, trusted root, but something else failed (e.g. expired somewhere in the chain) | See `trustError` for detail |

`chainComplete` and `terminalIssuerTrusted` are the raw signals behind
that classification, computed by walking the certificate chain the
server actually sent (via `issuerCertificate` links) and checking the
terminal certificate's fingerprint against Node's own bundled root CAs,
rather than by parsing Node's `authorizationError` message text.

## How it works

Opens a direct TLS connection to each host and reads the certificate the
server presents, the same handshake a browser performs. No proxy, no key,
no scraping — just the TLS protocol itself.

## Pricing note

Billed per **host checked**, not per field returned — one charge per host
whether it's reachable or not.

## Related products

- [Domain Expiration Tracker](https://github.com/timmKal01/domain-expiration-tracker) — domain *registration* expiry via RDAP, a different expiry date than the TLS cert
- [Certificate Transparency Monitor](https://github.com/timmKal01/certificate-transparency-monitor) — new certs issued for a domain across the public CT logs, rather than the one currently live
