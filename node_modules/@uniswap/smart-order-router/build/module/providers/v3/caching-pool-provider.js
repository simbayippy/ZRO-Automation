import _ from 'lodash';
import { metric, MetricLoggerUnit } from '../../util';
import { log } from '../../util/log';
/**
 * Provider for getting V3 pools, with functionality for caching the results.
 * Does not cache by block because we compute quotes using the on-chain quoter
 * so do not mind if the liquidity values are out of date.
 *
 * @export
 * @class CachingV3PoolProvider
 */
export class CachingV3PoolProvider {
    /**
     * Creates an instance of CachingV3PoolProvider.
     * @param chainId The chain id to use.
     * @param poolProvider The provider to use to get the pools when not in the cache.
     * @param cache Cache instance to hold cached pools.
     */
    constructor(chainId, poolProvider, cache) {
        this.chainId = chainId;
        this.poolProvider = poolProvider;
        this.cache = cache;
        this.POOL_KEY = (chainId, address) => `pool-${chainId}-${address}`;
    }
    async getPools(tokenPairs, providerConfig) {
        const poolAddressSet = new Set();
        const poolsToGetTokenPairs = [];
        const poolsToGetAddresses = [];
        const poolAddressToPool = {};
        for (const [tokenA, tokenB, feeAmount] of tokenPairs) {
            const { poolAddress, token0, token1 } = this.getPoolAddress(tokenA, tokenB, feeAmount);
            if (poolAddressSet.has(poolAddress)) {
                continue;
            }
            poolAddressSet.add(poolAddress);
            const cachedPool = await this.cache.get(this.POOL_KEY(this.chainId, poolAddress));
            if (cachedPool) {
                metric.putMetric('V3_INMEMORY_CACHING_POOL_HIT_IN_MEMORY', 1, MetricLoggerUnit.None);
                poolAddressToPool[poolAddress] = cachedPool;
                continue;
            }
            metric.putMetric('V3_INMEMORY_CACHING_POOL_MISS_NOT_IN_MEMORY', 1, MetricLoggerUnit.None);
            poolsToGetTokenPairs.push([token0, token1, feeAmount]);
            poolsToGetAddresses.push(poolAddress);
        }
        log.info({
            poolsFound: _.map(Object.values(poolAddressToPool), (p) => `${p.token0.symbol} ${p.token1.symbol} ${p.fee}`),
            poolsToGetTokenPairs: _.map(poolsToGetTokenPairs, (t) => `${t[0].symbol} ${t[1].symbol} ${t[2]}`),
        }, `Found ${Object.keys(poolAddressToPool).length} V3 pools already in local cache. About to get liquidity and slot0s for ${poolsToGetTokenPairs.length} pools.`);
        if (poolsToGetAddresses.length > 0) {
            const poolAccessor = await this.poolProvider.getPools(poolsToGetTokenPairs, providerConfig);
            for (const address of poolsToGetAddresses) {
                const pool = poolAccessor.getPoolByAddress(address);
                if (pool) {
                    poolAddressToPool[address] = pool;
                    await this.cache.set(this.POOL_KEY(this.chainId, address), pool);
                }
            }
        }
        return {
            getPool: (tokenA, tokenB, feeAmount) => {
                const { poolAddress } = this.getPoolAddress(tokenA, tokenB, feeAmount);
                return poolAddressToPool[poolAddress];
            },
            getPoolByAddress: (address) => poolAddressToPool[address],
            getAllPools: () => Object.values(poolAddressToPool),
        };
    }
    getPoolAddress(tokenA, tokenB, feeAmount) {
        return this.poolProvider.getPoolAddress(tokenA, tokenB, feeAmount);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy1wb29sLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy92My9jYWNoaW5nLXBvb2wtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxDQUFDLE1BQU0sUUFBUSxDQUFDO0FBRXZCLE9BQU8sRUFBRSxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDdEQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBT3JDOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLE9BQU8scUJBQXFCO0lBSWhDOzs7OztPQUtHO0lBQ0gsWUFDWSxPQUFnQixFQUNoQixZQUE2QixFQUMvQixLQUFtQjtRQUZqQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUMvQixVQUFLLEdBQUwsS0FBSyxDQUFjO1FBWnJCLGFBQVEsR0FBRyxDQUFDLE9BQWdCLEVBQUUsT0FBZSxFQUFFLEVBQUUsQ0FDdkQsUUFBUSxPQUFPLElBQUksT0FBTyxFQUFFLENBQUM7SUFZNUIsQ0FBQztJQUVHLEtBQUssQ0FBQyxRQUFRLENBQ25CLFVBQXVDLEVBQ3ZDLGNBQStCO1FBRS9CLE1BQU0sY0FBYyxHQUFnQixJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3RELE1BQU0sb0JBQW9CLEdBQXFDLEVBQUUsQ0FBQztRQUNsRSxNQUFNLG1CQUFtQixHQUFhLEVBQUUsQ0FBQztRQUN6QyxNQUFNLGlCQUFpQixHQUFvQyxFQUFFLENBQUM7UUFFOUQsS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsSUFBSSxVQUFVLEVBQUU7WUFDcEQsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FDekQsTUFBTSxFQUNOLE1BQU0sRUFDTixTQUFTLENB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