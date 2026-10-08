# Security Policy

The Tako team takes the security and integrity of our self-hosted PaaS platform, user data, and infrastructure very seriously. We appreciate the efforts of security researchers and community members who identify and responsibly report vulnerabilities.

---

## Supported Versions

Only the latest active major/minor release of Tako receives active security patches and updates.

| Version | Supported          |
| ------- | ------------------ |
| `v1.x`  | :white_check_mark: |
| `< 1.0` | :x:                |

We strongly advise all operators running Tako in production environments to stay up to date with the latest stable releases.

---

## Reporting a Vulnerability

If you discover a security vulnerability in Tako, **please do not open a public GitHub issue, pull request, or discussion**.

Instead, please report the vulnerability privately through one of the following channels:

1. **GitHub Security Advisory (Preferred)**:
   - Go to the repository's **Security** tab.
   - Click on **Advisories** and select **Report a vulnerability**.
   - Fill in the details of the issue and submit.

2. **Security Email**:
   - Send an email to **[security@gettako.dev](mailto:security@gettako.dev)**.

### What to Include in Your Report

To help us triage and investigate the issue quickly, please include:
- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- The affected component (`server`, `agent`, `console`, or `deploy`).
- The Tako version or commit hash where the vulnerability was identified.
- Any suggested mitigations or patches (if available).

### Response SLA & Disclosure Timeline

- **Initial Acknowledgement**: Within **48 hours** of receiving the report.
- **Triage & Assessment**: Within **5 business days**, we will confirm the finding, assign a severity rating, and keep you informed.
- **Fix & Advisory Release**: We aim to release a patch and coordinated security advisory within **30 days** of triage.
- **Public Disclosure**: We practice **Coordinated Vulnerability Disclosure (CVD)**. We request that you refrain from publicly discussing or disclosing the vulnerability until a patch has been released.

---

## Security Architecture & Best Practices

Tako is designed with defense-in-depth principles:

### 1. Zero SSH Node Management
- Worker Nodes connect **outbound** to the Master Server via long-lived gRPC bidirectional streams (`StreamTasks`).
- The Master Server does **not** require inbound SSH credentials, private keys, or public IP exposure to Worker Nodes.
- Node enrollment is guarded by single-use, time-limited cryptographic enrollment tokens.

### 2. Multi-Factor Authentication & Passkeys
- Support for FIDO2/WebAuthn hardware keys and biometric passkeys.
- Time-based One-Time Password (TOTP 2FA) and bcrypt-hashed credentials.
- HTTP-only, `SameSite=Lax`, secure session cookies to prevent token theft and cross-site scripting (XSS) vectors.

### 3. Docker Isolation & Orchestration
- Master and Agent daemons interact with the Docker Engine via the official Docker Go SDK using the unix socket `/var/run/docker.sock`.
- Containers run on isolated Docker bridge networks (`tako-net`) by default.
- Dynamic Traefik routing files are written atomically using temporary files and directory fsyncs to prevent race conditions or corrupted configuration loads.

### 4. Reverse Proxy & TLS
- Traefik v3 acts as the edge entrypoint, terminating HTTPS with automated Let's Encrypt certificates (`acme.json` permissions restricted to `600`).
- Strict HSTS, CORS filtering, and TLS 1.2+ minimum protocols are enforced.

---

## Safe Harbor

We consider security research conducted in good faith under this policy to be authorized. We will not pursue legal action against researchers who:
- Make a good faith effort to avoid privacy violations, destruction of data, and service interruptions.
- Only interact with test environments or accounts they own.
- Do not exploit a vulnerability beyond what is needed to prove its existence.
- Adhere to the responsible disclosure process outlined above.

Thank you for helping keep Tako and its users safe!
