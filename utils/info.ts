import boxen from "boxen"
import chalk from 'chalk'
import { getAgencyStrategy, getAgentBaseInfo, getAgentName, getRealizedReward } from "./data"
import { inputAddress } from "./display"
import { publicClient, stakeVersionSelect, WrapCoinAddress } from "../config"
import { agentABI } from "../abi/agent"
import { formatEther, zeroAddress } from "viem"
import { lpStake, nftStakeABI } from "../abi/stake"
import { erc20Abi } from "../abi/erc20Abi"

export const getERC7527StakeData = async () => {
    const stakeAddress = stakeVersionSelect.getStakeVersion()
    const appAddress = await inputAddress("Enter the ERC7527 token contract address: ")
    const agentInfo = await getAgentBaseInfo(appAddress, stakeAddress)

    const agencyAddress = await publicClient.readContract({
        abi: agentABI,
        address: appAddress,
        functionName: "getAgency"
    })
    const agencySettings = await getAgencyStrategy(agencyAddress)
    const agencyName = await getAgentName(agencySettings[0])

    if (agencySettings[1].currency !== WrapCoinAddress && agencySettings[1].currency !== zeroAddress) {
        console.log(`${chalk.blue(agencyName)} does not use WRAP or ETH as currency.`)
        return
    }

    if (agentInfo.endBlockOfEpoch === BigInt(0)) {
        console.log(`${chalk.blue(agencyName)} has not initiated staking.`)
        return
    }
    const nowBlockNumber = await publicClient.getBlockNumber()

    if (agentInfo.endBlockOfEpoch < nowBlockNumber) {
        const stakeReward = agentInfo.unspentRewards / (agentInfo.points + BigInt(1)) / BigInt(1e20)
        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(nowBlockNumber) + 42000)}\n`
            + `Stake Reward: ${chalk.blue(formatEther(stakeReward))}`, { padding: 1 }
        ))
    } else {
        const stakeReward = (agentInfo.endBlockOfEpoch - nowBlockNumber) * agentInfo.tokenPerBlock / (agentInfo.points + BigInt(1)) / BigInt(1e20)

        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(agentInfo.endBlockOfEpoch))}\n`
            + `Stake Reward: ${chalk.blue(formatEther(stakeReward))}`, { padding: 1 }
        ))
    }

    console.log(`${chalk.blueBright("Stake Reward")} refers to the reward you get when you stake to ${chalk.blueBright("End BlockNumber Of Epoch")}`)
}

export const getDotAgencyEpochReward = async () => {
    const stakeAddress = stakeVersionSelect.getStakeVersion()
    const appAddress = await inputAddress("Enter the ERC7527 token contract address: ")

    const agencyAddress = await publicClient.readContract({
        abi: agentABI,
        address: appAddress,
        functionName: "getAgency"
    })
    const agencySettings = await getAgencyStrategy(agencyAddress)

    const agencyName = await getAgentName(agencySettings[0])
    const nowBlockNumber = await publicClient.getBlockNumber()

    const [endBlockOfEpoch, tokenPerBlock, lastRewardBlock] = await publicClient.multicall({
        contracts: [
            {
                address: stakeAddress,
                abi: nftStakeABI,
                functionName: "endBlockOfEpoch"
            },
            {
                address: stakeAddress,
                abi: nftStakeABI,
                functionName: "tokenPerBlock"
            },
            {
                address: stakeAddress,
                abi: nftStakeABI,
                functionName: "lastRewardBlock"
            },
        ]
    })

    const stakingData = await publicClient.readContract({
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "stakingOfNFT",
        args: [appAddress]
    })

    if (agencySettings[1].currency == WrapCoinAddress) {
        const tvlOfAgency = await publicClient.readContract({
            address: WrapCoinAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [agencyAddress]
        })

        const [tvlOfTotal, accTokenPerShare] = await publicClient.readContract({
            address: stakeAddress,
            abi: nftStakeABI,
            functionName: "l1StakingOfERC20"
        })

        let stakeTVL: bigint;
        let epochReward: bigint;
        let endBlockNumberOfEpoch: bigint;

        if (stakingData[0] == BigInt(0)) {
            stakeTVL = tvlOfAgency + tvlOfTotal
        } else {
            stakeTVL = tvlOfTotal
        }
        if (nowBlockNumber < endBlockOfEpoch.result!) {
            endBlockNumberOfEpoch = endBlockOfEpoch.result!
            epochReward = tokenPerBlock.result! * (endBlockNumberOfEpoch - nowBlockNumber) * BigInt(7) / BigInt(8) * tvlOfAgency / stakeTVL / BigInt(1e20)
        } else {
            endBlockNumberOfEpoch = nowBlockNumber + BigInt(42000)

            const reawrd = await publicClient.readContract({
                address: WrapCoinAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: ["0xC1d65a61955Ae7A0194B05CC53f05d9275C553b0"]
            })
            epochReward = reawrd / BigInt(100) * BigInt(875) / BigInt(1000) / BigInt(1e20)
        }

        const realizedReward = await getRealizedReward(
            stakeAddress,
            lastRewardBlock.result!,
            tokenPerBlock.result!,
            true,
            accTokenPerShare,
            tvlOfTotal,
            stakingData[0],
            stakingData[4]
        )

        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(endBlockNumberOfEpoch))}\n`
            + `DotAgency Reward: ${chalk.blue(formatEther((realizedReward + stakingData[6]) * BigInt(5243)/ BigInt(1e20 * 65536)))}\n`
            + `ERC7527 Reward: ${chalk.blue(formatEther((realizedReward + stakingData[6]) * BigInt(58982) / BigInt(1e20 * 65536)))}\n`
            + `DotAgency Expected Reward: ${chalk.blue(formatEther(epochReward * BigInt(8) / BigInt(100)))}\n`
            + `ERC7527 Expected Reward: ${chalk.blue(formatEther(epochReward * BigInt(9) / BigInt(10)))}\n`
            + `Epoch All Reward: ${chalk.blue(formatEther(epochReward))}\n`
            + `Agency TVL: ${chalk.blue(formatEther(tvlOfAgency))}\n`
            + `WRAP Stake TVL: ${chalk.blue(formatEther(stakeTVL))}`, { padding: 1 }
        ))
    }

    if (agencySettings[1].currency == zeroAddress) {
        const tvlOfAgency = await publicClient.getBalance({
            address: agencyAddress
        })

        const [tvlOfTotal, accTokenPerShare] = await publicClient.readContract({
            address: stakeAddress,
            abi: nftStakeABI,
            functionName: "l1StakingOfETH"
        })

        let stakeTVL: bigint;
        let epochReward: bigint;
        let endBlockNumberOfEpoch: bigint;

        if (stakingData[0] == BigInt(0)) {
            stakeTVL = tvlOfAgency + tvlOfTotal
        } else {
            stakeTVL = tvlOfTotal
        }

        if (nowBlockNumber < endBlockOfEpoch.result!) {
            endBlockNumberOfEpoch = endBlockOfEpoch.result!
            epochReward = tokenPerBlock.result! * (endBlockNumberOfEpoch - nowBlockNumber) * BigInt(125) / BigInt(1000) * tvlOfAgency / stakeTVL
        } else {
            endBlockNumberOfEpoch = nowBlockNumber + BigInt(42000)

            const reawrd = await publicClient.readContract({
                address: WrapCoinAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: ["0xC1d65a61955Ae7A0194B05CC53f05d9275C553b0"]
            })
            epochReward = reawrd / BigInt(100) * BigInt(125) / BigInt(1000)
        }

        const realizedReward = await getRealizedReward(
            stakeAddress,
            lastRewardBlock.result!,
            tokenPerBlock.result!,
            false,
            accTokenPerShare,
            tvlOfTotal,
            stakingData[0],
            stakingData[4]
        )    
        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(endBlockNumberOfEpoch))}\n`
            + `DotAgency Reward: ${chalk.blue(formatInternalReward((realizedReward + stakingData[6]) * BigInt(5243)/ BigInt(1e12 * 65536)))}\n`
            + `ERC7527 Reward: ${chalk.blue(formatInternalReward((realizedReward + stakingData[6]) * BigInt(58982) / BigInt(1e12 * 65536)))}\n`
            + `DotAgency Expected Reward: ${chalk.blue(formatInternalReward(epochReward * BigInt(8) / BigInt(100)))}\n`
            + `ERC7527 Expected Reward: ${chalk.blue(formatInternalReward(epochReward * BigInt(9) / BigInt(10)))}\n`
            + `Epoch All Reward: ${chalk.blue(formatInternalReward(epochReward))}\n`
            + `Agency TVL: ${chalk.blue(formatInternalReward(tvlOfAgency))}\n`
            + `ETH Stake TVL: ${chalk.blue(formatInternalReward(stakeTVL))}`, { padding: 1 }
        ))
    }
}

export const lpStakeReward = async () => {
    const userAddress = await inputAddress("Please enter the address of the LP token staker: ")
    const [amount] = await publicClient.readContract({
        ...lpStake,
        functionName: "userInfo",
        args: [userAddress]
    })

    const [endBlockOfEpoch, totalStakeLp, rewardPerBlock] = await publicClient.multicall({
        contracts: [
            {
                ...lpStake,
                functionName: "endBlockOfEpoch"
            },
            {
                ...lpStake,
                functionName: "LPSupply"
            },
            {
                ...lpStake,
                functionName: "rewardPerBlock"
            }
        ]
    })

    const nowBlockNumber = await publicClient.getBlockNumber()
    const stakePercentage = Number(amount * BigInt(10000) / totalStakeLp.result!) / 100

    let stakeReward: bigint

    if (endBlockOfEpoch.result! > nowBlockNumber) {
        stakeReward = rewardPerBlock.result! * (endBlockOfEpoch.result! - nowBlockNumber) * amount / totalStakeLp.result! / BigInt(1e40)
    } else {
        const inputReward = await publicClient.readContract({
            address: WrapCoinAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: ["0xe3c6EF4CCF39E117a5504653b5A704abd091C7d3"]
        })

        stakeReward = inputReward * amount / totalStakeLp.result! / BigInt(1e40)
    }

    console.log(boxen(`Stake LP Amount: ${chalk.blue(formatEther(amount))} (${stakePercentage}%)\n`
        + `Total LP Stake Amount: ${chalk.blue(formatEther(totalStakeLp.result!))}\n`
        + `Stake Reward: ${chalk.blue(formatEther(stakeReward))}\n`
        + `End BlockNumber Of Epoch: ${chalk.blue(Number(endBlockOfEpoch.result))}`, { padding: 1 }
    ))
}