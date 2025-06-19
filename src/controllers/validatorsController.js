const { getAllValidators } = require('../services/databaseService');
const { ethers } = require('ethers');

class ValidatorsController {
  /**
   * Get all validators
   */
  async getAllValidators(req, res, next) {
    try {
      const { page = 1, limit = 50, status, sortBy = 'totalDelegatedStake', order = 'desc' } = req.query;
      
      let validators = await getAllValidators();
      
      // Filter by status if provided
      if (status) {
        validators = validators.filter(validator => 
          validator.validatorStatus.toLowerCase() === status.toLowerCase()
        );
      }

      // Sort validators
      validators.sort((a, b) => {
        const aValue = sortBy === 'totalDelegatedStake' 
          ? parseFloat(a.totalDelegatedStake || '0')
          : a[sortBy];
        const bValue = sortBy === 'totalDelegatedStake' 
          ? parseFloat(b.totalDelegatedStake || '0')
          : b[sortBy];
        
        if (order === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedValidators = validators.slice(startIndex, endIndex);

      // Format the response
      const formattedValidators = paginatedValidators.map(validator => ({
        operatorAddress: validator.operatorAddress,
        operatorId: validator.operatorId,
        totalDelegatedStake: validator.totalDelegatedStake,
        totalDelegatedStakeETH: validator.totalDelegatedStake 
          ? ethers.formatEther(validator.totalDelegatedStake)
          : '0',
        validatorStatus: validator.validatorStatus,
        metadataURI: validator.metadataURI,
        slashHistory: validator.slashHistory || []
      }));

      const response = {
        success: true,
        data: formattedValidators,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(validators.length / limit),
          totalItems: validators.length,
          itemsPerPage: parseInt(limit),
          hasNextPage: endIndex < validators.length,
          hasPreviousPage: page > 1
        },
        filters: {
          status: status || 'all',
          sortBy,
          order
        },
        metadata: {
          totalValidators: validators.length,
          activeValidators: validators.filter(v => v.validatorStatus === 'active').length,
          totalStakeAcrossValidators: this.calculateTotalStake(validators),
          lastUpdated: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get validator by address
   */
  async getValidatorByAddress(req, res, next) {
    try {
      const { address } = req.params;
      
      if (!ethers.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format'
        });
      }

      const validators = await getAllValidators();
      const validator = validators.find(v => 
        v.operatorAddress.toLowerCase() === address.toLowerCase()
      );

      if (!validator) {
        return res.status(404).json({
          success: false,
          error: 'Validator not found',
          message: `No validator data found for address ${address}`
        });
      }

      const formattedValidator = {
        operatorAddress: validator.operatorAddress,
        operatorId: validator.operatorId,
        totalDelegatedStake: validator.totalDelegatedStake,
        totalDelegatedStakeETH: validator.totalDelegatedStake 
          ? ethers.formatEther(validator.totalDelegatedStake)
          : '0',
        validatorStatus: validator.validatorStatus,
        metadataURI: validator.metadataURI,
        slashHistory: validator.slashHistory || [],
        slashHistoryCount: validator.slashHistory ? validator.slashHistory.length : 0,
        totalSlashedAmount: this.calculateTotalSlashed(validator.slashHistory || [])
      };

      res.json({
        success: true,
        data: formattedValidator
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get validator statistics
   */
  async getValidatorStats(req, res, next) {
    try {
      const validators = await getAllValidators();
      
      const stats = {
        totalValidators: validators.length,
        validatorsByStatus: this.getValidatorsByStatus(validators),
        totalStakeAcrossValidators: this.calculateTotalStake(validators),
        averageStakePerValidator: this.calculateAverageStake(validators),
        slashingStats: this.getSlashingStats(validators),
        topValidatorsByStake: this.getTopValidators(validators, 10),
        stakingDistribution: this.getStakingDistribution(validators)
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
   * Helper: Calculate total stake across all validators
   */
  calculateTotalStake(validators) {
    const total = validators.reduce((sum, validator) => {
      const stakeAmount = validator.totalDelegatedStake 
        ? parseFloat(ethers.formatEther(validator.totalDelegatedStake))
        : 0;
      return sum + stakeAmount;
    }, 0);

    return {
      eth: total.toFixed(4),
      wei: total > 0 ? ethers.parseEther(total.toString()).toString() : '0'
    };
  }

  /**
   * Helper: Calculate average stake per validator
   */
  calculateAverageStake(validators) {
    if (validators.length === 0) return { eth: '0', wei: '0' };
    
    const totalETH = parseFloat(this.calculateTotalStake(validators).eth);
    const average = totalETH / validators.length;

    return {
      eth: average.toFixed(4),
      wei: average > 0 ? ethers.parseEther(average.toString()).toString() : '0'
    };
  }

  /**
   * Helper: Get validators grouped by status
   */
  getValidatorsByStatus(validators) {
    const statusCounts = {};
    validators.forEach(validator => {
      const status = validator.validatorStatus || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return statusCounts;
  }

  /**
   * Helper: Get slashing statistics
   */
  getSlashingStats(validators) {
    let totalSlashEvents = 0;
    let totalSlashedAmount = 0;
    let validatorsWithSlashing = 0;

    validators.forEach(validator => {
      if (validator.slashHistory && validator.slashHistory.length > 0) {
        validatorsWithSlashing++;
        totalSlashEvents += validator.slashHistory.length;
        
        validator.slashHistory.forEach(slash => {
          if (slash.slashedAmount) {
            totalSlashedAmount += parseFloat(ethers.formatEther(slash.slashedAmount));
          }
        });
      }
    });

    return {
      totalSlashEvents,
      validatorsWithSlashing,
      totalSlashedAmount: {
        eth: totalSlashedAmount.toFixed(4),
        wei: totalSlashedAmount > 0 ? ethers.parseEther(totalSlashedAmount.toString()).toString() : '0'
      },
      slashingRate: validators.length > 0 ? (validatorsWithSlashing / validators.length * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Helper: Calculate total slashed amount for a validator
   */
  calculateTotalSlashed(slashHistory) {
    const total = slashHistory.reduce((sum, slash) => {
      return sum + (slash.slashedAmount ? parseFloat(ethers.formatEther(slash.slashedAmount)) : 0);
    }, 0);

    return {
      eth: total.toFixed(4),
      wei: total > 0 ? ethers.parseEther(total.toString()).toString() : '0'
    };
  }

  /**
   * Helper: Get top validators by stake
   */
  getTopValidators(validators, limit = 10) {
    return validators
      .sort((a, b) => {
        const aStake = parseFloat(a.totalDelegatedStake || '0');
        const bStake = parseFloat(b.totalDelegatedStake || '0');
        return bStake - aStake;
      })
      .slice(0, limit)
      .map(validator => ({
        operatorAddress: validator.operatorAddress,
        operatorId: validator.operatorId,
        totalDelegatedStakeETH: validator.totalDelegatedStake 
          ? ethers.formatEther(validator.totalDelegatedStake)
          : '0',
        validatorStatus: validator.validatorStatus,
        slashHistoryCount: validator.slashHistory ? validator.slashHistory.length : 0
      }));
  }

  /**
   * Helper: Get staking distribution
   */
  getStakingDistribution(validators) {
    const distribution = {
      small: 0,    // < 1 ETH
      medium: 0,   // 1-100 ETH
      large: 0,    // 100-1000 ETH
      whale: 0     // > 1000 ETH
    };

    validators.forEach(validator => {
      const stakeETH = validator.totalDelegatedStake 
        ? parseFloat(ethers.formatEther(validator.totalDelegatedStake))
        : 0;

      if (stakeETH < 1) {
        distribution.small++;
      } else if (stakeETH < 100) {
        distribution.medium++;
      } else if (stakeETH < 1000) {
        distribution.large++;
      } else {
        distribution.whale++;
      }
    });

    return distribution;
  }
}

module.exports = new ValidatorsController();