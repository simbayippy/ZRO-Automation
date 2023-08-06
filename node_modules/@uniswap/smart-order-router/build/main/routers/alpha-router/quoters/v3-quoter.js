"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.V3Quoter = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const lodash_1 = __importDefault(require("lodash"));
const providers_1 = require("../../../providers");
const util_1 = require("../../../util");
const entities_1 = require("../entities");
const compute_all_routes_1 = require("../functions/compute-all-routes");
const get_candidate_pools_1 = require("../functions/get-candidate-pools");
const base_quoter_1 = require("./base-quoter");
class V3Quoter extends base_quoter_1.BaseQuoter {
    constructor(v3SubgraphProvider, v3PoolProvider, onChainQuoteProvider, tokenProvider, chainId, blockedTokenListProvider, tokenValidatorProvider) {
        super(tokenProvider, chainId, blockedTokenListProvider, tokenValidatorProvider);
        this.v3SubgraphProvider = v3SubgraphProvider;
        this.v3PoolProvider = v3PoolProvider;
        this.onChainQuoteProvider = onChainQuoteProvider;
    }
    async getRoutes(tokenIn, tokenOut, tradeType, routingConfig) {
        // Fetch all the pools that we will consider routing via. There are thousands
        // of pools, so we filter them to a set of candidate pools that we expect will
        // result in good prices.
        const { poolAccessor, candidatePools } = await (0, get_candidate_pools_1.getV3CandidatePools)({
            tokenIn,
            tokenOut,
            tokenProvider: this.tokenProvider,
            blockedTokenListProvider: this.blockedTokenListProvider,
            poolProvider: this.v3PoolProvider,
            routeType: tradeType,
            subgraphProvider: this.v3SubgraphProvider,
            routingConfig,
            chainId: this.chainId,
        });
        const poolsRaw = poolAccessor.getAllPools();
        // Drop any pools that contain fee on transfer tokens (not supported by v3) or have issues with being transferred.
        const pools = await this.applyTokenValidatorToPools(poolsRaw, (token, tokenValidation) => {
            // If there is no available validation result we assume the token is fine.
            if (!tokenValidation) {
                return false;
            }
            // Only filters out *intermediate* pools that involve tokens that we detect
            // cant be transferred. This prevents us trying to route through tokens that may
            // not be transferrable, but allows users to still swap those tokens if they
            // specify.
            //
            if (tokenValidation == providers_1.TokenValidationResult.STF &&
                (token.equals(tokenIn) || token.equals(tokenOut))) {
                return false;
            }
            return (tokenValidation == providers_1.TokenValidationResult.FOT ||
                tokenValidation == providers_1.TokenValidationResult.STF);
        });
        // Given all our candidate pools, compute all the possible ways to route from tokenIn to tokenOut.
        const { maxSwapsPerPath } = routingConfig;
        const routes = (0, compute_all_routes_1.computeAllV3Routes)(tokenIn, tokenOut, pools, maxSwapsPerPath);
        return {
            routes,
            candidatePools,
        };
    }
    async getQuotes(routes, amounts, percents, quoteToken, tradeType, routingConfig, candidatePools, gasModel) {
        util_1.log.info('Starting to get V3 quotes');
        if (gasModel === undefined) {
            throw new Error('GasModel for V3RouteWithValidQuote is required to getQuotes');
        }
        if (routes.length == 0) {
            return { routesWithValidQuotes: [], candidatePools };
        }
        // For all our routes, and all the fractional amounts, fetch quotes on-chain.
        const quoteFn = tradeType == sdk_core_1.TradeType.EXACT_INPUT
            ? this.onChainQuoteProvider.getQuotesManyExactIn.bind(this.onChainQuoteProvider)
            : this.onChainQuoteProvider.getQuotesManyExactOut.bind(this.onChainQuoteProvider);
        const beforeQuotes = Date.now();
        util_1.log.info(`Getting quotes for V3 for ${routes.length} routes with ${amounts.length} amounts per route.`);
        const { routesWithQuotes } = await quoteFn(amounts, routes, {
            blockNumber: routingConfig.blockNumber,
        });
        util_1.metric.putMetric('V3QuotesLoad', Date.now() - beforeQuotes, util_1.MetricLoggerUnit.Milliseconds);
        util_1.metric.putMetric('V3QuotesFetched', (0, lodash_1.default)(routesWithQuotes)
            .map(([, quotes]) => quotes.length)
            .sum(), util_1.MetricLoggerUnit.Count);
        const routesWithValidQuotes = [];
        for (const routeWithQuote of routesWithQuotes) {
            const [route, quotes] = routeWithQuote;
            for (let i = 0; i < quotes.length; i++) {
                const percent = percents[i];
                const amountQuote = quotes[i];
                const { quote, amount, sqrtPriceX96AfterList, initializedTicksCrossedList, gasEstimate, } = amountQuote;
                if (!quote ||
                    !sqrtPriceX96AfterList ||
                    !initializedTicksCrossedList ||
                    !gasEstimate) {
                    util_1.log.debug({
                        route: (0, util_1.routeToString)(route),
                        amountQuote,
                    }, 'Dropping a null V3 quote for route.');
                    continue;
                }
                const routeWithValidQuote = new entities_1.V3RouteWithValidQuote({
                    route,
                    rawQuote: quote,
                    amount,
                    percent,
                    sqrtPriceX96AfterList,
                    initializedTicksCrossedList,
                    quoterGasEstimate: gasEstimate,
                    gasModel,
                    quoteToken,
                    tradeType,
                    v3PoolProvider: this.v3PoolProvider,
                });
                routesWithValidQuotes.push(routeWithValidQuote);
            }
        }
        return {
            routesWithValidQuotes,
            candidatePools
        };
    }
}
exports.V3Quoter = V3Quoter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjMtcXVvdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL3F1b3RlcnMvdjMtcXVvdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGdEQUF3RTtBQUN4RSxvREFBdUI7QUFFdkIsa0RBUTRCO0FBQzVCLHdDQUE2RjtBQUc3RiwwQ0FBb0Q7QUFDcEQsd0VBQXFFO0FBQ3JFLDBFQUEwRztBQUcxRywrQ0FBMkM7QUFJM0MsTUFBYSxRQUFTLFNBQVEsd0JBQW1CO0lBSy9DLFlBQ0Usa0JBQXVDLEVBQ3ZDLGNBQStCLEVBQy9CLG9CQUEyQyxFQUMzQyxhQUE2QixFQUM3QixPQUFnQixFQUNoQix3QkFBNkMsRUFDN0Msc0JBQWdEO1FBRWhELEtBQUssQ0FBQyxhQUFhLEVBQUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLHNCQUFzQixDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDO1FBQzdDLElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxvQkFBb0IsQ0FBQztJQUNuRCxDQUFDO0lBRVMsS0FBSyxDQUFDLFNBQVMsQ0FDdkIsT0FBYyxFQUNkLFFBQWUsRUFDZixTQUFvQixFQUNwQixhQUFnQztRQUVoQyw2RUFBNkU7UUFDN0UsOEVBQThFO1FBQzlFLHlCQUF5QjtRQUN6QixNQUFNLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxHQUFHLE1BQU0sSUFBQSx5Q0FBbUIsRUFBQztZQUNqRSxPQUFPO1lBQ1AsUUFBUTtZQUNSLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNqQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMsd0JBQXdCO1lBQ3ZELFlBQVksRUFBRSxJQUFJLENBQUMsY0FBYztZQUNqQyxTQUFTLEVBQUUsU0FBUztZQUNwQixnQkFBZ0IsRUFBRSxJQUFJLENB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