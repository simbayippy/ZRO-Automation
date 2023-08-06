"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthEstimateGasSimulator = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const routers_1 = require("../routers");
const util_1 = require("../util");
const gas_factory_helpers_1 = require("../util/gas-factory-helpers");
const simulation_provider_1 = require("./simulation-provider");
// We multiply eth estimate gas by this to add a buffer for gas limits
const DEFAULT_ESTIMATE_MULTIPLIER = 1.2;
class EthEstimateGasSimulator extends simulation_provider_1.Simulator {
    constructor(chainId, provider, v2PoolProvider, v3PoolProvider, overrideEstimateMultiplier) {
        super(provider, chainId);
        this.v2PoolProvider = v2PoolProvider;
        this.v3PoolProvider = v3PoolProvider;
        this.overrideEstimateMultiplier = overrideEstimateMultiplier !== null && overrideEstimateMultiplier !== void 0 ? overrideEstimateMultiplier : {};
    }
    async ethEstimateGas(fromAddress, swapOptions, route, l2GasData, providerConfig) {
        const currencyIn = route.trade.inputAmount.currency;
        let estimatedGasUsed;
        if (swapOptions.type == routers_1.SwapType.UNIVERSAL_ROUTER) {
            util_1.log.info({ methodParameters: route.methodParameters }, 'Simulating using eth_estimateGas on Universal Router');
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: route.methodParameters.calldata,
                    to: route.methodParameters.to,
                    from: fromAddress,
                    value: bignumber_1.BigNumber.from(currencyIn.isNative ? route.methodParameters.value : '0'),
                });
            }
            catch (e) {
                util_1.log.error({ e }, 'Error estimating gas');
                return Object.assign(Object.assign({}, route), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
            }
        }
        else if (swapOptions.type == routers_1.SwapType.SWAP_ROUTER_02) {
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: route.methodParameters.calldata,
                    to: route.methodParameters.to,
                    from: fromAddress,
                    value: bignumber_1.BigNumber.from(currencyIn.isNative ? route.methodParameters.value : '0'),
                });
            }
            catch (e) {
                util_1.log.error({ e }, 'Error estimating gas');
                return Object.assign(Object.assign({}, route), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
            }
        }
        else {
            throw new Error(`Unsupported swap type ${swapOptions}`);
        }
        estimatedGasUsed = this.adjustGasEstimate(estimatedGasUsed);
        util_1.log.info({
            methodParameters: route.methodParameters,
            estimatedGasUsed: estimatedGasUsed.toString(),
        }, 'Simulated using eth_estimateGas on SwapRouter02');
        const { estimatedGasUsedUSD, estimatedGasUsedQuoteToken, quoteGasAdjusted, } = await (0, gas_factory_helpers_1.calculateGasUsed)(route.quote.currency.chainId, route, estimatedGasUsed, this.v2PoolProvider, this.v3PoolProvider, l2GasData, providerConfig);
        return Object.assign(Object.assign({}, (0, gas_factory_helpers_1.initSwapRouteFromExisting)(route, this.v2PoolProvider, this.v3PoolProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD)), { simulationStatus: simulation_provider_1.SimulationStatus.Succeeded });
    }
    adjustGasEstimate(gasLimit) {
        var _a;
        const estimateMultiplier = (_a = this.overrideEstimateMultiplier[this.chainId]) !== null && _a !== void 0 ? _a : DEFAULT_ESTIMATE_MULTIPLIER;
        const adjustedGasEstimate = bignumber_1.BigNumber.from(gasLimit)
            .mul(estimateMultiplier * 100)
            .div(100);
        return adjustedGasEstimate;
    }
    async simulateTransaction(fromAddress, swapOptions, swapRoute, l2GasData, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _providerConfig) {
        const inputAmount = swapRoute.trade.inputAmount;
        if (inputAmount.currency.isNative ||
            (await this.checkTokenApproved(fromAddress, inputAmount, swapOptions, this.provider))) {
            return await this.ethEstimateGas(fromAddress, swapOptions, swapRoute, l2GasData);
        }
        else {
            util_1.log.info('Token not approved, skipping simulation');
            return Object.assign(Object.assign({}, swapRoute), { simulationStatus: simulation_provider_1.SimulationStatus.NotApproved });
        }
    }
}
exports.EthEstimateGasSimulator = EthEstimateGasSimulator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx3REFBcUQ7QUFJckQsd0NBQThEO0FBQzlELGtDQUE4QjtBQUM5QixxRUFHcUM7QUFHckMsK0RBQW9FO0FBS3BFLHNFQUFzRTtBQUN0RSxNQUFNLDJCQUEyQixHQUFHLEdBQUcsQ0FBQztBQUV4QyxNQUFhLHVCQUF3QixTQUFRLCtCQUFTO0lBS3BELFlBQ0UsT0FBZ0IsRUFDaEIsUUFBeUIsRUFDekIsY0FBK0IsRUFDL0IsY0FBK0IsRUFDL0IsMEJBQThEO1FBRTlELEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekIsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDckMsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7UUFDckMsSUFBSSxDQUFDLDBCQUEwQixHQUFHLDBCQUEwQixhQUExQiwwQkFBMEIsY0FBMUIsMEJBQTBCLEdBQUksRUFBRSxDQUFDO0lBQ3JFLENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUNsQixXQUFtQixFQUNuQixXQUF3QixFQUN4QixLQUFnQixFQUNoQixTQUE2QyxFQUM3QyxjQUErQjtRQUUvQixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUM7UUFDcEQsSUFBSSxnQkFBMkIsQ0FBQztRQUNoQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLElBQUksa0JBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNqRCxVQUFHLENBQUMsSUFBSSxDQUNOLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGdCQUFnQixFQUFFLEVBQzVDLHNEQUFzRCxDQUN2RCxDQUFDO1lBQ0YsSUFBSTtnQkFDRixnQkFBZ0IsR0FBRyxN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