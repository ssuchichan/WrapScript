import { exit } from 'node:process';
import chalk from 'chalk'
import { isAddress, getAddress, parseEther, toHex, parseUnits } from "viem"
import { UserConfig, agencyConfig, tokenURIEngineConfig, userConfig, versionSelect } from '../config'
import { select, input } from '@inquirer/prompts';
import fs from 'fs'
import { getAgencyStrategy, getAgencyVersion, isApproveOrOwner } from './data';
import { nftStake, nftStakeV2 } from '../abi/stake';

export const displayNotFundAndExit = (price: bigint, balance: bigint) => {
    if (balance < price) {
        console.log(chalk.red("Insufficient account balance"))
        exit(1)
    }
}

export const displayConfirmAndExit = (message: string) => {
    const answer = confirm(message)
    if (!answer) {
        exit(1)
    }
}

export const inputAddress = async (message: string, defalutMessage?: string) => {
    const inputAddressString = getAddress(await input({ message, default: defalutMessage, validate: (value) => isAddress(value) }))
    return inputAddressString
}

export const inputETHNumber = async (message: string, defalutMessage?: string) => {
    const inputNumber = parseEther(await input({ message, default: defalutMessage })) as bigint
    return inputNumber
}

export const inputTokenNumber = async (message: string, decimals: number, defalutMessage?: string) => {
    const inputNumber = parseUnits(await input({ message, default: defalutMessage }), decimals)
    return inputNumber
}

export const inputMoreThanMinimumValue = async (message: string) => {
    const feePercent = Number.parseInt(await input({ message, validate: (value) => Number.parseInt(value) >= 500 }), 10)
    return feePercent
}

const mergeType = async (userConfig: UserConfig) => {
    if (userConfig.version === undefined) {
        const agency: agencyConfig[] = []
        const promises = userConfig.agency.map(async (item) => {
            const version = await getAgencyVersion(item.value as `0x${string}`);
            agency.push({ value: item.value, description: item.description, type: version });
        })
        
        await Promise.all(promises);
        userConfig.version = 2
        userConfig.agency = agency

        fs.writeFileSync('config.json', JSON.stringify(userConfig))
        return userConfig
    } else {
        return userConfig
    }
}

export const selectWrapAddress = async (userConfig: UserConfig) => {
    const version = versionSelect.getVersion()
    let address: `0x${string}`;
    const userConfigMerge = await mergeType(userConfig)

    if (userConfigMerge.agency.length === 0) {
        const description = await input({ message: 'Enter Your Agency Name:' })
        address = await inputAddress('Enter Your Agency Address:')
        const version = await getAgencyVersion(address)
        updateConfig(userConfigMerge, undefined, { value: address, description: description, type: version })
    } else {
        address = await select({
            message: "Select Your Agency Address",
            choices: userConfigMerge.agency.filter((item) => item.type == version).map(({ value, description }) => {
                return {
                    name: value,
                    description: description,
                    value: value
                }
            })
        }) as `0x${string}`
    }

    return address
}

export const selectDotAgency = async (userConfig: UserConfig) => {
    let tokenId: number;

    if (userConfig.tokenId.length === 0) {
        const name = await input({ message: 'Enter Your .Agency Name:' })
        tokenId = Number.parseInt(await input({ message: 'Enter Your .Agency Token ID:' }))

        updateConfig(userConfig, { name: name, value: tokenId })
    } else {
        tokenId = await select({
            message: "Select Your .Agency TokenId",
            choices: userConfig.tokenId.map(({ name, value }) => {
                return {
                    name: name,
                    value: value
                }
            })
        })
    }

    return tokenId
}

export const selectTokenId = async (userConfig: UserConfig) => {
    let tokenId: number;
    if (userConfig.tokenId.length === 0) {
        const name = await input({ message: 'Enter Your Agency Name:' })
        tokenId = Number.parseInt(await input({ message: 'Enter Your Agency Token ID:' }))
        updateConfig(userConfig, { name: name, value: tokenId })
    } else {
        tokenId = Number.parseInt(await select({
            message: "Select Your Agency Token",
            choices: userConfig.tokenId.map(({ name, value }) => {
                return {
                    name: name,
                    value: value.toString(10)
                }
            })
        }))
    }

    return tokenId
}

export const chooseAgencyNFTWithTokenId = async (userConfig: UserConfig) => {
    const agencyAddress = await selectWrapAddress(userConfig)
    const agencyStrategy = await getAgencyStrategy(agencyAddress)

    const agencyTokenId = BigInt(await input({ message: 'Enter ERC7527 ID: ' }))
    const authorityExist = await isApproveOrOwner(agencyStrategy[0], agencyTokenId)

    if (!authorityExist) {
        console.log(chalk.red('Not NFT Approve or Owner'))
        exit(1)
    }

    return { agencyTokenId, agencyStrategy }
}

export const selectOrInputTokenURIEngineAddress = async () => {
    let tokenURIEngineAddress = await select({
        message: "TokenURI Engine Selection",
        choices: tokenURIEngineConfig
    })

    if (tokenURIEngineAddress === "0x0") {
        tokenURIEngineAddress = await inputAddress("Enter TokenURI Engine Address: ")
    }

    return tokenURIEngineAddress
}

const updateConfig = async (userConfig: UserConfig, tokenId?: { name: string, value: number }, agency?: { value: string, description: string, type: "v2" | "v3" }) => {
    if (tokenId) {
        userConfig.tokenId.push(tokenId)
    }
    if (agency) {
        userConfig.agency.push(agency)
    }
    fs.writeFileSync('config.json', JSON.stringify(userConfig))
}

export const getExtraAgencyConfig = async (agencyImplementation: `0x${string}`) => {
    switch (agencyImplementation) {
        case "0xA1bFB2dfe4D74B7729ED986A3DfDB60Db95Ae9eE":
            const coef = Number(await input({ message: "Please enter the k(integer): " }))
            
            const finalArgs = toHex(coef, { size: 32})

            return finalArgs

        default:
            return "0x" as `0x${string}`
    }
}

export const makeVersionSelect = () => {
    let version: "v2" | "v3" = "v3"

    const setVersion = async () => {
        version = await select({
            message: "Wrap Coin Agency Version Selection",
            choices: [
                {
                    name: "V3",
                    value: "v3"
                },
                {
                    name: "V2",
                    value: "v2"
                }
            ]
        })
    }

    const getVersion = () => {
        return version
    }

    return {
        setVersion, getVersion
    }
}

export const makeStakeVersionSelect = () => {
    let stakeVersion: "v2" | "v1" = "v1"

    const setStakeVersion = async () => {
        // stakeVersion = "v1"
        stakeVersion = await select({
            message: "Wrap Coin Stake Version Selection",
            choices: [
                {
                    name: "V2",
                    value: "v2"
                },
                {
                    name: "V1",
                    value: "v1"
                }
            ]
        })
    }

    const getStakeVersion = () => {
        if (stakeVersion === "v1") {
            return nftStake.address as `0x${string}`
        } else {
            return nftStakeV2.address as `0x${string}`
        }
    }

    return {
        setStakeVersion, getStakeVersion
    }
}