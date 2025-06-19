const { getAllRestakers } = require('../services/databaseService');
const { ethers } = require('ethers');

class RestakersController {
  /**
   * Get all restakers
   */
  async getAllRestakers(req, res, next) {
    try {
      const { page = 1, limit = 50, sortBy = 'timestamp', order = 'desc' } = req.query;
      
      const restakers = await getAllRestakers();
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedRestakers = restakers.slice(startIndex, endIndex);

      // Format amounts for better readability
      const formattedRestakers = paginatedRestakers.map(restaker => ({
        ...restaker,
        amountRestakedETH: ethers.formatEther(restaker.amountRestaked),
        amountRestaked: restaker.amountRestaked, // Keep original for precision
      }));

      const response = {
        success: true,
        data: formattedRestakers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(restakers.length / limit),
          totalItems: restakers.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < restakers.length,
          hasPreviousPage: page > 1
        },
        metadata: {
          totalRestakers: restakers.length,
          totalValueLocked: this.calculateTotalValueLocked(restakers),
          lastUpdated: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get restaker by address
   */
  async getRestakerByAddress(req, res, next) {
    try {
      const { address } = req.params;
      
      if (!ethers.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      const restakers = await getAllRestakers();
      const restaker = restakers.find(r => 
        r.userAddress.toLowerCase() === address.toLowerCase()
      );

      if (!restaker) {
        return res.status(404).json({
          success: false,
          error: 'Restaker not found',
          message: `No restaking data found for address ${address}`
        });
      }

      const formattedRestaker = {
        ...restaker,
        amountRestakedETH: ethers.formatEther(restaker.amountRestaked),
        amountRestaked: restaker.amountRestaked,
      };

      res.json({
        success: true,
        data: formattedRestaker
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get restaking statistics
   */
  async getRestakingStats(req, res, next) {
    try {
      const restakers = await getAllRestakers();
      
      const stats = {
        totalRestakers: restakers.length,
        totalValueLocked: this.calculateTotalValueLocked(restakers),
        averageStakeAmount: this.calculateAverageStakeAmount(restakers),
        uniqueValidators: this.getUniqueValidators(restakers).length,
        recentActivity: this.getRecentActivity(restakers),
        topRestakers: this.getTopRestakers(restakers, 10)
      };

      res.json({
        success: true,
        data: stats,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper: Calculate total value locked
   */
  calculateTotalValueLocked(restakers) {
    const total = restakers.reduce((sum, restaker) => {
      return sum + parseFloat(ethers.formatEther(restaker.amountRestaked));
    }, 0);

    return {
      eth: total.toFixed(4),
      wei: ethers.parseEther(total.toString()).toString()
    };
  }

  /**
   * Helper: Calculate average stake amount
   */
  calculateAverageStakeAmount(restakers) {
    if (restakers.length === 0) return { eth: '0', wei: '0' };
    
    const totalETH = parseFloat(this.calculateTotalValueLocked(restakers).eth);
    const average = totalETH / restakers.length;

    return {
      eth: average.toFixed(4),
      wei: ethers.parseEther(average.toString()).toString()
    };
  }

  /**
   * Helper: Get unique validators
   */
  getUniqueValidators(restakers) {
    const validators = new Set();
    restakers.forEach(restaker => {
      if (restaker.targetAVSValidatorAddress) {
        validators.add(restaker.targetAVSValidatorAddress);
      }
    });
    return Array.from(validators);
  }

  /**
   * Helper: Get recent activity (last 24 hours)
   */
  getRecentActivity(restakers) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRestakers = restakers.filter(restaker => 
      new Date(restaker.timestamp) > oneDayAgo
    );

    return {
      count: recentRestakers.length,
      totalAmount: this.calculateTotalValueLocked(recentRestakers)
    };
  }

  /**
   * Helper: Get top restakers by amount
   */
  getTopRestakers(restakers, limit = 10) {
    return restakers
      .sort((a, b) => parseFloat(b.amountRestaked) - parseFloat(a.amountRestaked))
      .slice(0, limit)
      .map(restaker => ({
        userAddress: restaker.userAddress,
        amountRestakedETH: ethers.formatEther(restaker.amountRestaked),
        targetAVSValidatorAddress: restaker.targetAVSValidatorAddress,
        timestamp: restaker.timestamp
      }));
  }
}

module.exports = new RestakersController();