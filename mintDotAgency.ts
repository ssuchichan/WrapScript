import { account, walletClient, publicClient, agencyAndAppConfig, userConfig, defaultDotAgencyTokenURI, WrapCoinAddress, tokenURIEngineConfig } from "./config"
import { dotAgency } from "./abi/dotAgency"
import { factoryABI, wrapFactory } from "./abi/factory"
import { agencyABI, appABI } from './abi/agency'
import { agentABI } from './abi/agent'
import { erc6551AccountABI, erc6551Implementation, erc6551RegistryABI } from './abi/erc6551'
import { concat, encodeAbiParameters, formatEther, getAddress, getFunctionSelector, keccak256, toHex, parseAbi, encodeFunctionData, formatUnits, parseUnits, encodePacked, hexToString } from "viem"
import { confirm } from '@inquirer/prompts';
import { displayNotFundAndExit, inputAddress, selectWrapAddress, selectTokenId, inputETHNumber, inputMoreThanMinimumValue, chooseAgencyNFTWithTokenId, getExtraAgencyConfig, selectDotAgency, inputTokenNumber, selectOrInputTokenURIEngineAddress } from './utils/display'
import { exit } from 'node:process';
import input from '@inquirer/input';
import select from '@inquirer/select'
import fs from 'fs'
import chalk from 'chalk'
import boxen from 'boxen'
import { sleep } from "bun"
import { getAgencyStrategy, getAgentName, getDotAgencyERC6551AddressByTokenID, getERC20Approve, getTokenBaseInfo, isApproveOrOwner } from "./utils/data"
import { existAgentName } from "./utils/resolver"
import { WrapClaim } from "./abi/wrapClaim"
import { erc20Abi } from "./abi/erc20Abi"

const accountBalance = await publicClient.getBalance(account)

export const mintDotAgency = async () => {
    const nowDotAgencyPrice = await publicClient.readContract({
        ...dotAgency,
        functionName: "getPrice",
    })

    console.log(`.Agency Price is ${chalk.blue(formatEther(nowDotAgencyPrice))} ETH`)
    console.log(`Your ETH Balance is ${chalk.blue(formatEther(accountBalance))} ETH`)

    displayNotFundAndExit(nowDotAgencyPrice, accountBalance)

    const answer = await confirm({ message: 'Continue Mint .Agency?' });

    if (answer) {
        let dotAgencyName = (await input({ message: 'Enter .Agency Name: ' })).toLowerCase()
        while (!normalName(dotAgencyName)) {
            console.log(chalk.red("Name has been registeredThe name can only contain lowercase letters and Arabic numerals."))
            dotAgencyName = (await input({ message: 'Enter .Agency Name: ' })).toLowerCase()       
        }

        while (await existName(dotAgencyName)) {
            console.log(chalk.red("Name has been registered"))
            dotAgencyName = (await input({ message: 'Enter .Agency Name: ' })).toLowerCase()
        }

        const userPrice = await inputETHNumber("Maximum cost available for mint(ETH): ", formatEther(nowDotAgencyPrice * BigInt(21) / BigInt(20)))
        // const priceNonce = await getPriceNonce()

        await mintDotAgencyName(dotAgencyName, userPrice, BigInt(0))
    }
}

export const deployAppAndAgency = async () => {
    const deployAppAndAgencySelect = await select({
        message: "App and Agency Selection",
        choices: agencyAndAppConfig
    })

    const { agencyImplementation, appImplementation } = agencyAndAppConfig.find(({ value }) => value === deployAppAndAgencySelect)!

    let inputConfig = await getAgencyConfig(agencyImplementation as `0x${string}`, appImplementation as `0x${string}`)
    let configIsTrue = await confirm({ message: 'Continue Deploy App and Agency?' })

    while (!configIsTrue) {
        inputConfig = await getAgencyConfig(agencyImplementation as `0x${string}`, appImplementation as `0x${string}`)
        configIsTrue = await confirm({ message: 'Continue Deploy App and Agency?' })
    }

    await deployAgencyAndApp(inputConfig.tokenId, agencyImplementation as `0x${string}`, appImplementation as `0x${string}`, inputConfig.config, inputConfig.extraAgencyData)
    // console.log(`Agency Implementation: ${chalk.blue(agencyImplementation)}\nApp Implementation: ${chalk.blue(appImplementation)}`)
}

export const setTokenURIEngine = async () => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)
    // const tokenURIEngineAddress = await inputAddress("Enter TokenURI Engine Address(Default is Mobius-style): ", defaultAgentTokenURI)
    const tokenURIEngineAddress = await selectOrInputTokenURIEngineAddress()
    // console.log(tokenURIEngineAddress)
    const { request } = await publicClient.simulateContract({
        account,
        address: agencyStrategy[0],
        abi: agentABI,
        functionName: 'setProxyTokenURIEngine',
        args: [tokenURIEngineAddress]
    })

    const setTokenURIHash = await walletClient.writeContract(request)
    console.log(`Set TokenURI Engine Hash: ${chalk.blue(setTokenURIHash)}`)
}

export const changeDotAgencyTokenURI = async () => {
    const dotAgencyTokenId = await selectTokenId(userConfig)

    const authorityExist = await isApproveOrOwner(dotAgency.address, BigInt(dotAgencyTokenId))

    if (!authorityExist) {
        console.log(chalk.red('Not NFT Approve or Owner'))
        return
    } else {
        const tokenURI = await inputAddress('Enter TokenURI Engine Address: ', defaultDotAgencyTokenURI)
        const { request } = await publicClient.simulateContract({
            account,
            ...dotAgency,
            functionName: 'setTokenURIEngine',
            args: [BigInt(dotAgencyTokenId), tokenURI]
        })
    
        const setTokenURIHash = await walletClient.writeContract(request)
        console.log(`Set Agency TokenURI Hash: ${chalk.blue(setTokenURIHash)}`)
    }
}   

const getDotAgencyTokenId = async (agencyAddress: `0x${string}`) => {
    const agencyStrategy = await getAgencyStrategy(agencyAddress)
    const agencyDotAgencyTokenId = await publicClient.readContract({
        address: agencyStrategy[0],
        abi: agentABI,
        functionName: "tokenIdOfDotAgency",
    })

    return agencyDotAgencyTokenId
}

const getDotAgencyERC6551Address = async (agencyAddress: `0x${string}`) => {
    const agencyDotAgencyTokenId = await getDotAgencyTokenId(agencyAddress)

    const { result: dotAgencyNFTERC6551Address } = await publicClient.simulateContract({
        address: dotAgency.address,
        abi: erc6551RegistryABI,
        functionName: "createAccount",
        args: [
            erc6551Implementation,
            toHex("DEFAULT_ACCOUNT_SALT", { size: 32 }),
            BigInt(publicClient.chain!.id),
            dotAgency.address,
            agencyDotAgencyTokenId
        ],
    })
    
    return dotAgencyNFTERC6551Address
}

export const rebaseFee = async () => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)
    const { decimals} = await getTokenBaseInfo(agencyStrategy[1].currency)

    const dotAgencyNFTERC6551Address = await getDotAgencyERC6551Address(agencyAddress)

    console.log(`.Agency ERC6551 Address: ${chalk.blue(dotAgencyNFTERC6551Address)}`)

    const agencyFee = await publicClient.readContract({
        address: agencyAddress,
        abi: agencyABI,
        functionName: "feeCount",
    })

    const dotAgencyFee = agencyFee / BigInt(6)
    console.log(`Reward to claim: ${chalk.blue(formatUnits(dotAgencyFee * BigInt(5), decimals))}`)

    const answer = await confirm({ message: 'Continue Claim Reward from Agency?' });

    if (answer) {
        const { request } = await publicClient.simulateContract({
            address: agencyAddress,
            abi: agencyABI,
            functionName: "rebase",
        })

        const rebaseHash = await walletClient.writeContract(request)

        console.log(`Claim Reward Hash: ${chalk.blue(rebaseHash)}`)
    }
}

export const wrap = async () => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)

    // const tokenName = await getERC20Name(agencyStrategy[1].currency)
    const { name: tokenName, decimals: tokeDecimals } = await getTokenBaseInfo(agencyStrategy[1].currency)
    
    const userBalance = await getUserBalance(agencyStrategy[1].currency)

    const nowAgencyPrice = await getAgentMintPrice(agencyAddress, agencyStrategy[0])
    
    console.log(`ERC7527 Price is ${chalk.blue(formatUnits(nowAgencyPrice[0], tokeDecimals))} ${tokenName}, Fee is ${chalk.blue(formatUnits(nowAgencyPrice[1], tokeDecimals))} ${tokenName}`)
    console.log(`Your Balance is ${chalk.blue(formatUnits(userBalance, tokeDecimals))} ${tokenName}`)

    displayNotFundAndExit(nowAgencyPrice[0] + nowAgencyPrice[1], userBalance)
    
    const userSlippagePrice = await inputTokenNumber("Maximum cost available for mint: ", tokeDecimals, formatUnits((nowAgencyPrice[0] + nowAgencyPrice[1]) * BigInt(21) / BigInt(20), tokeDecimals))
    let agencyTokenName = (await input({ message: 'Enter ERC7527 Name: ' })).toLowerCase()

    while (await existAgentName(agencyTokenName, agencyStrategy[0])) {
        console.log(chalk.red("Name has been registered"))
        agencyTokenName = (await input({ message: 'Enter ERC7527 Name: ' })).toLowerCase()
    }

    const answer = await confirm({ message: 'Continue Mint ERC7527?' });

    if (answer) {
        await wrapAgency(agencyTokenName, userSlippagePrice, agencyAddress, agencyStrategy[1].currency)
    }
}

export const unwrap = async () => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)
    // const tokenName = await getERC20Name(agencyStrategy[1].currency)
    const { name: tokenName, decimals } = await getTokenBaseInfo(agencyStrategy[1].currency)

    const burnGet = await getAgenctBurnPrice(agencyAddress, agencyStrategy[0])

    console.log(`Burn ERC7527 will get ${chalk.blue(formatUnits(burnGet[0] - burnGet[1], decimals))} ${tokenName}`)

    const answer = await confirm({ message: 'Continue Burn ERC7527?' })

    if (answer) {
        const agencyTokenId = BigInt(await input({ message: 'Enter ERC7257 ID: ' }))
        const authorityExist = await isApproveOrOwner(agencyStrategy[0], agencyTokenId)

        if (!authorityExist) {
            console.log(chalk.red('Not NFT Approve or Owner'))
            return
        } else {
            const userSlippagePrice = BigInt(0)
            await unwrapAgency(agencyTokenId, userSlippagePrice, agencyAddress, tokenName)
        }
    }
}

export const setUserTokenURIEngine = async () => {
    const agencySelectConfig = await chooseAgencyNFTWithTokenId(userConfig)
    // const tokenURIEngineAddress = await inputAddress("Enter TokenURI Engine Address: ")
    const tokenURIEngineAddress = await selectOrInputTokenURIEngineAddress()
    const { request } = await publicClient.simulateContract({
        account,
        address: agencySelectConfig.agencyStrategy[0],
        abi: agentABI,
        functionName: 'setTokenURIEngine',
        args: [agencySelectConfig.agencyTokenId, tokenURIEngineAddress]
    })

    const setTokenURIHash = await walletClient.writeContract(request)
    console.log(`Set TokenURI Engine Hash: ${chalk.blue(setTokenURIHash)}`)
}

export const updateAgenctConfig = async () => {
    const appAddress = await inputAddress('Enter Your App Address: ')
    const agencyAddress = await publicClient.readContract({
        abi: agentABI,
        address: appAddress,
        functionName: "getAgency"
    })

    // const agencyAddress = await inputAddress('Enter Your Agency Address: ')

    const agencySettings = await getAgencyStrategy(agencyAddress)

    const tokenName = await getERC20Name(agencySettings[1].currency)

    const agencyName = await getAgentName(agencySettings[0])
    const agentMaxSupply = await getAgentMaxSupply(agencySettings[0])

    console.log(boxen(`Agency Name: ${chalk.blue(agencyName)}\n`
        + `Currency: ${chalk.blue(tokenName)}\n`
        + `Currency Address: ${chalk.blue(agencySettings[1].currency)}\n`
        + `Base Premium: ${chalk.blue(agencySettings[1].basePremium.toString(10))}\n`
        + `Mint Fee Percent: 5%\n`
        + `Burn Fee Percent: 5%\n`
        + `Max Supply: ${chalk.blue(agentMaxSupply === BigInt(0) ? 'Unlimited' : agentMaxSupply)}`, { padding: 1 }))
    console.log(`ERC7527 App Address: ${agencySettings[0]}`)
    console.log(`ERC7527 Agency Address: ${agencyAddress}`)
    const answer = await confirm({ message: 'Continue Update Agency Config?' })

    if (answer) {
        updateConfig(undefined, { value: agencyAddress, description: agencyName })
    } else {
        exit()
    }
}

export const createERC6551Account = async () => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)
    let userInputSalt = toHex("DEFAULT_ACCOUNT_SALT", { size: 32 })
    const tokenId = BigInt(await input({ message: 'Enter ERC7527 ID: ' }))
    const { request, result } = await publicClient.simulateContract({
        account,
        abi: erc6551RegistryABI,
        address: agencyStrategy[0],
        functionName: 'createAccount',
        args: [
            erc6551Implementation, 
            userInputSalt, 
            BigInt(publicClient.chain!.id),
            agencyStrategy[0],
            tokenId
        ]
    })

    console.log(`ERC6551 Account: ${chalk.blue(result)}`)

    const accountBytecode = await publicClient.getBytecode({
        address: result
    })

    if (!accountBytecode) {
        const createAccountHash = await walletClient.writeContract(request)
        console.log(`Create ERC6551 Account Hash: ${chalk.blue(createAccountHash)}`)
    }
}

const existName = async (name: string) => {
    const nameHash = keccak256(toHex(name))
    const subNode = keccak256(concat(['0xb43dbfc1d2fecc659fffd218f4abb6ed0b35bd3896ba6be21f0ca46fb2102ab1', nameHash]))

    const request = await publicClient.readContract({
        ...dotAgency,
        functionName: "isRecordExists",
        args: [subNode]
    })

    return request
}

const normalName = (name: string) => {
  const regex = /^[a-z0-9]+$/;

  return regex.test(name);
}

const updateConfig = async (tokenId?: { name: string, value: number }, agency?: { value: string, description: string }) => {
    if (tokenId) {
        userConfig.tokenId.push(tokenId)
    }
    if (agency) {
        userConfig.agency.push(agency)
    }
    fs.writeFileSync('config.json', JSON.stringify(userConfig))
}

// const getPriceNonce = async () => {
//     const { request, result } = await publicClient.simulateContract({
//         account,
//         ...dotAgency,
//         functionName: 'commit',
//     })

//     const commitHash = await walletClient.writeContract(request)
//     console.log(`Commit Hash: ${chalk.blue(commitHash)}`)

//     let oneEthToWrap = BigInt(0)

//     while (oneEthToWrap == BigInt(0)) {
//         oneEthToWrap = await publicClient.readContract({
//             ...dotAgency,
//             functionName: "getBidWrapPrice",
//             args: [result]
//         })
        
//         await sleep(12000)
//     }
    
//     console.log(`WRAP per ETH: ${chalk.blue(formatEther(oneEthToWrap))}`)

//     return result
// }

const mintDotAgencyName = async (name: string, price: bigint, priceNonce: bigint) => {
    // const oneEthToWrap = await publicClient.readContract({
    //     ...dotAgency,
    //     functionName: "getBidWrapPrice",
    //     args: [priceNonce]
    // })

    // if (oneEthToWrap == BigInt(0)) {
    //     console.log("Commit error, please re-execute the script")
    // } else {
    const { request, result } = await publicClient.simulateContract({
        account,
        ...dotAgency,
        value: price,
        functionName: 'mint',
        args: [name, priceNonce]
    })

    const mintHash = await walletClient.writeContract(request)

    console.log(`Token ID: ${chalk.blue(result.toString(10))}`)
    updateConfig({ name: name, value: Number(result) })
    console.log(`Mint Hash: ${chalk.blue(mintHash)}`)
    // }
}

const getERC20Name = async (tokenAddress: `0x${string}`) => {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return 'ETH'
    } else {
        const name = await publicClient.readContract({
            address: tokenAddress,
            abi: parseAbi(['function name() view returns (string)']),
            functionName: "name",
        })
        return name
    }
}

const setERC20Approve = async (tokenAddress: `0x${string}`, agencyAddress: `0x${string}`, tokenAmount: bigint) => {
    const { request } = await publicClient.simulateContract({
        account,
        address: tokenAddress,
        abi: parseAbi(['function approve(address, uint256) public returns (bool)']),
        functionName: 'approve',
        args: [agencyAddress, tokenAmount]
    })

    const approveHash = await walletClient.writeContract(request)
    console.log(`Approve Hash: ${chalk.blue(approveHash)}`)
}

const getAgentMaxSupply = async (agentAddress: `0x${string}`) => {
    const maxSupply = await publicClient.readContract({
        address: agentAddress,
        abi: agentABI,
        functionName: "getMaxSupply",
    })

    return maxSupply
}

const getERC20Balance = async (tokenAddress: `0x${string}`, accountAddress: `0x${string}`) => {
    const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: "balanceOf",
        args: [accountAddress]
    }) 

    return balance
}

const getUserBalance = async (tokenAddress: `0x${string}`) => {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return accountBalance
    } else {
        const balance = getERC20Balance(tokenAddress, account.address)

        return balance
    }
}

const getAgencyConfig = async (agencyImplementation: `0x${string}`, appImplementation: `0x${string}`) => {
    let tokenId: number;

    if (userConfig.tokenId.length === 0) {
        const name = await input({ message: 'Enter Your Agency Name:' })
        tokenId = Number.parseInt(await input({ message: 'Enter Your Agency Token ID:' }))
        updateConfig({ name: name, value: tokenId })
    } else {
        tokenId = Number.parseInt(await select({
            message: "Select Your .Agency",
            choices: userConfig.tokenId.map(({ name, value }) => {
                return {
                    name: name,
                    value: value.toString(10)
                }
            })
        }))
    }

    const redeployCheck = await publicClient.readContract({
        address: wrapFactory.address,
        abi: factoryABI,
        functionName: "app",
        args: [appImplementation, BigInt(tokenId)]
    })

    if (redeployCheck !== '0x0000000000000000000000000000000000000000') {
        console.log(chalk.red('Agency has been registered in factory'))
        exit()
    }
    // '0x0000000000000000000000000000000000000000'
    const currency = await inputAddress('Enter currency address (zero address is ETH):', WrapCoinAddress)
    // const currencyName = await getERC20Name(currency)
    const { name: currencyName, decimals: tokeDecimals } = await getTokenBaseInfo(currency)
    const basePremium = parseUnits(await input({ message: 'Enter Base Premium:' , default: "1"}), tokeDecimals)
    const feeRecipient = getAddress('0x0000000000000000000000000000000000000000')
    const mintFeePercent = 0
    const burnFeePercent = 0
    const maxSupply = Number.parseInt(await input({ message: 'Enter Max Supply(If set to 0, unlimited supply): ', default: "0" }), 10)

    const extraAgencyData = await getExtraAgencyConfig(agencyImplementation)

    console.log(boxen(`Currency: ${chalk.blue(currencyName)}\nBase Premium: ${chalk.blue(basePremium.toString(10))}\nMint Fee Percent: 5%\nBurn Fee Percent: 5%\nMax Supply: ${chalk.blue(maxSupply === 0 ? 'Unlimited' : maxSupply)}`, { padding: 1 }))
    
    return { tokenId, config: { currency, basePremium, feeRecipient, mintFeePercent, burnFeePercent, maxSupply }, extraAgencyData }
}

const deployAgencyAndApp = async (
    tokenId: number,
    agencyImplementation: `0x${string}`,
    appImplementation: `0x${string}`,
    assetConfig: {
        currency: `0x${string}`;
        basePremium: bigint;
        feeRecipient: `0x${string}`;
        mintFeePercent: number;
        burnFeePercent: number;
        maxSupply: number;
    },
    extraAgencyData: `0x${string}` = "0x"
) => {
    let appImmutableData: `0x${string}`

    if (assetConfig.maxSupply === 0) {
        appImmutableData = toHex(0, { size: 32 })
    } else {
        appImmutableData = toHex(assetConfig.maxSupply, { size: 32 })
    }

    const { request, result } = await publicClient.simulateContract({
        account,
        ...wrapFactory,
        functionName: 'deployERC7527',
        args: [
            {
                implementation: agencyImplementation,
                asset: {
                    ...assetConfig
                },
                immutableData: extraAgencyData,
                initData: "0x"
            },
            {
                implementation: appImplementation,
                immutableData: appImmutableData,
                initData: "0x" //getFunctionSelector("init()")
            },
            toHex(tokenId, { size: 32 })
        ]
    })

    console.log(`Agency Address: ${chalk.blue(result)}`)
    const deployHash = await walletClient.writeContract(request)
    const tokenName = userConfig.tokenId.find(({ value }) => value === tokenId)!.name
    updateConfig(undefined, { value: result, description: tokenName })
    console.log(`Deploy Agency Hash: ${chalk.blue(deployHash)}`)
}

const getAgencyTotalSupply = async (appAddress: `0x${string}`) => {
    const totalSupply = await publicClient.readContract({
        address: appAddress,
        abi: appABI,
        functionName: "totalSupply",
    })

    return totalSupply
}

const getAgentMintPrice = async (agencyAddress: `0x${string}`, appAddress: `0x${string}`) => {
    const totalSupply = await getAgencyTotalSupply(appAddress)

    const nowAgencyPrice = await publicClient.readContract({
        address: agencyAddress,
        abi: agencyABI,
        functionName: "getWrapOracle",
        args: [toHex(totalSupply, { size: 32 })]
    })

    return nowAgencyPrice
}

const getAgenctBurnPrice = async (agencyAddress: `0x${string}`, appAddress: `0x${string}`) => {
    const totalSupply = await getAgencyTotalSupply(appAddress)

    const nowAgencyBurnPrice = await publicClient.readContract({
        address: agencyAddress,
        abi: agencyABI,
        functionName: "getUnwrapOracle",
        args: [toHex(totalSupply, { size: 32 })]
    })
    // console.log(`Price: ${formatEther(nowAgencyBurnPrice[0])} And Fee: ${formatEther(nowAgencyBurnPrice[1])}`)
    return nowAgencyBurnPrice
}

const wrapAgency = async (name: string, price: bigint, agencyAddress: `0x${string}`, tokenAddress: `0x${string}`) => {
    const toAddress = await inputAddress('Enter ERC7527 Receiver Address: ', account.address)
    const args = encodeAbiParameters(
        [{ 'name': 'slippagePrice', 'type': 'uint256' }, { 'name': 'name', 'type': 'bytes' }],
        [price, encodeAbiParameters([{ 'name': 'name', 'type': 'string' }], [name])]
    )

    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        const { request, result } = await publicClient.simulateContract({
            account,
            value: price,
            address: agencyAddress,
            abi: agencyABI,
            functionName: 'wrap',
            args: [
                toAddress,
                args
            ]
        })

        console.log(`Wrap ERC7527 ID: ${chalk.blue(result)}`)
        const mintHash = await walletClient.writeContract(request)
        console.log(`Mint Hash: ${chalk.blue(mintHash)}`)
    } else {
        const userApproveValue = await getERC20Approve(tokenAddress, agencyAddress)
        const { decimals } = await getTokenBaseInfo(tokenAddress)
        console.log(`Approve Value: ${chalk.blue(formatUnits(userApproveValue, decimals))}`)
        if (userApproveValue < price) {
            const userNewApprove = await inputTokenNumber("Enter New Approve Value: ", decimals, formatUnits(price, decimals))
            await setERC20Approve(tokenAddress, agencyAddress, userNewApprove)
            let approveValue = await getERC20Approve(tokenAddress, agencyAddress)

            while (approveValue < price) {
                approveValue = await getERC20Approve(tokenAddress, agencyAddress)
                await sleep(12)
            }

            const { request, result } = await publicClient.simulateContract({
                account,
                address: agencyAddress,
                abi: agencyABI,
                functionName: 'wrap',
                args: [
                    toAddress,
                    args
                ]
            })

            console.log(`Wrap ERC7527 ID: ${chalk.blue(result)}`)
            const mintHash = await walletClient.writeContract(request)
            console.log(`Mint Hash: ${chalk.blue(mintHash)}`)
        } else {
            const { request, result } = await publicClient.simulateContract({
                account,
                address: agencyAddress,
                abi: agencyABI,
                functionName: 'wrap',
                args: [
                    toAddress,
                    args
                ]
            })

            console.log(`Wrap ERC7527 ID: ${chalk.blue(result)}`)
            const mintHash = await walletClient.writeContract(request)
            console.log(`Mint Hash: ${chalk.blue(mintHash)}`)
        }
    }
}

const unwrapAgency = async (tokenId: bigint, price: bigint, agencyAddress: `0x${string}`, tokenName: string) => {
    const toAddress = await inputAddress(`Enter ${tokenName} Receiver Address: `, account.address)
    const args = encodeAbiParameters(
        [{ 'name': 'slippagePrice', 'type': 'uint256' }, { 'name': 'name', 'type': 'bytes' }],
        [price, "0x"]
    )

    const { request } = await publicClient.simulateContract({
        account,
        address: agencyAddress,
        abi: agencyABI,
        functionName: 'unwrap',
        args: [
            toAddress, tokenId, args
        ]
    })

    const burnHash = await walletClient.writeContract(request)

    console.log(`Unwrap Hash: ${chalk.blue(burnHash)}`)
}

export const claimLockWrapCoin = async () => {
    // const agencyAddress = await selectWrapAddress(userConfig)
    const dotAgencyTokenId = BigInt(await selectDotAgency(userConfig))

    const unlockWrapCoin = await publicClient.readContract({
        ...WrapClaim,
        functionName: "unlockBalanceOfTokenId",
        args: [dotAgencyTokenId]
    })

    console.log(`You will receive ${formatEther(unlockWrapCoin)} WRAP`)

    const answer = await confirm({ message: 'Continue Claim?' })

    if (answer) {
        const dotAgencyNFTERC6551Address = await getDotAgencyERC6551AddressByTokenID(dotAgencyTokenId)
        const receiveAddress = await inputAddress("WRAP Recipient Address: ", walletClient.account!.address!)
        // console.log(`Wrap Recipient ERC6551 Address: ${chalk.blue(dotAgencyNFTERC6551Address)}`)
        const claimData = encodeFunctionData({
            abi: WrapClaim.abi,
            functionName: "claim",
            args: [dotAgencyTokenId]
        })
        
        const transferAmount = await publicClient.readContract({
            address: WrapCoinAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [dotAgencyNFTERC6551Address]
        })
        
        const transferCalldata = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [receiveAddress, transferAmount + unlockWrapCoin - BigInt(1)]
        })

        const { request } = await publicClient.simulateContract({
            account,
            address: dotAgencyNFTERC6551Address,
            abi: erc6551AccountABI,
            functionName: "executeBatch",
            args: [
                [
                    {target: WrapClaim.address, value: BigInt(0), data: claimData},
                    {target: WrapCoinAddress, value: BigInt(0), data: transferCalldata},
                ],
                0
            ]
        })

        const claimHash = await walletClient.writeContract(request)
        console.log(`Claim Hash: ${chalk.blue(claimHash)}`)
    }
}

export const renouncePush = async () => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const [ isRenounceForceApprove, isRenounceForceCancel, dotAgencyTokenId ] = await publicClient.multicall({
        contracts: [
            {
                address: agencyAddress,
                abi: agencyABI,
                functionName: "isRenounceForceApprove"
            },
            {
                address: agencyAddress,
                abi: agencyABI,
                functionName: "isRenounceForceCancel"
            },
            {
                address: agencyAddress,
                abi: agencyABI,
                functionName: "tokenIdOfDotAgency"
            }
        ]
    })

    // console.log(`isRenounceForceApprove: ${chalk.blue(isRenounceForceApprove.result)}`)
    if (!isRenounceForceApprove.result) {
        const renounceForceApprove = await confirm({ message: 'Renounce Force Approve?' })
        if (renounceForceApprove) {
            const { request } = await publicClient.simulateContract({
                account,
                address: agencyAddress,
                abi: agencyABI,
                functionName: "renounceForceApprove",
                args: [
                    encodeAbiParameters(
                        [{name: 'tokenId', type: 'uint256'}, {name: 'burn', type: 'bool'}],
                        [dotAgencyTokenId.result!, true]
                    )
                ]
            })

            const renounceForceApproveHash = await walletClient.writeContract(request)
            console.log(`Renounce Force Approve Hash: ${chalk.blue(renounceForceApproveHash)}`)
        }
    }

    if (!isRenounceForceCancel.result) {
        const renounceForceCancel = await confirm({ message: 'Renounce Force Cancel?' })
        if (renounceForceCancel) {
            const { request } = await publicClient.simulateContract({
                account,
                address: agencyAddress,
                abi: agencyABI,
                functionName: "renounceForceCancel",
                args: [
                    encodeAbiParameters(
                        [{name: 'tokenId', type: 'uint256'}, {name: 'burn', type: 'bool'}],
                        [dotAgencyTokenId.result!, true]
                    )
                ]
            })

            const renounceForceCancelHash = await walletClient.writeContract(request)
            console.log(`Renounce Force Cancel Hash: ${chalk.blue(renounceForceCancelHash)}`)
        } 
    }

    if (isRenounceForceApprove.result && isRenounceForceCancel.result) {
        console.log(`All Renounce Done.`)
    }
}

export const addDotAgency = async () => {
    const tokenId = await input({
        message: "Input Your DotAgency TokenId: "
    })
    // console.log(tokenId)
    const node = await publicClient.readContract({
        ...dotAgency,
        functionName: "getNode",
        args: [BigInt(tokenId)]
    })

    const name = hexToString(await publicClient.readContract({
        ...dotAgency,
        functionName: "getName",
        args: [node]
    }))
    
    // console.log()
    const isAddDotAgency = await confirm({ message: `Add ${chalk.blue(name)} to the configuration file?` })

    if (isAddDotAgency) {
        updateConfig({ name: name, value: Number(tokenId) })
    }
}
// claimLockWrapCoin()