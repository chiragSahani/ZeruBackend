const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DATABASE_PATH || './database/eigenlayer.sqlite';
  }

  async initializeDatabase() {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Connect to database
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw err;
        }
      });

      // Create tables
      await this.createTables();
      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const queries = [
        // Restakers table
        `CREATE TABLE IF NOT EXISTS restakers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userAddress TEXT UNIQUE NOT NULL,
          amountRestaked TEXT NOT NULL,
          targetAVSValidatorAddress TEXT,
          strategy TEXT,
          blockNumber INTEGER,
          transactionHash TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Validators table
        `CREATE TABLE IF NOT EXISTS validators (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operatorAddress TEXT UNIQUE NOT NULL,
          operatorId TEXT,
          totalDelegatedStake TEXT DEFAULT '0',
          validatorStatus TEXT DEFAULT 'active',
          metadataURI TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Slash history table
        `CREATE TABLE IF NOT EXISTS slash_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operatorAddress TEXT NOT NULL,
          slashedAmount TEXT NOT NULL,
          reason TEXT,
          blockNumber INTEGER,
          transactionHash TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (operatorAddress) REFERENCES validators (operatorAddress)
        )`,

        // Rewards table
        `CREATE TABLE IF NOT EXISTS rewards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userAddress TEXT NOT NULL,
          validatorAddress TEXT NOT NULL,
          rewardAmount TEXT NOT NULL,
          rewardType TEXT DEFAULT 'restaking',
          blockNumber INTEGER,
          transactionHash TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Indexes for better performance
        `CREATE INDEX IF NOT EXISTS idx_restakers_address ON restakers(userAddress)`,
        `CREATE INDEX IF NOT EXISTS idx_validators_address ON validators(operatorAddress)`,
        `CREATE INDEX IF NOT EXISTS idx_rewards_user ON rewards(userAddress)`,
        `CREATE INDEX IF NOT EXISTS idx_rewards_validator ON rewards(validatorAddress)`,
        `CREATE INDEX IF NOT EXISTS idx_slash_history_operator ON slash_history(operatorAddress)`,
      ];

      let completed = 0;
      const total = queries.length;

      queries.forEach((query) => {
        this.db.run(query, (err) => {
          if (err) {
            console.error('Error creating table:', err);
            reject(err);
            return;
          }
          completed++;
          if (completed === total) {
            resolve();
          }
        });
      });
    });
  }

  // Restakers methods
  async insertRestaker(restakerData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO restakers 
        (userAddress, amountRestaked, targetAVSValidatorAddress, strategy, blockNumber, transactionHash, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [
        restakerData.userAddress,
        restakerData.amountRestaked,
        restakerData.targetAVSValidatorAddress,
        restakerData.strategy,
        restakerData.blockNumber,
        restakerData.transactionHash,
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getAllRestakers() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT userAddress, amountRestaked, targetAVSValidatorAddress, strategy, timestamp
        FROM restakers 
        ORDER BY timestamp DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Validators methods
  async insertValidator(validatorData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO validators 
        (operatorAddress, operatorId, totalDelegatedStake, validatorStatus, metadataURI, updatedAt)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(query, [
        validatorData.operatorAddress,
        validatorData.operatorId,
        validatorData.totalDelegatedStake,
        validatorData.validatorStatus,
        validatorData.metadataURI,
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getAllValidators() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          v.operatorAddress,
          v.operatorId,
          v.totalDelegatedStake,
          v.validatorStatus,
          v.metadataURI,
          GROUP_CONCAT(
            json_object(
              'slashedAmount', sh.slashedAmount,
              'reason', sh.reason,
              'timestamp', sh.timestamp,
              'transactionHash', sh.transactionHash
            )
          ) as slashHistory
        FROM validators v
        LEFT JOIN slash_history sh ON v.operatorAddress = sh.operatorAddress
        GROUP BY v.operatorAddress
        ORDER BY v.totalDelegatedStake DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else {
          // Parse slash history JSON
          const processedRows = rows.map(row => ({
            ...row,
            slashHistory: row.slashHistory ? 
              row.slashHistory.split(',').map(item => JSON.parse(item)) : []
          }));
          resolve(processedRows);
        }
      });
    });
  }

  // Rewards methods
  async insertReward(rewardData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO rewards 
        (userAddress, validatorAddress, rewardAmount, rewardType, blockNumber, transactionHash)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        rewardData.userAddress,
        rewardData.validatorAddress,
        rewardData.rewardAmount,
        rewardData.rewardType,
        rewardData.blockNumber,
        rewardData.transactionHash,
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async getRewardsByAddress(userAddress) {
    return new Promise((resolve, reject) => {
      const queries = [
        // Total rewards
        `SELECT SUM(CAST(rewardAmount as REAL)) as totalRestakingRewardsReceived 
         FROM rewards WHERE userAddress = ?`,
        
        // Breakdown per validator
        `SELECT 
           validatorAddress,
           SUM(CAST(rewardAmount as REAL)) as totalRewards,
           COUNT(*) as rewardCount,
           MIN(timestamp) as firstReward,
           MAX(timestamp) as lastReward
         FROM rewards 
         WHERE userAddress = ? 
         GROUP BY validatorAddress`,
         
        // Recent reward timestamps
        `SELECT rewardAmount, validatorAddress, timestamp, transactionHash
         FROM rewards 
         WHERE userAddress = ? 
         ORDER BY timestamp DESC 
         LIMIT 50`
      ];

      let results = {};
      let completed = 0;

      // Get total rewards
      this.db.get(queries[0], [userAddress], (err, row) => {
        if (err) reject(err);
        else {
          results.totalRestakingRewardsReceived = row?.totalRestakingRewardsReceived || '0';
          completed++;
          if (completed === 3) resolve(results);
        }
      });

      // Get breakdown per validator
      this.db.all(queries[1], [userAddress], (err, rows) => {
        if (err) reject(err);
        else {
          results.breakdownPerValidator = rows || [];
          completed++;
          if (completed === 3) resolve(results);
        }
      });

      // Get reward timestamps
      this.db.all(queries[2], [userAddress], (err, rows) => {
        if (err) reject(err);
        else {
          results.rewardTimestamps = rows || [];
          completed++;
          if (completed === 3) resolve(results);
        }
      });
    });
  }

  async insertSlashEvent(slashData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO slash_history 
        (operatorAddress, slashedAmount, reason, blockNumber, transactionHash)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        slashData.operatorAddress,
        slashData.slashedAmount,
        slashData.reason,
        slashData.blockNumber,
        slashData.transactionHash,
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed.');
        }
      });
    }
  }
}

const dbService = new DatabaseService();

module.exports = {
  initializeDatabase: () => dbService.initializeDatabase(),
  insertRestaker: (data) => dbService.insertRestaker(data),
  getAllRestakers: () => dbService.getAllRestakers(),
  insertValidator: (data) => dbService.insertValidator(data),
  getAllValidators: () => dbService.getAllValidators(),
  insertReward: (data) => dbService.insertReward(data),
  getRewardsByAddress: (address) => dbService.getRewardsByAddress(address),
  insertSlashEvent: (data) => dbService.insertSlashEvent(data),
  close: () => dbService.close(),
};