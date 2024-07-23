import { lpStake, nftStakeABI } from "../abi/stake"
import { agencyABI } from "../abi/agency"
import { account, walletClient, publicClient, userConfig, WrapCoinAddress, uniswapV2Pair, versionSelect, stakeVersionSelect } from "../config"
import { chooseAgencyNFTWithTokenId, displayConfirmAndExit, inputETHNumber, selectWrapAddress } from './display'
import select from '@inquirer/select'
import chalk from 'chalk'
import { getAgencyStrategy, getAgentBaseInfo, getAgentERC6551AddressByTokenID, getDotAgencyRealizedReward, getERC20Approve } from "./data"
import { Abi, Chain, SimulateContractParameters, formatEther, formatUnits, Address } from "viem"
import { erc20Abi } from "../abi/erc20Abi"
import { sleep } from "bun"

export const approvePush = async (stakeAddress: `0x${string}`) => {
    const agencyAddress = await selectWrapAddress(userConfig)

    const { request } = await publicClient.simulateContract({
        account,
        abi: agencyABI,
        address: agencyAddress,
        functionName: "forceApprove",
        args: [
            "0x3c6e2f22",
            stakeAddress
        ]
    })

    const forceApproveHash = await walletClient.writeContract(request)

    console.log(`Push Config Hash: ${chalk.blue(forceApproveHash)}`)
}

const stakeAgencyNFT = async (stakeAddress: `0x${string}`) => {
    const agencySelectConfig = await chooseAgencyNFTWithTokenId(userConfig)
    
    const { request } = await publicClient.simulateContract({
        account,
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "stake",
        args: [
            agencySelectConfig.agencyStrategy[0], agencySelectConfig.agencyTokenId
        ]
    })
    const stakeHash = await walletClient.writeContract(request)

    console.log(`Stake NFT Hash: ${chalk.blue(stakeHash)}`)
}

const getL1EndBlock = async (stakeAddress: `0x${string}`) => {
    const endBlockOfEpoch = await publicClient.readContract({
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "endBlockOfEpoch"
    })
    const nowBlockNumber = await publicClient.getBlockNumber()

    if (endBlockOfEpoch > nowBlockNumber) {
        return { endBlock: nowBlockNumber, isEnd: false }
    } else {
        return { endBlock: endBlockOfEpoch, isEnd: true }
    }
}

const updatePoolL1 = async (stakeAddress: `0x${string}`) => {
    const { isEnd } = await getL1EndBlock(stakeAddress)
    if (!isEnd) {
        console.log("In Epoch...")
    } else {
        // console.log(`End Block Of Epoch: ${chalk.blue(endBlockOfEpoch)} Now Block Number: ${chalk.blue(nowBlockNumber)}`)
        // console.log("Not In Epoch")
        const { request } = await publicClient.simulateContract({
            account,
            abi: nftStakeABI,
            address: stakeAddress,
            functionName: "updatePoolL1",
        })

        const updatePoolL1Hash = await walletClient.writeContract(request)
        console.log(`Update Pool L1 Hash: ${chalk.blue(updatePoolL1Hash)}`)
    }
}

const withdrawL1Reward = async (stakeAddress: `0x${string}`) => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)

    displayConfirmAndExit("Continue to update L1 reward?")

    const { request } = await publicClient.simulateContract({
        account,
        abi: nftStakeABI,
        address: stakeAddress,
        functionName: "updateRewardL1",
        args: [
            agencyStrategy[0]
        ]
    })

    const updateRewardL1Hash = await walletClient.writeContract(request)
    console.log(`Update Reward L1 Hash: ${chalk.blue(updateRewardL1Hash)}`)
}

const updatePoolL2 = async (stakeAddress: `0x${string}`) => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)
    const nowBlockNumber = await publicClient.getBlockNumber()

    const l2StakingData = await publicClient.readContract({
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "stakingOfNFT",
        args: [agencyStrategy[0]]
    })
    // L2Staking Data
    if (l2StakingData[7] > nowBlockNumber) {
        console.log("In Epoch...")
    } else {
        const { request } = await publicClient.simulateContract({
            account,
            address: stakeAddress,
            abi: nftStakeABI,
            functionName: "updatePoolL2",
            args: [
                agencyStrategy[0]
            ]
        })

        const updatePoolL2Hash = await walletClient.writeContract(request)

        console.log(`Update Pool L2 Hash: ${chalk.blue(updatePoolL2Hash)}`)
    }
}

const withdrawReward = async (stakeAddress:  `0x${string}`) => {
    const { agencyTokenId, agencyStrategy } = await chooseAgencyNFTWithTokenId(userConfig)
    // const agentERC6551Address = await getAgentERC6551AddressByTokenID(agencyStrategy[0], agencyTokenId)
    // console.log(`Agent ERC6551 Address: ${chalk.blue(agentERC6551Address)}`)

    const reward = await publicClient.readContract({
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "pendingRewards",
        args: [
            agencyStrategy[0],
            agencyTokenId
        ]
    })

    console.log(`Withdraw Reward: ${chalk.blue(formatEther(reward))}`)

    displayConfirmAndExit("Continue to withdraw reward?")

    const { request } = await publicClient.simulateContract({
        account,
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "withdrawReward",
        args: [
            agencyStrategy[0],
            agencyTokenId
        ]
    })

    const withdrawRewardHash = await walletClient.writeContract(request)

    console.log(`Withdraw Reward Hash: ${chalk.blue(withdrawRewardHash)}`)
}

const unstakeAgencyNFT = async (stakeAddress: `0x${string}`) => {
    const { agencyTokenId, agencyStrategy } = await chooseAgencyNFTWithTokenId(userConfig)

    displayConfirmAndExit("Continue to unstake?")

    const { request } = await publicClient.simulateContract({
        account,
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "unstake",
        args: [
            agencyStrategy[0],
            agencyTokenId
        ]
    })

    const unstakeHash = await walletClient.writeContract(request)

    console.log(`Unstake Hash: ${chalk.blue(unstakeHash)}`)
}

const claimDotAgencyReward = async (stakeAddress: `0x${string}`) => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const tokenIdOfDotAgency = await publicClient.readContract({
        address: agencyAddress,
        abi: agencyABI,
        functionName: "tokenIdOfDotAgency"
    })

    const reward = await publicClient.readContract({
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "claimForDotAgencyAccount",
        args: [tokenIdOfDotAgency]
    })
    
    const { realizedReward, endBlockOfEpoch, appAddress } = await getDotAgencyRealizedReward(agencyAddress, stakeAddress)

    const nowBlockNumber = await publicClient.getBlockNumber()
    if (nowBlockNumber < endBlockOfEpoch) {
        // console.log(`When the block height reaches ${chalk.blue(endBlockOfEpoch)}, dotAgency will receive ${chalk.blue(realizedReward)} WRAP`)

        // console.log(`Claim Reward: ${chalk.blue(formatUnits(reward, 30))} WRAP`)

        displayConfirmAndExit("Continue to Claim .Agency reward?")
    } else {
        // console.log(`Claim Reward: ${chalk.blue(realizedReward)} WRAP`)
        const { request } = await publicClient.simulateContract({
            account,
            address: stakeAddress,
            abi: nftStakeABI,
            functionName: "updateRewardL1",
            args: [
                appAddress
            ]
        })

        const updateRewardL1Hash = await walletClient.writeContract(request)
        console.log(`Update Reward L1 Hash: ${chalk.blue(updateRewardL1Hash)}`)

        let newEndBlockOfEpoch = (await getAgentBaseInfo(appAddress, stakeAddress)).endBlockOfEpoch

        while (newEndBlockOfEpoch < nowBlockNumber) {
            newEndBlockOfEpoch = (await getAgentBaseInfo(appAddress, stakeAddress)).endBlockOfEpoch
            await sleep(12)
        }
    }
    
    const { request } = await publicClient.simulateContract({
        account,
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "claim",
        args: [
            tokenIdOfDotAgency
        ]
    })

    const withdrawRewardHash = await walletClient.writeContract(request)

    console.log(`Claim .Agency Reward Hash: ${chalk.blue(withdrawRewardHash)}`)
}

const nftStakeStep = async () => {
    const selectStake = await select({
        message: "Select the ERC7527 stake steps",
        choices: [
            {
                name: "Stake ERC7527",
                value: "stakeAgencyNFT",
            },
            {
                name: "Unstake ERC7527",
                value: "unstakeAgencyNFT",
            },
            {
                name: "Update Pool L1",
                value: "updatePoolL1",
                description: "Start a new L1 Epoch."
            },
            {
                name: "Update L1 Reward",
                value: "withdrawL1Reward",
                description: "Update dotAgency rewards and allocate rewards to L2"
            },
            {
                name: "Update Pool L2",
                value: "updatePoolL2",
                description: "Start a new L2 Epoch."
            },
            {
                name: "Claim .Agency Reward",
                value: "claimDotAgencyReward",
                description: "Claim rewards allocated to .Agency"
            },
            {
                name: "Withdraw ERC7527 Stake Reward",
                value: "withdrawReward",
                description: "Withdraw staking ERC7527 rewards"
            },
        ]
    })

    const stakeAddressConfig = stakeVersionSelect.getStakeVersion()

    switch (selectStake) {
        case "stakeAgencyNFT":
            await stakeAgencyNFT(stakeAddressConfig)
            break

        case "unstakeAgencyNFT":
            await unstakeAgencyNFT(stakeAddressConfig)
            break

        case "updatePoolL1":
            await updatePoolL1(stakeAddressConfig)
            break

        case "withdrawL1Reward":
            await withdrawL1Reward(stakeAddressConfig)
            break

        case "updatePoolL2":
            await updatePoolL2(stakeAddressConfig)
            break

        case "claimDotAgencyReward":
            await claimDotAgencyReward(stakeAddressConfig)
            break

        case "withdrawReward":
            await withdrawReward(stakeAddressConfig)
            break

        default:
            break
    }  
}

const stakeLP = async () => {
    const [userBalance, userAllowance] = await publicClient.multicall({
        contracts: [
            {
                address: uniswapV2Pair,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [walletClient.account!.address]
            },
            {
                address: uniswapV2Pair,
                abi: erc20Abi,
                functionName: "allowance",
                args: [walletClient.account!.address, lpStake.address]
            }
        ]
    })


    console.log(`LP Token Approve: ${chalk.blue(formatEther(userAllowance.result!))}`)
    console.log(`LP Token Balance: ${chalk.blue(formatEther(userBalance.result!))}`)

    displayConfirmAndExit("Continue to stake LP Token?")

    const depositAmount = await inputETHNumber("Input Deposit LP Token Amount: ", formatEther(userBalance.result!))

    if (depositAmount > userAllowance.result!) {
        const approveAmount = await inputETHNumber("Input Approve LP Token Amount for Stake: ", formatEther(depositAmount))

        const { request } = await publicClient.simulateContract({
            account,
            abi: erc20Abi,
            address: uniswapV2Pair,
            functionName: "approve",
            args: [
                lpStake.address,
                approveAmount
            ]
        })

        const approveHash = await walletClient.writeContract(request)

        console.log(`Approve Hash: ${chalk.blue(approveHash)}`)

        let approveValue = await getERC20Approve(uniswapV2Pair, lpStake.address)

        while (approveValue < approveAmount) {
            approveValue = await getERC20Approve(uniswapV2Pair, lpStake.address)
            await sleep(12)
        }   
    }


    const { request } = await publicClient.simulateContract({
        account,
        abi: lpStake.abi,
        address: lpStake.address,
        functionName: "deposit",
        args: [
            depositAmount
        ]
    })

    const stakeHash = await walletClient.writeContract(request)

    console.log(`Stake Hash: ${chalk.blue(stakeHash)}`)
}

const claimLP = async () => {
    const pendingReward = await publicClient.readContract({
        ...lpStake,
        functionName: "pending",
        args: [walletClient.account!.address]
    })

    console.log(`Pending Reward: ${chalk.blue(formatEther(pendingReward))}`)

    displayConfirmAndExit("Continue to claim reward?")

    const { request } = await publicClient.simulateContract({
        account,
        ...lpStake,
        functionName: "claim",
    })

    const claimHash = await walletClient.writeContract(request)

    console.log(`Claim Hash: ${chalk.blue(claimHash)}`)
}

const unstakeLP = async () => {
    const [depositAmount] = await publicClient.readContract({
        ...lpStake,
        functionName: "userInfo",
        args: [walletClient.account!.address]
    })

    console.log(`User Deposit Amount: ${formatEther(depositAmount)}`)

    const inputUnstakeAmount = await inputETHNumber("Input Unstake LP Token Amount: ", formatEther(depositAmount))

    if (inputUnstakeAmount > depositAmount) {
        console.log(`Input unstake amount is greater than user deposit amount`)
        return
    } else {
        displayConfirmAndExit("Continue to unstake LP Token?")

        const { request } = await publicClient.simulateContract({
            account,
            ...lpStake,
            functionName: "withdraw",
            args: [
                inputUnstakeAmount
            ]
        })

        const unstakeHash = await walletClient.writeContract(request)

        console.log(`Unstake Hash: ${chalk.blue(unstakeHash)}`)
    }
}

const lpTokenStep = async () => {
    const selectLpToken = await select({
        message: "Select LP Token Stake Steps",
        choices: [
            {
                name: "Stake LP Token",
                value: "stakeLP",
            },
            {
                name: "Claim LP Token Reward",
                value: "claimLP",
            },
            {
                name: "Unstake LP Token",
                value: "unstakeLP",
            }
        ]
    })

    switch (selectLpToken) {
        case "stakeLP":
            await stakeLP()
            break  

        case "claimLP":
            await claimLP()
            break

        case "unstakeLP":
            await unstakeLP()
            break

        default:
            break
    }
}

export const stakeSelect = async () => {
    const selectStake = await select({
        message: "Select the stake",
        choices: [
            {
                name: "ERC7527 Stake",
                value: "stakeNFT",
            },
            {
                name: "LP Token Stake",
                value: "lpToken",
            }
        ]
    })

    switch (selectStake) {
        case "stakeNFT":
            await versionSelect.setVersion();
            await stakeVersionSelect.setStakeVersion();
            await nftStakeStep()
            break

        case "lpToken":
            await lpTokenStep()
            break

        default:
            break
    }
}
