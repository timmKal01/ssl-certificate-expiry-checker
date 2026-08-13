import tls from 'node:tls';

const TIMEOUT_MS = 8000;

export function parseHostPort(entry) {
    const trimmed = entry.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const idx = trimmed.lastIndexOf(':');
    if (idx > -1 && /^\d+$/.test(trimmed.slice(idx + 1))) {
        return { host: trimmed.slice(0, idx), port: Number(trimmed.slice(idx + 1)) };
    }
    return { host: trimmed, port: 443 };
}

function parseSubjectAltNames(sanString) {
    if (!sanString) return [];
    return sanString.split(',').map((s) => s.trim());
}

function connectTls(host, port) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect(
            { host, port, servername: host, timeout: TIMEOUT_MS, rejectUnauthorized: false },
            () => {
                const cert = socket.getPeerCertificate();
                const authorized = socket.authorized;
                const authorizationError = socket.authorizationError;
                socket.end();
                if (!cert || Object.keys(cert).length === 0) {
                    reject(new Error('No certificate returned by host'));
                    return;
                }
                resolve({ cert, authorized, authorizationError });
            },
        );
        socket.on('error', (err) => reject(err));
        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timed out'));
        });
    });
}

export async function checkCertificate(entry) {
    const { host, port } = parseHostPort(entry);
    const { cert, authorized, authorizationError } = await connectTls(host, port);

    const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
    const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
    const daysUntilExpiration = validTo ? Math.round((validTo.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;

    return {
        host,
        port,
        reachable: true,
        subjectCN: cert.subject?.CN ?? null,
        issuerCN: cert.issuer?.CN ?? null,
        issuerO: cert.issuer?.O ?? null,
        validFrom: validFrom ? validFrom.toISOString() : null,
        validTo: validTo ? validTo.toISOString() : null,
        daysUntilExpiration,
        isExpired: validTo ? validTo.getTime() < Date.now() : null,
        isSelfSigned: cert.issuer?.CN && cert.subject?.CN ? cert.issuer.CN === cert.subject.CN : null,
        trustedByNode: authorized === true,
        trustError: authorized ? null : authorizationError?.message ?? null,
        subjectAltNames: parseSubjectAltNames(cert.subjectaltname),
        fingerprint256: cert.fingerprint256 ?? null,
        error: null,
    };
}
