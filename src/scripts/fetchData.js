const eigenLayerService = require('../services/eigenLayerService');
const lidoService = require('../services/lidoService');
const { 
  insertRestaker, 
  insertValidator, 
  insertReward, 
  insertSlashEvent,
  initializeDatabase 
} = require('../services/databaseService');

class DataFetcher {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Main data fetching orchestrator
   */
  async fetchAllData() {
    if (this.isRunning) {
      console.log('⚠️ Data fetching already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔄 Starting data fetch process...');
      
      const startTime = Date.now();

      // Ensure database is initialized
      await initializeDatabase();

      // Fetch data from different sources in parallel
      const [
        restakingData,
        validatorData,
        rewardsData,
        slashingData,
        lidoData
      ] = await Promise.allSettled([
        this.fetchRestakingData(),
        this.fetchValidatorData(),
        this.fetchRewardsData(),
        this.fetchSlashingData(),
        this.fetchLidoData()
      ]);

      // Log results
      this.logFetchResults({
        restakingData,
        validatorData,
        rewardsData,
        slashingData,
        lidoData
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Data fetch completed in ${duration} seconds`);
      
    } catch (error) {
      console.error('❌ Error during data fetch:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetch and store restaking data
   */
  async fetchRestakingData() {
    try {
      console.log('📊 Fetching restaking data from EigenLayer...');
      
      const restakingData = await eigenLayerService.fetchRestakingData();
      let insertedCount = 0;
      let errorCount = 0;

      for (const restaker of restakingData) {
        try {
          await insertRestaker(restaker);
          insertedCount++;
        } catch (error) {
          if (!error.message.includes('UNIQUE constraint failed')) {
            console.error('Error inserting restaker:', error.message);
            errorCount++;
          }
          // Skip duplicate entries silently
        }
      }

      console.log(`✅ Restaking data: ${insertedCount} new records, ${errorCount} errors`);
      return { success: true, inserted: insertedCount, errors: errorCount };
    } catch (error) {
      console.error('❌ Failed to fetch restaking data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch and store validator data
   */
  async fetchValidatorData() {
    try {
      console.log('🔍 Fetching validator data...');
      
      const validatorData = await eigenLayerService.fetchValidatorData();
      let insertedCount = 0;
      let errorCount = 0;

      for (const validator of validatorData) {
        try {
          await insertValidator(validator);
          insertedCount++;
        } catch (error) {
          if (!error.message.includes('UNIQUE constraint failed')) {
            console.error('Error inserting validator:', error.message);
            errorCount++;
          }
          // Skip duplicate entries silently
        }
      }

      console.log(`✅ Validator data: ${insertedCount} new records, ${errorCount} errors`);
      return { success: true, inserted: insertedCount, errors: errorCount };
    } catch (error) {
      console.error('❌ Failed to fetch validator data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch and store rewards data
   */
  async fetchRewardsData() {
    try {
      console.log('💰 Fetching rewards data...');
      
      const rewardsData = await eigenLayerService.fetchRewardsData();
      let insertedCount = 0;
      let errorCount = 0;

      for (const reward of rewardsData) {
        try {
          await insertReward(reward);
          insertedCount++;
        } catch (error) {
          console.error('Error inserting reward:', error.message);
          errorCount++;
        }
      }

      console.log(`✅ Rewards data: ${insertedCount} new records, ${errorCount} errors`);
      return { success: true, inserted: insertedCount, errors: errorCount };
    } catch (error) {
      console.error('❌ Failed to fetch rewards data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch and store slashing data
   */
  async fetchSlashingData() {
    try {
      console.log('⚔️ Fetching slashing events...');
      
      const slashingData = await eigenLayerService.fetchSlashingEvents();
      let insertedCount = 0;
      let errorCount = 0;

      for (const slashEvent of slashingData) {
        try {
          await insertSlashEvent(slashEvent);
          insertedCount++;
        } catch (error) {
          console.error('Error inserting slash event:', error.message);
          errorCount++;
        }
      }

      console.log(`✅ Slashing data: ${insertedCount} new records, ${errorCount} errors`);
      return { success: true, inserted: insertedCount, errors: errorCount };
    } catch (error) {
      console.error('❌ Failed to fetch slashing data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch Lido data for context
   */
  async fetchLidoData() {
    try {
      console.log('🌊 Fetching Lido stETH data...');
      
      const lidoData = await lidoService.fetchLidoData();
      
      console.log(`✅ Lido data fetched successfully`);
      console.log(`   - Total Pooled ETH: ${lidoData.staking.totalPooledEther}`);
      console.log(`   - Current APR: ${(lidoData.staking.apr * 100).toFixed(2)}%`);
      
      return { success: true, data: lidoData };
    } catch (error) {
      console.error('❌ Failed to fetch Lido data:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log fetch results summary
   */
  logFetchResults(results) {
    console.log('\n📋 Data Fetch Summary:');
    console.log('========================');
    
    Object.entries(results).forEach(([key, result]) => {
      const status = result.status === 'fulfilled' ? '✅' : '❌';
      const data = result.status === 'fulfilled' ? result.value : result.reason;
      
      if (result.status === 'fulfilled' && data.success) {
        console.log(`${status} ${key}: ${data.inserted || 'Success'} records`);
      } else {
        console.log(`${status} ${key}: ${data.error || data.message || 'Failed'}`);
      }
    });
    
    console.log('========================\n');
  }

  /**
   * Health check for data sources
   */
  async healthCheck() {
    console.log('🏥 Running data source health check...');
    
    const checks = [
      { name: 'EigenLayer Service', check: () => eigenLayerService.fetchRestakingData() },
      { name: 'Lido Service', check: () => lidoService.fetchLidoData() }
    ];

    for (const { name, check } of checks) {
      try {
        await check();
        console.log(`✅ ${name}: Healthy`);
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
      }
    }
  }
}

const dataFetcher = new DataFetcher();

// Allow running this script directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'health':
      dataFetcher.healthCheck();
      break;
    case 'restaking':
      dataFetcher.fetchRestakingData();
      break;
    case 'validators':
      dataFetcher.fetchValidatorData();
      break;
    case 'rewards':
      dataFetcher.fetchRewardsData();
      break;
    default:
      dataFetcher.fetchAllData()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
  }
}

module.exports = dataFetcher;