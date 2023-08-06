"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IOnChainGasModelFactory = exports.IV2GasModelFactory = exports.usdGasTokensByChain = void 0;
const sdk_core_1 = require("@uniswap/sdk-core");
const token_provider_1 = require("../../../providers/token-provider");
// When adding new usd gas tokens, ensure the tokens are ordered 
// from tokens with highest decimals to lowest decimals. For example,
// DAI_AVAX has 18 decimals and comes before USDC_AVAX which has 6 decimals.
exports.usdGasTokensByChain = {
    [sdk_core_1.ChainId.MAINNET]: [token_provider_1.DAI_MAINNET, token_provider_1.USDC_MAINNET, token_provider_1.USDT_MAINNET],
    [sdk_core_1.ChainId.ARBITRUM_ONE]: [token_provider_1.DAI_ARBITRUM, token_provider_1.USDC_ARBITRUM, token_provider_1.USDT_ARBITRUM],
    [sdk_core_1.ChainId.OPTIMISM]: [token_provider_1.DAI_OPTIMISM, token_provider_1.USDC_OPTIMISM, token_provider_1.USDT_OPTIMISM],
    [sdk_core_1.ChainId.OPTIMISM_GOERLI]: [
        token_provider_1.DAI_OPTIMISM_GOERLI,
        token_provider_1.USDC_OPTIMISM_GOERLI,
        token_provider_1.USDT_OPTIMISM_GOERLI,
    ],
    [sdk_core_1.ChainId.ARBITRUM_GOERLI]: [token_provider_1.USDC_ARBITRUM_GOERLI],
    [sdk_core_1.ChainId.GOERLI]: [token_provider_1.DAI_GOERLI, token_provider_1.USDC_GOERLI, token_provider_1.USDT_GOERLI, token_provider_1.WBTC_GOERLI],
    [sdk_core_1.ChainId.SEPOLIA]: [token_provider_1.USDC_SEPOLIA, token_provider_1.DAI_SEPOLIA],
    [sdk_core_1.ChainId.POLYGON]: [token_provider_1.USDC_POLYGON],
    [sdk_core_1.ChainId.POLYGON_MUMBAI]: [token_provider_1.DAI_POLYGON_MUMBAI],
    [sdk_core_1.ChainId.CELO]: [token_provider_1.CUSD_CELO],
    [sdk_core_1.ChainId.CELO_ALFAJORES]: [token_provider_1.CUSD_CELO_ALFAJORES],
    [sdk_core_1.ChainId.GNOSIS]: [token_provider_1.USDC_ETHEREUM_GNOSIS],
    [sdk_core_1.ChainId.MOONBEAM]: [token_provider_1.USDC_MOONBEAM],
    [sdk_core_1.ChainId.BNB]: [token_provider_1.USDT_BNB, token_provider_1.USDC_BNB, token_provider_1.DAI_BNB],
    [sdk_core_1.ChainId.AVALANCHE]: [token_provider_1.DAI_AVAX, token_provider_1.USDC_AVAX],
    [sdk_core_1.ChainId.BASE]: [token_provider_1.USDC_BASE],
};
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IV2GasModelFactory
 */
class IV2GasModelFactory {
}
exports.IV2GasModelFactory = IV2GasModelFactory;
/**
 * Factory for building gas models that can be used with any route to generate
 * gas estimates.
 *
 * Factory model is used so that any supporting data can be fetched once and
 * returned as part of the model.
 *
 * @export
 * @abstract
 * @class IOnChainGasModelFactory
 */
class IOnChainGasModelFactory {
}
exports.IOnChainGasModelFactory = IOnChainGasModelFactory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FzLW1vZGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2dhcy1tb2RlbHMvZ2FzLW1vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLGdEQUFtRDtBQUluRCxzRUFnQzJDO0FBWTNDLGlFQUFpRTtBQUNqRSxxRUFBcUU7QUFDckUsNEVBQTRFO0FBQy9ELFFBQUEsbUJBQW1CLEdBQXVDO0lBQ3JFLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLDRCQUFXLEVBQUUsNkJBQVksRUFBRSw2QkFBWSxDQUFDO0lBQzVELENBQUMsa0JBQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLDZCQUFZLEVBQUUsOEJBQWEsRUFBRSw4QkFBYSxDQUFDO0lBQ3BFLENBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLDZCQUFZLEVBQUUsOEJBQWEsRUFBRSw4QkFBYSxDQUFDO0lBQ2hFLENBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUN6QixvQ0FBbUI7UUFDbkIscUNBQW9CO1FBQ3BCLHFDQUFvQjtLQUNyQjtJQUNELENBQUMsa0JBQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDLHFDQUFvQixDQUFDO0lBQ2pELENBQUMsa0JBQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLDJCQUFVLEVBQUUsNEJBQVcsRUFBRSw0QkFBVyxFQUFFLDRCQUFXLENBQUM7SUFDckUsQ0FBQyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsNkJBQVksRUFBRSw0QkFBVyxDQUFDO0lBQzlDLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLDZCQUFZLENBQUM7SUFDakMsQ0FBQyxrQkFBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsbUNBQWtCLENBQUM7SUFDOUMsQ0FBQyxrQkFBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsMEJBQVMsQ0FBQztJQUMzQixDQUFDLGtCQUFPLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxvQ0FBbUIsQ0FBQztJQUMvQyxDQUFDLGtCQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxxQ0FBb0IsQ0FBQztJQUN4QyxDQUFDLGtCQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyw4QkFBYSxDQUFDO0lBQ25DLENBQUMsa0JBQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLHlCQUFRLEVBQUUseUJBQVEsRUFBRSx3QkFBTyxDQUFDO0lBQzVDLENBQUMsa0JBQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLHlCQUFRLEVBQUUsMEJBQVMsQ0FBQztJQUMxQyxDQUFDLGtCQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQywwQkFBUyxDQUFDO0NBQzVCLENBQUM7QUEyREY7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQXNCLGtCQUFrQjtDQU92QztBQVBELGdEQU9DO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQXNCLHVCQUF1QjtDQVk1QztBQVpELDBEQVlDIn0=