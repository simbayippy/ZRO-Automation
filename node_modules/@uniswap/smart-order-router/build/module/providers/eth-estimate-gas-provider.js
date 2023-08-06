import { BigNumber } from '@ethersproject/bignumber';
import { SwapType } from '../routers';
import { log } from '../util';
import { calculateGasUsed, initSwapRouteFromExisting, } from '../util/gas-factory-helpers';
import { SimulationStatus, Simulator } from './simulation-provider';
// We multiply eth estimate gas by this to add a buffer for gas limits
const DEFAULT_ESTIMATE_MULTIPLIER = 1.2;
export class EthEstimateGasSimulator extends Simulator {
    constructor(chainId, provider, v2PoolProvider, v3PoolProvider, overrideEstimateMultiplier) {
        super(provider, chainId);
        this.v2PoolProvider = v2PoolProvider;
        this.v3PoolProvider = v3PoolProvider;
        this.overrideEstimateMultiplier = overrideEstimateMultiplier !== null && overrideEstimateMultiplier !== void 0 ? overrideEstimateMultiplier : {};
    }
    async ethEstimateGas(fromAddress, swapOptions, route, l2GasData, providerConfig) {
        const currencyIn = route.trade.inputAmount.currency;
        let estimatedGasUsed;
        if (swapOptions.type == SwapType.UNIVERSAL_ROUTER) {
            log.info({ methodParameters: route.methodParameters }, 'Simulating using eth_estimateGas on Universal Router');
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: route.methodParameters.calldata,
                    to: route.methodParameters.to,
                    from: fromAddress,
                    value: BigNumber.from(currencyIn.isNative ? route.methodParameters.value : '0'),
                });
            }
            catch (e) {
                log.error({ e }, 'Error estimating gas');
                return {
                    ...route,
                    simulationStatus: SimulationStatus.Failed,
                };
            }
        }
        else if (swapOptions.type == SwapType.SWAP_ROUTER_02) {
            try {
                estimatedGasUsed = await this.provider.estimateGas({
                    data: route.methodParameters.calldata,
                    to: route.methodParameters.to,
                    from: fromAddress,
                    value: BigNumber.from(currencyIn.isNative ? route.methodParameters.value : '0'),
                });
            }
            catch (e) {
                log.error({ e }, 'Error estimating gas');
                return {
                    ...route,
                    simulationStatus: SimulationStatus.Failed,
                };
            }
        }
        else {
            throw new Error(`Unsupported swap type ${swapOptions}`);
        }
        estimatedGasUsed = this.adjustGasEstimate(estimatedGasUsed);
        log.info({
            methodParameters: route.methodParameters,
            estimatedGasUsed: estimatedGasUsed.toString(),
        }, 'Simulated using eth_estimateGas on SwapRouter02');
        const { estimatedGasUsedUSD, estimatedGasUsedQuoteToken, quoteGasAdjusted, } = await calculateGasUsed(route.quote.currency.chainId, route, estimatedGasUsed, this.v2PoolProvider, this.v3PoolProvider, l2GasData, providerConfig);
        return {
            ...initSwapRouteFromExisting(route, this.v2PoolProvider, this.v3PoolProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD),
            simulationStatus: SimulationStatus.Succeeded,
        };
    }
    adjustGasEstimate(gasLimit) {
        var _a;
        const estimateMultiplier = (_a = this.overrideEstimateMultiplier[this.chainId]) !== null && _a !== void 0 ? _a : DEFAULT_ESTIMATE_MULTIPLIER;
        const adjustedGasEstimate = BigNumber.from(gasLimit)
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
            log.info('Token not approved, skipping simulation');
            return {
                ...swapRoute,
                simulationStatus: SimulationStatus.NotApproved,
            };
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvZXRoLWVzdGltYXRlLWdhcy1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFJckQsT0FBTyxFQUEwQixRQUFRLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDOUQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUM5QixPQUFPLEVBQ0wsZ0JBQWdCLEVBQ2hCLHlCQUF5QixHQUMxQixNQUFNLDZCQUE2QixDQUFDO0FBR3JDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUtwRSxzRUFBc0U7QUFDdEUsTUFBTSwyQkFBMkIsR0FBRyxHQUFHLENBQUM7QUFFeEMsTUFBTSxPQUFPLHVCQUF3QixTQUFRLFNBQVM7SUFLcEQsWUFDRSxPQUFnQixFQUNoQixRQUF5QixFQUN6QixjQUErQixFQUMvQixjQUErQixFQUMvQiwwQkFBOEQ7UUFFOUQsS0FBSyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6QixJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsMEJBQTBCLEdBQUcsMEJBQTBCLGFBQTFCLDBCQUEwQixjQUExQiwwQkFBMEIsR0FBSSxFQUFFLENBQUM7SUFDckUsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjLENBQ2xCLFdBQW1CLEVBQ25CLFdBQXdCLEVBQ3hCLEtBQWdCLEVBQ2hCLFNBQTZDLEVBQzdDLGNBQStCO1FBRS9CLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUNwRCxJQUFJLGdCQUEyQixD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