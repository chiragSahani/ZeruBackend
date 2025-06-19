const axios = require('axios');
const { ethers } = require('ethers');

class LidoService {
  constructor() {
    this.apiUrl = process.env.LIDO_API_URL || 'https://eth-api.lido.fi/v1';
    this.stEthAddress = process.env.LIDO_STETH_ADDRESS || '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
    this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
  }

  /**
   * Fetch Lido stETH data relevant to EigenLayer restaking
   */
  async fetchLidoData() {
    try {
      const [stakingData, rewardsData] = await Promise.all([
        this.fetchStakingData(),
        this.fetchRewardsData()
      ]);

      return {
        staking: stakingData,
        rewards: rewardsData
      };
    } catch (error) {
      console.error('Error fetching Lido data:', error.message);
      return this.getMockLidoData();
    }
  }

  /**
   * Fetch Lido staking statistics
   */
  async fetchStakingData() {
    try {
      const response = await axios.get(`${this.apiUrl}/metrics`, {
        timeout: 10000
      });

      return {
        totalPooledEther: response.data.totalPooledEther,
        totalShares: response.data.totalShares,
        bufferedEther: response.data.bufferedEther,
        apr: response.data.apr,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching Lido staking data:', error.message);
      return this.getMockStakingData();
    }
  }

  /**
   * Fetch Lido rewards data
   */
  async fetchRewardsData() {
    try {
      // Fetch recent reward events from Lido
      const response = await axios.get(`${this.apiUrl}/rewards`, {
        timeout: 10000,
        params: {
          limit: 100
        }
      });

      return response.data.rewards || [];
    } catch (error) {
      console.error('Error fetching Lido rewards data:', error.message);
      return this.getMockRewardsData();
    }
  }

  /**
   * Get stETH exchange rate
   */
  async getStEthExchangeRate() {
    try {
      const stEthContract = new ethers.Contract(
        this.stEthAddress,
        [
          'function getPooledEthByShares(uint256 _sharesAmount) view returns (uint256)',
          'function getSharesByPooledEth(uint256 _pooledEthAmount) view returns (uint256)',
          'function totalSupply() view returns (uint256)',
          'function getTotalPooledEther() view returns (uint256)'
        ],
        this.provider
      );

      const [totalSupply, totalPooledEther] = await Promise.all([
        stEthContract.totalSupply(),
        stEthContract.getTotalPooledEther()
      ]);

      const exchangeRate = Number(totalPooledEther) / Number(totalSupply);
      
      return {
        rate: exchangeRate,
        totalSupply: totalSupply.toString(),
        totalPooledEther: totalPooledEther.toString(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting stETH exchange rate:', error.message);
      return {
        rate: 1.0, // Default 1:1 rate
        totalSupply: '0',
        totalPooledEther: '0',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Convert stETH amounts to ETH equivalent
   */
  async convertStEthToEth(stEthAmount) {
    try {
      const exchangeData = await this.getStEthExchangeRate();
      const ethAmount = parseFloat(stEthAmount) * exchangeData.rate;
      return ethAmount.toString();
    } catch (error) {
      console.error('Error converting stETH to ETH:', error.message);
      return stEthAmount; // Return original amount if conversion fails
    }
  }

  /**
   * Mock Lido data for development
   */
  getMockLidoData() {
    return {
      staking: this.getMockStakingData(),
      rewards: this.getMockRewardsData()
    };
  }

  getMockStakingData() {
    return {
      totalPooledEther: ethers.parseEther('9500000').toString(), // 9.5M ETH
      totalShares: ethers.parseEther('9300000').toString(), // 9.3M shares
      bufferedEther: ethers.parseEther('150000').toString(), // 150K ETH buffer
      apr: 0.045, // 4.5% APR
      lastUpdate: new Date().toISOString()
    };
  }

  getMockRewardsData() {
    const rewards = [];
    const currentTime = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Generate mock rewards for the last 7 days
    for (let i = 0; i < 7; i++) {
      rewards.push({
        date: new Date(currentTime - (i * oneDay)).toISOString().split('T')[0],
        totalRewards: ethers.parseEther((Math.random() * 1000 + 500).toString()).toString(),
        apr: 0.04 + Math.random() * 0.01, // 4-5% APR
        validatorsCount: 9500 + Math.floor(Math.random() * 100)
      });
    }

    return rewards;
  }
}

module.exports = new LidoService();