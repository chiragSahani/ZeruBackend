const axios = require('axios');
const { ethers } = require('ethers');

class EigenLayerService {
  constructor() {
    this.subgraphUrl = process.env.EIGENLAYER_SUBGRAPH_URL;
    this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    
    // EigenLayer contract addresses
    this.strategyManagerAddress = process.env.EIGENLAYER_STRATEGY_MANAGER_ADDRESS;
    this.delegationManagerAddress = process.env.EIGENLAYER_DELEGATION_MANAGER_ADDRESS;
  }

  /**
   * Fetch restaking data from EigenLayer subgraph
   */
  async fetchRestakingData() {
    try {
      const query = `
        query GetRestakers($first: Int!, $skip: Int!) {
          deposits(
            first: $first
            skip: $skip
            orderBy: blockTimestamp
            orderDirection: desc
            where: { amount_gt: "0" }
          ) {
            id
            staker
            strategy
            shares
            amount
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      const variables = {
        first: 1000,
        skip: 0
      };

      const response = await axios.post(this.subgraphUrl, {
        query,
        variables
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      return this.processRestakingData(response.data.data.deposits);
    } catch (error) {
      console.error('Error fetching restaking data:', error.message);
      // Return mock data for development
      return this.getMockRestakingData();
    }
  }

  /**
   * Process restaking data into our format
   */
  processRestakingData(deposits) {
    return deposits.map(deposit => ({
      userAddress: deposit.staker,
      amountRestaked: deposit.amount,
      targetAVSValidatorAddress: deposit.strategy, // Strategy contract acts as validator reference
      strategy: deposit.strategy,
      blockNumber: parseInt(deposit.blockNumber),
      transactionHash: deposit.transactionHash,
      timestamp: new Date(parseInt(deposit.blockTimestamp) * 1000).toISOString()
    }));
  }

  /**
   * Fetch operator/validator data
   */
  async fetchValidatorData() {
    try {
      const query = `
        query GetOperators($first: Int!, $skip: Int!) {
          operators(
            first: $first
            skip: $skip
            orderBy: totalShares
            orderDirection: desc
          ) {
            id
            operator
            totalShares
            totalMagnitude
            metadataURI
            delegationApprover
            stakerOptOutWindowBlocks
            shares {
              strategy
              shares
            }
          }
        }
      `;

      const variables = {
        first: 1000,
        skip: 0
      };

      const response = await axios.post(this.subgraphUrl, {
        query,
        variables
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      return this.processValidatorData(response.data.data.operators);
    } catch (error) {
      console.error('Error fetching validator data:', error.message);
      // Return mock data for development
      return this.getMockValidatorData();
    }
  }

  /**
   * Process validator data into our format
   */
  processValidatorData(operators) {
    return operators.map(operator => ({
      operatorAddress: operator.operator,
      operatorId: operator.id,
      totalDelegatedStake: operator.totalShares || '0',
      validatorStatus: 'active', // Default status, can be enhanced
      metadataURI: operator.metadataURI
    }));
  }

  /**
   * Fetch slashing events (mock implementation as EigenLayer slashing is not yet live)
   */
  async fetchSlashingEvents() {
    try {
      // This would query actual slashing events when available
      // For now, return empty array as slashing is not live on mainnet
      return [];
    } catch (error) {
      console.error('Error fetching slashing events:', error.message);
      return [];
    }
  }

  /**
   * Fetch rewards data (simulated as EigenLayer rewards are not yet distributed)
   */
  async fetchRewardsData() {
    try {
      // This would fetch actual reward distributions when available
      // For now, we'll simulate based on staking amounts and time
      const restakers = await this.fetchRestakingData();
      return this.simulateRewards(restakers);
    } catch (error) {
      console.error('Error fetching rewards data:', error.message);
      return [];
    }
  }

  /**
   * Simulate rewards based on restaking amounts (for demonstration)
   */
  simulateRewards(restakers) {
    const rewards = [];
    const currentTime = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    restakers.forEach(restaker => {
      const stakedAmount = parseFloat(ethers.formatEther(restaker.amountRestaked));
      const dailyRewardRate = 0.0001; // 0.01% daily reward rate
      
      // Simulate rewards for the last 30 days
      for (let i = 0; i < 30; i++) {
        const rewardAmount = stakedAmount * dailyRewardRate;
        const timestamp = new Date(currentTime - (i * oneDay));
        
        if (rewardAmount > 0.001) { // Only include meaningful rewards
          rewards.push({
            userAddress: restaker.userAddress,
            validatorAddress: restaker.targetAVSValidatorAddress,
            rewardAmount: ethers.parseEther(rewardAmount.toString()).toString(),
            rewardType: 'restaking',
            blockNumber: restaker.blockNumber + i,
            transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
            timestamp: timestamp.toISOString()
          });
        }
      }
    });

    return rewards;
  }

  /**
   * Mock restaking data for development
   */
  getMockRestakingData() {
    return [
      {
        userAddress: '0x742f6b5d9d4bb4e9d8a0e6a8b4e5d2a1f8c3e9d7',
        amountRestaked: ethers.parseEther('32.5').toString(),
        targetAVSValidatorAddress: '0x858646372CC42E1A627fcE94aa7A7033e7CF075A',
        strategy: '0x93c4b944D05dfe6df7645A86cd2206016c51564D',
        blockNumber: 18500000,
        transactionHash: '0x123...abc',
        timestamp: new Date().toISOString()
      },
      {
        userAddress: '0x9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a09',
        amountRestaked: ethers.parseEther('100.0').toString(),
        targetAVSValidatorAddress: '0x858646372CC42E1A627fcE94aa7A7033e7CF075A',
        strategy: '0x93c4b944D05dfe6df7645A86cd2206016c51564D',
        blockNumber: 18500100,
        transactionHash: '0x456...def',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  }

  /**
   * Mock validator data for development
   */
  getMockValidatorData() {
    return [
      {
        operatorAddress: '0x858646372CC42E1A627fcE94aa7A7033e7CF075A',
        operatorId: 'operator_1',
        totalDelegatedStake: ethers.parseEther('1500.75').toString(),
        validatorStatus: 'active',
        metadataURI: 'https://example.com/operator1-metadata.json'
      },
      {
        operatorAddress: '0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A',
        operatorId: 'operator_2',
        totalDelegatedStake: ethers.parseEther('850.25').toString(),
        validatorStatus: 'active',
        metadataURI: 'https://example.com/operator2-metadata.json'
      }
    ];
  }
}

module.exports = new EigenLayerService();