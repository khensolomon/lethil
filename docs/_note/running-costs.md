---
title: "Running costs"
description: "Monthly hosting figures used to size the move off GCE."
category: "Notes"
nav_order: 3
tags: [planning, migration]
---

Indicative monthly figures in USD, gathered while planning
[[Move off Google Cloud]]. Check current pricing before committing.

| Service | Monthly | Spec |
| :--- | ---: | :--- |
| VM | 18 | 2 vCPU, 2 GB RAM, 60 GB SSD, 3 TB transfer |
| VM | 24 | 2 vCPU, 4 GB RAM, 80 GB SSD, 4 TB transfer |
| VM | 48 | 4 vCPU, 8 GB RAM, 160 GB SSD, 5 TB transfer |
| Worker | 5 | — |
| R2 | 3 | — |

Combined: roughly $26, $32, or $56 per month depending on the VM tier.

The 2 GB tier is the working baseline. The current GCE instance uses about
1.3 GB of 4.9 GB, so 2 GB is adequate with headroom.

## Equipment

- Monitor — Samsung S34E790C, 3440x1440
