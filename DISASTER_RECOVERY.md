# SchoolOS — Disaster Recovery (DR) & Business Continuity Runbook

## 1. Overview & Objectives

This document establishes the official **Disaster Recovery (DR) Runbook** and **Multi-Region Continuity Strategy** for the SchoolOS educational SaaS platform.

### Key Operational Metrics (SLAs)

| Metric | Target SLA | Implementation Strategy |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | $< 6$ Hours / Continuous PITR | Automated cross-region sync (`db:dr:sync`) + Neon continuous WAL point-in-time archiving. |
| **RTO (Recovery Time Objective)** | $< 5$ Minutes | Zero-downtime connection string rotation on Vercel deployment variables. |
| **Data Integrity Guarantee** | 100% Referential Integrity | Strict foreign-key ordered replication + versioned Prisma migrations. |

---

## 2. Infrastructure Architecture & Topology

```
                   ┌────────────────────────────────────────┐
                   │    Next.js 15 App (Vercel Edge / R/W)  │
                   └──────────────────┬─────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │ (Normal Operation: DATABASE_URL)        │
                 ▼                                         ▼ (Failover State)
┌─────────────────────────────────┐       ┌──────────────────────────────────┐
│ Primary Database (AWS us-east-1) │       │ Standby Database (AWS ap-se-1)   │
│ Endpoint: ep-hidden-dust-apuep..│──────▶│ Endpoint: ep-ancient-mountain-.. │
│ Type: Serverless Postgres Pool  │  Sync │ Type: Serverless Postgres Pool   │
└─────────────────────────────────┘       └──────────────────────────────────┘
```

* **Primary Database (Active):** AWS `us-east-1` (US East)
* **Standby Replica (Hot Standby):** AWS `ap-southeast-1` (Singapore)

---

## 3. Disaster Severity Classification

| Severity | Definition | Action Trigger |
| :--- | :--- | :--- |
| **P0 — Catastrophic Regional Outage** | Primary cloud region (`us-east-1`) is unreachable or down for $>10$ minutes. | **Execute Section 4 (Emergency Regional Failover)**. |
| **P1 — Data Corruption / Bad Deployment** | Unintended bulk deletion or logic error corrupted production data. | **Execute Section 6 (Point-in-Time Recovery - PITR)**. |
| **P2 — Degraded Latency / Pooler Exhaustion** | Transient connection spikes or degraded response times $>2000$ms. | Restart connection pooler / failover if persistent. |

---

## 4. Emergency Failover Runbook (Step-by-Step)

When a P0 Regional Outage is confirmed:

### Step 1: Promote Standby Database in Vercel

1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Navigate to **SchoolOS Project** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**.
3. Update the following environment variables:
   * **`DATABASE_URL`**:
     ```
     postgresql://neondb_owner:npg_IsfnBPE47gJD@ep-ancient-mountain-az0n8sz3-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
   * **`DIRECT_URL`**:
     ```
     postgresql://neondb_owner:npg_IsfnBPE47gJD@ep-ancient-mountain-az0n8sz3.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
4. Click **Save**.

### Step 2: Trigger Instant Redeployment / Rollout

1. Go to **Deployments** tab $\rightarrow$ Click the latest production deployment $\rightarrow$ Select **Redeploy**.
2. Deployment will complete in $\approx 60$ seconds with traffic routed directly to the `ap-southeast-1` standby cluster.

### Step 3: Verify Application Health

1. Check system health endpoint:
   ```bash
   curl -I https://<your-domain>/api/health
   ```
2. Verify HTTP `200 OK` and inspect database latency metrics.

---

## 5. Routine Backup & Sync Operations

### Cross-Region Data Replication
Run the automated sync tool to replicate all active tenant records from Primary to Standby:

```bash
# Perform foreign-key safe cross-region sync:
pnpm db:dr:sync

# Check row count parity across all 28 tables:
pnpm db:dr:verify

# Export an offline JSON snapshot:
pnpm db:dr:dump
```

### Automated Synchronization Schedule
It is recommended to run `pnpm db:dr:sync` via a scheduled GitHub Action or cron job (e.g. every 6 hours):

```yaml
# .github/workflows/db-backup-sync.yml
name: Cross-Region Database Backup Sync
on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm db:dr:sync
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
          BACKUP_DATABASE_URL: ${{ secrets.BACKUP_DATABASE_URL }}
          BACKUP_DIRECT_URL: ${{ secrets.BACKUP_DIRECT_URL }}
```

---

## 6. Point-in-Time Recovery (PITR)

Neon PostgreSQL automatically maintains continuous WAL history for up to 30 days.

To restore state to a specific timestamp before an accidental drop or corruption:
1. Open Neon Console $\rightarrow$ Select Project.
2. Go to **Branches** $\rightarrow$ Click **Create Branch**.
3. Choose **Point in Time** and select the timestamp (down to the second).
4. Update `DATABASE_URL` to point to the newly branched restore point.

---

## 7. Failback Procedure (Post-Incident)

Once the primary region (`us-east-1`) is restored and verified:

1. Put application into brief Maintenance Mode.
2. Reverse sync delta changes from Standby (`ap-southeast-1`) back to Primary (`us-east-1`).
3. Point `DATABASE_URL` back to the Primary cluster on Vercel.
4. Redeploy application and verify `/api/health`.
