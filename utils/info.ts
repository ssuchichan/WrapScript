import boxen from "boxen"
import chalk from 'chalk'
import { getAgencyStrategy, getAgentBaseInfo, getAgentName } from "./data"
import { inputAddress } from "./display"
import { publicClient, WrapCoinAddress } from "../config"
import { agentABI } from "../abi/agent"
import { formatEther, zeroAddress } from "viem"
import { nftStake } from "../abi/stake"
import { erc20Abi } from "../abi/erc20Abi"
import { couldStartTrivia } from "typescript"

export const getERC7527StakeData = async () => {
    const appAddress = await inputAddress("Enter the ERC7527 token contract address: ")
    const agentInfo = await getAgentBaseInfo(appAddress)

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
        const stakeReward = agentInfo.unspentRewards / (agentInfo.points + BigInt(1))
        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(nowBlockNumber) + 42000)}\n`
            + `Stake Reward: ${chalk.blue(formatEther(stakeReward))}`, { padding: 1 }
        )) 
    } else {
        const stakeReward = (agentInfo.endBlockOfEpoch - nowBlockNumber) * agentInfo.tokenPerBlock / (agentInfo.points + BigInt(1)) / BigInt(1e12)

        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(agentInfo.endBlockOfEpoch))}\n`
            + `Stake Reward: ${chalk.blue(formatEther(stakeReward))}`, { padding: 1 }
        ))
    }
    
    console.log(`${chalk.blueBright("Stake Reward")} refers to the reward you get when you stake to ${chalk.blueBright("End BlockNumber Of Epoch")}`)
}

export const getDotAgencyEpochReward = async () => {
    const appAddress = await inputAddress("Enter the ERC7527 token contract address: ")

    const agencyAddress = await publicClient.readContract({
        abi: agentABI,
        address: appAddress,
        functionName: "getAgency"
    })
    const agencySettings = await getAgencyStrategy(agencyAddress)

    const agencyName = await getAgentName(agencySettings[0])
    const nowBlockNumber = await publicClient.getBlockNumber()

    const [ endBlockOfEpoch, tokenPerBlock ] = await publicClient.multicall({
        contracts: [
            {
                ...nftStake,
                functionName: "endBlockOfEpoch"
            },
            {
                ...nftStake,
                functionName: "tokenPerBlock"
            }
        ]
    })
    
    const stakingData = await publicClient.readContract({
        ...nftStake,
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

        const [tvlOfTotal] = await publicClient.readContract({
            ...nftStake,
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
            epochReward = tokenPerBlock.result! * (endBlockNumberOfEpoch - nowBlockNumber) * BigInt(875) / BigInt(1000) * tvlOfAgency / stakeTVL
        } else {
            endBlockNumberOfEpoch = nowBlockNumber + BigInt(42000)

            const reawrd = await publicClient.readContract({
                address: WrapCoinAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: ["0xC1d65a61955Ae7A0194B05CC53f05d9275C553b0"]
            })
            epochReward = reawrd / BigInt(100) * BigInt(875) / BigInt(1000)
        }

        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(endBlockNumberOfEpoch))}\n`
            + `DotAgency Reward: ${chalk.blue(formatEther(epochReward * BigInt(8) / BigInt(100)))}\n`
            + `ERC7527 Reward: ${chalk.blue(formatEther(epochReward * BigInt(9) / BigInt(10)))}\n`
            + `Epoch All Reward: ${chalk.blue(formatEther(epochReward))}\n`
            + `Agency TVL: ${chalk.blue(formatEther(tvlOfAgency))}\n`
            + `WRAP Stake TVL: ${chalk.blue(formatEther(stakeTVL))}`, { padding: 1 }
        ))  
    }

    if (agencySettings[1].currency == zeroAddress) {
        const tvlOfAgency = await publicClient.getBalance({
            address: agencyAddress
        })

        const [tvlOfTotal] = await publicClient.readContract({
            ...nftStake,
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
        console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
            + `End BlockNumber Of Epoch: ${chalk.blue(Number(endBlockNumberOfEpoch))}\n`
            + `DotAgency Reward: ${chalk.blue(formatEther(epochReward * BigInt(8) / BigInt(100)))}\n`
            + `ERC7527 Reward: ${chalk.blue(formatEther(epochReward * BigInt(9) / BigInt(10)))}\n`
            + `Epoch All Reward: ${chalk.blue(formatEther(epochReward))}\n`
            + `Agency TVL: ${chalk.blue(formatEther(tvlOfAgency))}\n`
            + `ETH Stake TVL: ${chalk.blue(formatEther(stakeTVL))}`, { padding: 1 }
        ))  
    }
}