const { getRewardsByAddress } = require('../services/databaseService');
const { ethers } = require('ethers');

class RewardsController {
  /**
   * Get rewards for a specific address
   */
  async getRewardsByAddress(req, res, next) {
    try {
      const { address } = req.params;
      
      if (!ethers.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      const rewardsData = await getRewardsByAddress(address);
      
      if (!rewardsData.breakdownPerValidator || rewardsData.breakdownPerValidator.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No rewards found',
          message: `No reward data found for address ${address}`
        });
      }

      // Format the response
      const formattedResponse = {
        userAddress: address,
        totalRestakingRewardsReceived: rewardsData.totalRestakingRewardsReceived,
        totalRestakingRewardsReceivedETH: ethers.formatEther(
          rewardsData.totalRestakingRewardsReceived || '0'
        ),
        breakdownPerValidator: rewardsData.breakdownPerValidator.map(validator => ({
          validatorAddress: validator.validatorAddress,
          totalRewards: validator.totalRewards,
          totalRewardsETH: ethers.formatEther(validator.totalRewards?.toString() || '0'),
          rewardCount: validator.rewardCount,
          firstReward: validator.firstReward,
          lastReward: validator.lastReward,
          averageRewardETH: validator.rewardCount > 0 
            ? ethers.formatEther((validator.totalRewards / validator.rewardCount).toString())
            : '0'
        })),
        rewardTimestamps: rewardsData.rewardTimestamps.slice(0, 10).map(reward => ({
          amount: reward.rewardAmount,
          amountETH: ethers.formatEther(reward.rewardAmount),
          validatorAddress: reward.validatorAddress,
          timestamp: reward.timestamp,
          transactionHash: reward.transactionHash
        })),
        statistics: {
          totalValidatorsRewarded: rewardsData.breakdownPerValidator.length,
          averageRewardPerValidator: this.calculateAverageRewardPerValidator(rewardsData.breakdownPerValidator),
          rewardFrequency: this.calculateRewardFrequency(rewardsData.rewardTimestamps),
          lastRewardDate: rewardsData.rewardTimestamps.length > 0 
            ? rewardsData.rewardTimestamps[0].timestamp 
            : null
        }
      };

      res.json({
        success: true,
        data: formattedResponse,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed rewards history for a specific address
   */
  async getRewardsHistory(req, res, next) {
    try {
      const { address } = req.params;
      const { page = 1, limit = 50, validator, fromDate, toDate } = req.query;
      
      if (!ethers.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      const rewardsData = await getRewardsByAddress(address);
      let rewards = rewardsData.rewardTimestamps || [];

      // Apply filters
      if (validator) {
        rewards = rewards.filter(reward => 
          reward.validatorAddress.toLowerCase() === validator.toLowerCase()
        );
      }

      if (fromDate) {
        const fromDateTime = new Date(fromDate);
        rewards = rewards.filter(reward => 
          new Date(reward.timestamp) >= fromDateTime
        );
      }

      if (toDate) {
        const toDateTime = new Date(toDate);
        rewards = rewards.filter(reward => 
          new Date(reward.timestamp) <= toDateTime
        );
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedRewards = rewards.slice(startIndex, endIndex);

      // Format rewards
      const formattedRewards = paginatedRewards.map(reward => ({
        amount: reward.rewardAmount,
        amountETH: ethers.formatEther(reward.rewardAmount),
        validatorAddress: reward.validatorAddress,
        timestamp: reward.timestamp,
        transactionHash: reward.transactionHash,
        blockNumber: reward.blockNumber
      }));

      const response = {
        success: true,
        data: {
          userAddress: address,
          rewards: formattedRewards,
          summary: {
            totalRewardsInPeriod: this.calculateTotalRewards(rewards),
            averageRewardAmount: this.calculateAverageReward(rewards),
            rewardCount: rewards.length
          }
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(rewards.length / limit),
          totalItems: rewards.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < rewards.length,
          hasPreviousPage: page > 1
        },
        filters: {
          validator: validator || null,
          fromDate: fromDate || null,
          toDate: toDate || null
        },
        lastUpdated: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get total rewards statistics across all users
   */
  async getTotalRewardsStats(req, res, next) {
    try {
      // This would require additional database queries to aggregate across all users
      // For now, we'll return a placeholder response
      
      const stats = {
        totalRewardsDistributed: {
          eth: '0', // Would calculate from all users
          wei: '0'
        },
        totalUniqueRewardRecipients: 0,
        averageRewardPerUser: {
          eth: '0',
          wei: '0'
        },
        rewardDistributionByValidator: [],
        rewardTrends: {
          daily: [],
          weekly: [],
          monthly: []
        }
      };

      res.json({
        success: true,
        data: stats,
        message: 'Total rewards statistics feature coming soon',
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper: Calculate average reward per validator
   */
  calculateAverageRewardPerValidator(breakdownPerValidator) {
    if (breakdownPerValidator.length === 0) return { eth: '0', wei: '0' };
    
    const totalRewards = breakdownPerValidator.reduce((sum, validator) => {
      return sum + parseFloat(validator.totalRewards || 0);
    }, 0);
    
    const average = totalRewards / breakdownPerValidator.length;
    
    return {
      eth: ethers.formatEther(average.toString()),
      wei: ethers.parseEther(average.toString()).toString()
    };
  }

  /**
   * Helper: Calculate reward frequency
   */
  calculateRewardFrequency(rewardTimestamps) {
    if (rewardTimestamps.length < 2) {
      return {
        frequency: 'insufficient_data',
        averageDaysBetweenRewards: 0
      };
    }

    // Sort by timestamp
    const sortedRewards = [...rewardTimestamps].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Calculate average days between rewards
    let totalDays = 0;
    let intervals = 0;

    for (let i = 0; i < sortedRewards.length - 1; i++) {
      const timeDiff = new Date(sortedRewards[i].timestamp) - new Date(sortedRewards[i + 1].timestamp);
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      totalDays += daysDiff;
      intervals++;
    }

    const averageDays = intervals > 0 ? totalDays / intervals : 0;

    let frequency;
    if (averageDays <= 1) frequency = 'daily';
    else if (averageDays <= 7) frequency = 'weekly';
    else if (averageDays <= 30) frequency = 'monthly';
    else frequency = 'irregular';

    return {
      frequency,
      averageDaysBetweenRewards: averageDays.toFixed(2)
    };
  }

  /**
   * Helper: Calculate total rewards from array
   */
  calculateTotalRewards(rewards) {
    const total = rewards.reduce((sum, reward) => {
      return sum + parseFloat(ethers.formatEther(reward.rewardAmount));
    }, 0);

    return {
      eth: total.toFixed(4),
      wei: total > 0 ? ethers.parseEther(total.toString()).toString() : '0'
    };
  }

  /**
   * Helper: Calculate average reward amount
   */
  calculateAverageReward(rewards) {
    if (rewards.length === 0) return { eth: '0', wei: '0' };
    
    const totalETH = parseFloat(this.calculateTotalRewards(rewards).eth);
    const average = totalETH / rewards.length;

    return {
      eth: average.toFixed(4),
      wei: average > 0 ? ethers.parseEther(average.toString()).toString() : '0'
    };
  }
}

module.exports = new RewardsController();