import { formatEther, parseAbi, toHex } from "viem"
import { agencyABI, appABI } from "../abi/agency"
import { dotAgency } from "../abi/dotAgency"
import { erc20Abi } from "../abi/erc20Abi"
import { erc6551Implementation, erc6551RegistryABI } from "../abi/erc6551"
import { account, publicClient } from "../config"
import { nftStake, nftStakeABI } from "../abi/stake"
import { wrapFactory } from "../abi/factory"
import { fantomSonicTestnet } from "viem/chains"

export const getAgencyStrategy = async (agencyAddress: `0x${string}`) => {
    const agencyStrategy = await publicClient.readContract({
        address: agencyAddress,
        abi: agencyABI,
        functionName: "getStrategy",
    })
    // TODo: erc20 token
    return agencyStrategy
}

export const isApproveOrOwner = async (appAddress: `0x${string}`, tokenId: bigint) => {
    let nftOwner: `0x${string}`
    
    try {
        nftOwner = await publicClient.readContract({
            address: appAddress,
            abi: appABI,
            functionName: "ownerOf",
            args: [tokenId]
        })     
    } catch (error) {
        return false
    }
    
    const results = await publicClient.multicall({
        contracts: [
            {
                address: appAddress,
                abi: appABI,
                functionName: "getApproved",
                args: [tokenId]
            },
            {
                address: appAddress,
                abi: appABI,
                functionName: "isApprovedForAll",
                args: [nftOwner, account.address]
            }
        ]
    })

    return nftOwner == account.address || results[1].result || results[0].result == account.address
}

export const getTokenBaseInfo = async (erc20Address: `0x${string}`) => {
    if (erc20Address === "0x0000000000000000000000000000000000000000") {
        return {
            name: "ETH",
            decimals: 18
        }
    } else {
        const [tokenName, tokeDecimals] = await publicClient.multicall({
            contracts: [
                {
                    address: erc20Address,
                    abi: erc20Abi,
                    functionName: "name"
                },
                {
                    address: erc20Address,
                    abi: erc20Abi,
                    functionName: "decimals"
                }
            ]
        })
    
        return {
            name: tokenName.result!,
            decimals: tokeDecimals.result!
        }
    }
}

export const getDotAgencyERC6551AddressByTokenID = async (tokenId: bigint) => {
    const { result: dotAgencyNFTERC6551Address } = await publicClient.simulateContract({
        address: dotAgency.address,
        abi: erc6551RegistryABI,
        functionName: "createAccount",
        args: [
            erc6551Implementation,
            toHex("DEFAULT_ACCOUNT_SALT", { size: 32 }),
            BigInt(publicClient.chain!.id),
            dotAgency.address,
            tokenId
        ],
    })
    
    return dotAgencyNFTERC6551Address
}

export const getAgentERC6551AddressByTokenID = async (agentAddress: `0x${string}`, tokenId: bigint) => {
    const { result: agentERC6551Address } = await publicClient.simulateContract({
        address: agentAddress,
        abi: erc6551RegistryABI,
        functionName: "createAccount",
        args: [
            erc6551Implementation,
            toHex("DEFAULT_ACCOUNT_SALT", { size: 32 }),
            BigInt(publicClient.chain!.id),
            agentAddress,
            tokenId
        ],
    })

    return agentERC6551Address
}

export const getERC20Approve = async (tokenAddress: `0x${string}`, agencyAddress: `0x${string}`) => {
    const result = await publicClient.readContract({
        address: tokenAddress,
        abi: parseAbi(['function allowance(address, address) view returns (uint256)']),
        functionName: "allowance",
        args: [account.address, agencyAddress]
    })

    return result
}

export const getAgentName = async (agentAddress: `0x${string}`) => {
    const agentName = await publicClient.readContract({
        address: agentAddress,
        abi: appABI,
        functionName: "name",
    })

    return agentName
}

export const getAgentBaseInfo = async (agentAddress: `0x${string}`, stakeAddress: `0x${string}`) => {
    const agentBaseInfo = await publicClient.readContract({
        address: stakeAddress,
        abi: nftStakeABI,
        functionName: "stakingOfNFT",
        args: [agentAddress]
    })

    return {
        tvl: agentBaseInfo[0],
        accTokenPerShare: agentBaseInfo[3], 
        points: agentBaseInfo[1], 
        lastRewardBlock: agentBaseInfo[2],
        tokenPerBlock: agentBaseInfo[5],
        endBlockOfEpoch: agentBaseInfo[7],
        unspentRewards: agentBaseInfo[6],
        rewardDebt: agentBaseInfo[4]
    }
}

export const getAgencyVersion = async (agencyAddress: `0x${string}`) => {
    const agencyTokenId = await publicClient.readContract({
        address: agencyAddress,
        abi: agencyABI,
        functionName: "tokenIdOfDotAgency"
    })

    const agencyImpl = await publicClient.readContract({
        ...wrapFactory,
        functionName: "agency",
        args: [agencyAddress, agencyTokenId]
    })

    let version: "v2" | "v3"

    if (agencyImpl == "0x120E8cC16D6Bd9BCc4E94609D668F96aB8BAA3D9") {
        version = "v2"
    } else if (agencyImpl == "0x78B979DDb11716e7af784edb970348f9584a5a12") {
        version = "v3"
    } else {
        version = "v3"
    }

    return version
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

export const getRealizedReward = async (
    stakeAddress: `0x${string}`,
    lastRewardBlock: bigint, 
    tokenPerBlock: bigint, 
    isWrapCoin: boolean, 
    accTokenPerShare: bigint, 
    tvlOfTotal: bigint,
    stakingTvl: bigint,
    rewardDebt: bigint
) => {
    const { endBlock } = await getL1EndBlock(stakeAddress)
    const tokenReward = (endBlock - lastRewardBlock) * tokenPerBlock;
    let newAccTokenPerShare: bigint

    if (isWrapCoin) {
        newAccTokenPerShare = accTokenPerShare + tokenReward * BigInt(1e12 * 37 / 40) / tvlOfTotal;
    } else {
        newAccTokenPerShare = accTokenPerShare + tokenReward * BigInt(1e12 * 3 / 40) / tvlOfTotal;
    }

    const reward = (newAccTokenPerShare - rewardDebt) * stakingTvl;

    return reward
}

export const getDotAgencyRealizedReward = async (agencyAddress: `0x${string}`, stakeAddress: `0x${string}`) => {
    let realizedReward: bigint;
    const [appAddress, settingData] = await getAgencyStrategy(agencyAddress)
    const stakeData = await getAgentBaseInfo(appAddress, stakeAddress)

    const [tokenPerBlock, lastRewardBlock] = await publicClient.multicall({
        contracts: [
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
    if (settingData.currency === "0x0000000000000000000000000000000000000000") {
        const [tvlOfTotal, accTokenPerShare] = await publicClient.readContract({
            address: stakeAddress,
            abi: nftStakeABI,
            functionName: "l1StakingOfETH"
        })

        realizedReward = (await getRealizedReward(
            stakeAddress,
            lastRewardBlock.result!,
            tokenPerBlock.result!,
            false,
            accTokenPerShare,
            tvlOfTotal,
            stakeData.tvl,
            stakeData.rewardDebt
        ) + stakeData.unspentRewards) * BigInt(5243) / BigInt(1e12 * 65536)
    } else {
        const [tvlOfTotal, accTokenPerShare] = await publicClient.readContract({
            address: stakeAddress,
            abi: nftStakeABI,
            functionName: "l1StakingOfERC20"
        })

        realizedReward = (await getRealizedReward(
            stakeAddress,
            lastRewardBlock.result!,
            tokenPerBlock.result!,
            true,
            accTokenPerShare,
            tvlOfTotal,
            stakeData.tvl,
            stakeData.rewardDebt
        ) + stakeData.unspentRewards) * BigInt(5243) / BigInt(1e12 * 65536)
    }

    return {
        realizedReward: formatEther(realizedReward),
        endBlockOfEpoch: stakeData.endBlockOfEpoch,
        appAddress
    }
}
// console.log(await getAgencyVersion("0xa55E3Ea7F5E0F4a7CB0dbc2C733D2fe2a5eDcBc4"))

// console.log(await getAgentBaseInfo("0x8ecea36c3161b17b3d30c3a253c628177998ee01", nftStake.address))