"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachingV3PoolProvider = void 0;
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../../util");
const log_1 = require("../../util/log");
/**
 * Provider for getting V3 pools, with functionality for caching the results.
 * Does not cache by block because we compute quotes using the on-chain quoter
 * so do not mind if the liquidity values are out of date.
 *
 * @export
 * @class CachingV3PoolProvider
 */
class CachingV3PoolProvider {
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
                util_1.metric.putMetric('V3_INMEMORY_CACHING_POOL_HIT_IN_MEMORY', 1, util_1.MetricLoggerUnit.None);
                poolAddressToPool[poolAddress] = cachedPool;
                continue;
            }
            util_1.metric.putMetric('V3_INMEMORY_CACHING_POOL_MISS_NOT_IN_MEMORY', 1, util_1.MetricLoggerUnit.None);
            poolsToGetTokenPairs.push([token0, token1, feeAmount]);
            poolsToGetAddresses.push(poolAddress);
        }
        log_1.log.info({
            poolsFound: lodash_1.default.map(Object.values(poolAddressToPool), (p) => `${p.token0.symbol} ${p.token1.symbol} ${p.fee}`),
            poolsToGetTokenPairs: lodash_1.default.map(poolsToGetTokenPairs, (t) => `${t[0].symbol} ${t[1].symbol} ${t[2]}`),
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
exports.CachingV3PoolProvider = CachingV3PoolProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGluZy1wb29sLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy92My9jYWNoaW5nLXBvb2wtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBRUEsb0RBQXVCO0FBRXZCLHFDQUFzRDtBQUN0RCx3Q0FBcUM7QUFPckM7Ozs7Ozs7R0FPRztBQUNILE1BQWEscUJBQXFCO0lBSWhDOzs7OztPQUtHO0lBQ0gsWUFDWSxPQUFnQixFQUNoQixZQUE2QixFQUMvQixLQUFtQjtRQUZqQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUMvQixVQUFLLEdBQUwsS0FBSyxDQUFjO1FBWnJCLGFBQVEsR0FBRyxDQUFDLE9BQWdCLEVBQUUsT0FBZSxFQUFFLEVBQUUsQ0FDdkQsUUFBUSxPQUFPLElBQUksT0FBTyxFQUFFLENBQUM7SUFZNUIsQ0FBQztJQUVHLEtBQUssQ0FBQyxRQUFRLENBQ25CLFVBQXVDLEVBQ3ZDLGNBQStCO1FBRS9CLE1BQU0sY0FBYyxHQUFnQixJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3RELE1BQU0sb0JBQW9CLEdBQXFDLEVBQUUsQ0FBQztRQUNsRSxNQUFNLG1CQUFtQixHQUFhLEVBQUUsQ0FBQztRQUN6QyxNQUFNLGlCQUFpQixHQUFvQyxFQUFFLENBQUM7UUFFOUQsS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsSUFBSSxVQUFVLEVBQUU7WUFDcEQsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FDekQsTUFBTSxFQUNOLE1BQU0sRUFDTixTQUFTLENBQ1YsQ0FBQztZQUVGLElBQUksY0FBYyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDbkMsU0FBUzthQUNWO1lBRUQsY0FBYyxDQUFDLEdB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