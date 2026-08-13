import { Actor, log } from 'apify';
import { checkCertificate, parseHostPort } from './tls.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { hosts = [] } = input;

if (hosts.length === 0) {
    throw new Error('No hosts provided.');
}

/** Must match the event name configured in this Actor's pay-per-event pricing on Apify. */
const CERT_CHECKED_EVENT = 'cert-checked';

for (const entry of hosts) {
    let record;
    try {
        record = await checkCertificate(entry);
    } catch (err) {
        const { host, port } = parseHostPort(entry);
        record = {
            host,
            port,
            reachable: false,
            subjectCN: null,
            issuerCN: null,
            issuerO: null,
            validFrom: null,
            validTo: null,
            daysUntilExpiration: null,
            isExpired: null,
            isSelfSigned: null,
            trustedByNode: null,
            trustError: null,
            subjectAltNames: [],
            fingerprint256: null,
            error: err.message,
        };
        log.warning(`Could not retrieve certificate`, { host: entry, error: err.message });
    }

    await Actor.pushData(record);
    await Actor.charge({ eventName: CERT_CHECKED_EVENT });

    log.info(`Checked host`, { host: record.host, reachable: record.reachable, daysUntilExpiration: record.daysUntilExpiration });
}

await Actor.exit();
