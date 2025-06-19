const cron = require('node-cron');
const dataFetcher = require('./fetchData');

class Scheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Start the scheduler with configured tasks
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('⏰ Starting data refresh scheduler...');
    
    // Main data refresh task - runs every 30 minutes by default
    const refreshInterval = process.env.DATA_REFRESH_INTERVAL || '*/30 * * * *';
    
    const mainTask = cron.schedule(refreshInterval, async () => {
      console.log(`\n🔄 Scheduled data refresh started at ${new Date().toISOString()}`);
      try {
        await dataFetcher.fetchAllData();
        console.log('✅ Scheduled data refresh completed successfully\n');
      } catch (error) {
        console.error('❌ Scheduled data refresh failed:', error.message);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Health check task - runs every 5 minutes
    const healthCheckTask = cron.schedule('*/5 * * * *', async () => {
      try {
        await dataFetcher.healthCheck();
      } catch (error) {
        console.error('❌ Health check failed:', error.message);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Store tasks
    this.tasks.set('main', mainTask);
    this.tasks.set('healthCheck', healthCheckTask);

    // Start all tasks
    mainTask.start();
    healthCheckTask.start();

    this.isRunning = true;
    
    console.log(`✅ Scheduler started successfully`);
    console.log(`   - Main refresh: ${refreshInterval}`);
    console.log(`   - Health check: */5 * * * *`);
    console.log(`   - Timezone: UTC`);

    // Run initial data fetch
    setTimeout(async () => {
      console.log('🚀 Running initial data fetch...');
      try {
        await dataFetcher.fetchAllData();
        console.log('✅ Initial data fetch completed');
      } catch (error) {
        console.error('❌ Initial data fetch failed:', error.message);
      }
    }, 5000); // Wait 5 seconds after server start
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler is not running');
      return;
    }

    console.log('🛑 Stopping scheduler...');
    
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`   - Stopped ${name} task`);
    });

    this.tasks.clear();
    this.isRunning = false;
    
    console.log('✅ Scheduler stopped successfully');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      refreshInterval: process.env.DATA_REFRESH_INTERVAL || '*/30 * * * *',
      nextRun: this.isRunning && this.tasks.has('main') 
        ? 'Next run calculated by cron'
        : 'Not scheduled'
    };
  }

  /**
   * Manually trigger data refresh
   */
  async triggerRefresh() {
    if (!this.isRunning) {
      throw new Error('Scheduler is not running');
    }

    console.log('🔄 Manual data refresh triggered...');
    try {
      await dataFetcher.fetchAllData();
      console.log('✅ Manual data refresh completed successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Manual data refresh failed:', error.message);
      throw error;
    }
  }

  /**
   * Update refresh interval
   */
  updateRefreshInterval(newInterval) {
    if (!cron.validate(newInterval)) {
      throw new Error('Invalid cron expression');
    }

    if (this.isRunning) {
      // Stop current main task
      if (this.tasks.has('main')) {
        this.tasks.get('main').stop();
      }

      // Create new task with updated interval
      const newTask = cron.schedule(newInterval, async () => {
        console.log(`\n🔄 Scheduled data refresh started at ${new Date().toISOString()}`);
        try {
          await dataFetcher.fetchAllData();
          console.log('✅ Scheduled data refresh completed successfully\n');
        } catch (error) {
          console.error('❌ Scheduled data refresh failed:', error.message);
        }
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.tasks.set('main', newTask);
      console.log(`✅ Refresh interval updated to: ${newInterval}`);
    }

    // Update environment variable
    process.env.DATA_REFRESH_INTERVAL = newInterval;
  }
}

const scheduler = new Scheduler();

module.exports = scheduler;