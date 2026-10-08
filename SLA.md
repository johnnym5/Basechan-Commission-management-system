# Service Level Agreement (SLA) & Uptime Guarantee

*Effective Date: October 2026*

This Service Level Agreement ("SLA") outlines the performance and availability commitments for Basechan CMS.

## 1. System Uptime Commitment

- **Target Availability:** Basechan CMS aims for **99.95% Monthly Uptime** for web hosting and database query operations.
- **Infrastructure:** Built on Google Cloud Platform and Firebase multi-region infrastructure with automated failover and edge CDN delivery.

## 2. Maintenance Windows

- Planned maintenance is scheduled during off-peak hours (Saturdays 02:00 – 04:00 UTC).
- Scheduled maintenance notices are posted in the system dashboard at least **48 hours** in advance.
- Emergency security patches are applied immediately without advance notice if critical vulnerabilities arise.

## 3. Incident Response Times

| Severity Level | Description | Target First Response | Target Resolution / Mitigation |
|---|---|---|---|
| **P1 - Critical** | System completely unavailable; database queries failing for all users. | < 1 hour | < 4 hours |
| **P2 - High** | Major feature unavailable (e.g. Excel upload failing, role sync down). | < 2 hours | < 8 hours |
| **P3 - Normal** | Non-critical bug or minor display issue; workaround available. | < 12 hours | < 2 business days |

## 4. Exclusions

The SLA uptime calculation excludes downtime caused by:

- User network or ISP connectivity failures.
- Force majeure events outside reasonable control.
- Suspensions resulting from breach of Terms of Service.

## 5. Contact & Status Reports

System Operations & Support  
Email: support@basechaninternational.com
