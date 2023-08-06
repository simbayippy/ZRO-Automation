import { RoutePlanner } from '../../utils/routerCommands';
import { Trade as RouterTrade, SwapOptions as RouterSwapOptions } from '@uniswap/router-sdk';
import { Permit2Permit } from '../../utils/inputTokens';
import { Currency, TradeType } from '@uniswap/sdk-core';
import { Command, RouterTradeType, TradeConfig } from '../Command';
export declare type SwapOptions = Omit<RouterSwapOptions, 'inputTokenPermit'> & {
    inputTokenPermit?: Permit2Permit;
};
export declare class UniswapTrade implements Command {
    trade: RouterTrade<Currency, Currency, TradeType>;
    options: SwapOptions;
    readonly tradeType: RouterTradeType;
    constructor(trade: RouterTrade<Currency, Currency, TradeType>, options: SwapOptions);
    encode(planner: RoutePlanner, _config: TradeConfig): void;
}
