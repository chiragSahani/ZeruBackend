<p align="center">
  <img src="https://your-logo-url.com/logo.png" alt="EigenLayer Restaking Backend" width="200"/>
</p>

<h1 align="center">EigenLayer Restaking Data Backend</h1>

<p align="center">
  <b>Aggregate and expose EigenLayer restaking data via a powerful REST API</b><br/>
  <img src="https://img.shields.io/badge/Node.js-16%2B-brightgreen" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" />
</p>

---

## 🚀 Quick Links

- [Features](#-features)
- [API Endpoints](#-api-endpoints)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Architecture](#-architecture)
- [Data Pipeline](#-data-pipeline)
- [API Examples](#-api-response-examples)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Features

- ⚡ **RESTful API** for EigenLayer restaking data
- 🔄 **Real-time Data Aggregation** from subgraphs & Lido
- 🗄️ **SQLite Storage** for fast queries
- ⏰ **Automated Data Refresh** (cron or manual)
- 🛡️ **Robust Error Handling** & security
- 🧪 **Mock Data Support** for dev/testing

---

## 📋 API Endpoints

<details>
<summary><b>Restakers</b></summary>

- `GET /api/restakers` – List all restakers
- `GET /api/restakers/:address` – Get restaker by address
- `GET /api/restakers/stats/summary` – Restaking stats

</details>

<details>
<summary><b>Validators</b></summary>

- `GET /api/validators` – List all validators
- `GET /api/validators/:address` – Get validator by address
- `GET /api/validators/stats/summary` – Validator stats

</details>

<details>
<summary><b>Rewards</b></summary>

- `GET /api/rewards/:address` – Rewards for address
- `GET /api/rewards/:address/history` – Rewards history
- `GET /api/rewards/stats/total` – Total rewards stats

</details>

- `GET /health` – Health check

---

## 🚀 Quick Start

- [ ] **Clone the repo**
- [ ] **Install dependencies**
- [ ] **Configure environment**
- [ ] **Start the server**

```bash
git clone <repository-url>
cd eigenlayer-restaking-backend
npm install
cp .env.example .env
# Edit .env as needed
npm run dev
```

---

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_PATH` | SQLite database path | `./database/eigenlayer.sqlite` |
| `ETHEREUM_RPC_URL` | Primary Ethereum RPC URL | Required |
| `ETHEREUM_RPC_URL_BACKUP` | Backup RPC URL | Optional |
| `EIGENLAYER_SUBGRAPH_URL` | EigenLayer subgraph endpoint | Required |
| `LIDO_API_URL` | Lido API endpoint | `https://eth-api.lido.fi/v1` |
| `DATA_REFRESH_INTERVAL` | Cron expression for data refresh | `*/30 * * * *` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

---

## 🏗️ Architecture

<details>
<summary>Click to expand project structure</summary>

```
src/
├── controllers/         # Request handlers
│   ├── restakersController.js
│   ├── validatorsController.js
│   └── rewardsController.js
├── services/           # Business logic and data access
│   ├── eigenLayerService.js
│   ├── lidoService.js
│   └── databaseService.js
├── routes/             # API route definitions
│   ├── restakers.js
│   ├── validators.js
│   └── rewards.js
├── middleware/         # Express middleware
│   └── errorHandler.js
└── scripts/           # Utility scripts
    ├── fetchData.js
    └── scheduler.js
```
</details>

### Database Schema

#### Restakers Table
- `userAddress` - Ethereum address of the restaker
- `amountRestaked` - Amount of tokens restaked (wei)
- `targetAVSValidatorAddress` - Target validator/strategy address
- `strategy` - EigenLayer strategy contract address
- `blockNumber` - Block number of the transaction
- `transactionHash` - Transaction hash
- `timestamp` - Timestamp of the restaking event

#### Validators Table
- `operatorAddress` - Ethereum address of the operator
- `operatorId` - Unique operator identifier
- `totalDelegatedStake` - Total stake delegated to operator (wei)
- `validatorStatus` - Current status (active, jailed, slashed)
- `metadataURI` - URI for operator metadata

#### Rewards Table
- `userAddress` - Reward recipient address
- `validatorAddress` - Validator that generated the reward
- `rewardAmount` - Reward amount (wei)
- `rewardType` - Type of reward (restaking, etc.)
- `timestamp` - Reward distribution timestamp

#### Slash History Table
- `operatorAddress` - Slashed operator address
- `slashedAmount` - Amount slashed (wei)
- `reason` - Reason for slashing
- `timestamp` - Slashing event timestamp

---

## 🔄 Data Pipeline

1. **Fetch** from EigenLayer, Lido, Ethereum
2. **Process** and normalize data
3. **Store** in SQLite
4. **Expose** via REST API

### Automated Refresh

The system automatically refreshes data based on the configured schedule:
- Default: Every 30 minutes
- Configurable via `DATA_REFRESH_INTERVAL` environment variable
- Manual refresh available via `/api/admin/refresh` endpoint

---

## 📊 API Response Examples

<details>
<summary>Restakers Example</summary>

```json
{
  "success": true,
  "data": [
    {
      "userAddress": "0x742f6b5d9d4bb4e9d8a0e6a8b4e5d2a1f8c3e9d7",
      "amountRestaked": "32500000000000000000",
      "amountRestakedETH": "32.5",
      "targetAVSValidatorAddress": "0x858646372CC42E1A627fcE94aa7A7033e7CF075A",
      "strategy": "0x93c4b944D05dfe6df7645A86cd2206016c51564D",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 250,
    "itemsPerPage": 50
  },
  "metadata": {
    "totalRestakers": 250,
    "totalValueLocked": {
      "eth": "12500.75",
      "wei": "12500750000000000000000"
    }
  }
}
```
</details>

<details>
<summary>Validator Example</summary>

```json
{
  "success": true,
  "data": [
    {
      "operatorAddress": "0x858646372CC42E1A627fcE94aa7A7033e7CF075A",
      "operatorId": "operator_1",
      "totalDelegatedStake": "1500750000000000000000",
      "totalDelegatedStakeETH": "1500.75",
      "validatorStatus": "active",
      "slashHistory": []
    }
  ]
}
```
</details>

<details>
<summary>Rewards Example</summary>

```json
{
  "success": true,
  "data": {
    "userAddress": "0x742f6b5d9d4bb4e9d8a0e6a8b4e5d2a1f8c3e9d7",
    "totalRestakingRewardsReceived": "2500000000000000000",
    "totalRestakingRewardsReceivedETH": "2.5",
    "breakdownPerValidator": [
      {
        "validatorAddress": "0x858646372CC42E1A627fcE94aa7A7033e7CF075A",
        "totalRewards": 1.5,
        "totalRewardsETH": "1.5",
        "rewardCount": 30
      }
    ],
    "rewardTimestamps": []
  }
}
```
</details>

---

## 🤝 Contributing

PRs and issues welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.




