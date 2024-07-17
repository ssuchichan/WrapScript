import { assertCurrentChain, formatEther, minInt104, parseAbi, parseEther } from "viem";
import { uniswapV2RounterABI } from "../abi/uniswapV2Router";
import { publicClient, walletClient } from "../config";
import { lpStake, nftStake } from "../abi/stake";
import { erc20Abi } from "../abi/erc20Abi";

const uniswapV2Router = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d" as `0x${string}`;
const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as `0x${string}`;
const wrapCoin = "0x989436e4194af162546F595Afc6336A15b3DCa7d" as `0x${string}`;
const wrapWETHPair = "0x5Ff788F688650d3b0cB37E976e71d604D8229064" as `0x${string}`;

const swapETHToWrap = async (ethNumber: bigint) => {
    const wrapNumber = await publicClient.readContract({
        address: uniswapV2Router,
        abi: uniswapV2RounterABI,
        functionName: "getAmountsOut",
        args: [ethNumber, [weth, wrapCoin]]
    }) as [bigint, bigint];

    // console.log(formatEther(wrapNumber[1]))
    return wrapNumber[1]
}

const swapLpToToken = async (lp: bigint) => {
    const [wrapBalance, wethBalance, lpTotalSupply] = await publicClient.multicall({
        contracts: [
            {
                address: wrapCoin,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [wrapWETHPair]
            },
            {
                address: weth,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [wrapWETHPair]
            },
            {
                address: wrapWETHPair,
                abi: parseAbi(["function totalSupply() external view returns (uint)"]),
                functionName: "totalSupply"
            }
        ]
    })


    return {
        wrapCoinAmount: lp * wrapBalance.result! / lpTotalSupply.result!,
        ethAmount: lp * wethBalance.result! / lpTotalSupply.result!
    }
}

export const calculateDotAgencyAPY = async () => {
    const [tokenPerBlock, l1StakingOfERC20, l1StakingOfETH] = await publicClient.multicall({
        contracts: [
            {
                ...nftStake,
                functionName: "tokenPerBlock"
            },
            {
                ...nftStake,
                functionName: "l1StakingOfERC20"
            },
            {
                ...nftStake,
                functionName: "l1StakingOfETH"
            }
        ]
    })

    const allReward = tokenPerBlock.result! * BigInt(2628000)

    const wrapReward = allReward * BigInt(7) / BigInt(8)
    const ethReward = allReward * BigInt(1) / BigInt(8)

    const wrapAPY = wrapReward * BigInt(100) / l1StakingOfERC20.result![0]

    const stakeETHToWrap = await swapETHToWrap(l1StakingOfETH.result![0])
    const ethAPY = ethReward * BigInt(100) / stakeETHToWrap
    
    // console.log(`WRAP Year Reward: ${formatEther(wrapReward)}`)
    // console.log(`ETH Year Reward: ${formatEther(ethReward)}`)

    console.log(`WRAP Stake TVL: ${formatEther(l1StakingOfERC20.result![0])} WRAP`)
    console.log(`ETH Stake TVL: ${formatEther(l1StakingOfETH.result![0])} ETH`)

    console.log(`WRAP Stake Reward APY: ${wrapAPY}%`)
    console.log(`ETH Stake Reward APY: ${ethAPY}%`)
}

export const calculateLpAPY = async () => {
    const [tokenPerBlock, stakeTotalLp] = await publicClient.multicall({
        contracts: [
            {
                ...lpStake,
                functionName: "rewardPerBlock"
            },
            {
                ...lpStake,
                functionName: "LPSupply"
            }
        ]
    })

    const allReward = tokenPerBlock.result! * BigInt(2628000) / BigInt(1e40)
    const {wrapCoinAmount, ethAmount} = await swapLpToToken(stakeTotalLp.result!)
    const ethToWrap = await swapETHToWrap(ethAmount)
    const lpAPY = allReward * BigInt(100) / (wrapCoinAmount + ethToWrap)

    console.log(`LP Stake Reward APY: ${lpAPY}%`)
}
// calculateDotAgencyAPY()
// calculateLpAPY()
// await calculateAgentAPY(
//     "0x5ce1074cbfc094e378b1a6f4a3a6b359b67b3f23", 
//     BigInt(2),
//     parseEther("1.081727998525441509"),
//     AgentCoin.WrapCoin
// )