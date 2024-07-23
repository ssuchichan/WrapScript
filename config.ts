import { createWalletClient, createPublicClient, http, PublicClient, WalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { localhost, mainnet, sepolia } from 'viem/chains'
import fs from 'fs'
import { makeStakeVersionSelect, makeVersionSelect } from './utils/display'
// https://1rpc.io/sepolia
// 0xEd78bF31CD8E36c628e048D0e47e9a38913d34eF
export const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
export let wrapVersion = "v3" 

interface tokenIdConfig {
  name: string,
  value: number
}

export interface agencyConfig {
  value: string,
  description: string
  type: "v2" | "v3"
}

export interface UserConfig {
  version: Number,
  tokenId: tokenIdConfig[],
  agency: agencyConfig[],
}

export const userConfig: UserConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
export const rpcUrl = process.env.RPC_URL
// console.log(rpcUrl)
export const walletClient: WalletClient = createWalletClient({
  account,
  chain: mainnet,
  // transport: http(rpcUrl)
  transport: http("http://127.0.0.1:8545")
})
// console.log(`Account Address: ${account.address}`)
export const publicClient: PublicClient = createPublicClient({
  chain: mainnet,
  // transport: http(rpcUrl)
  transport: http("http://127.0.0.1:8545")
}) as PublicClient;

export const agencyAndAppConfig = [
  // {
  //   "name": "WrapV1Linear",
  //   "value": "onePercentConfig",
  //   "description": "User minting price increases by basePremium percentage",
  //   "agencyImplementation": "0xaB0E85c463C27F8A5501B5933F6Da1D18Ab62283",
  //   "appImplementation": "0x1C91bEB7d3249846E226A029DE93BEb5eA1e4CFe"
  // },
  // {
  //   "name": "WrapV2Auction",
  //   "value": "auctionConfig",
  //   "description": "Minting prices are obtained through auctions",
  //   "agencyImplementation": "0x120E8cC16D6Bd9BCc4E94609D668F96aB8BAA3D9",
  //   "appImplementation": "0x48534DAEb3F0b7d91FcB2618C651aD075703f07E"
  // },
  {
    "name": "WrapV3Auction",
    "value": "auctionConfig",
    "description": "Minting prices are obtained through auctions",
    "agencyImplementation": "0x78B979DDb11716e7af784edb970348f9584a5a12",
    "appImplementation": "0x48534DAEb3F0b7d91FcB2618C651aD075703f07E"
  }
]

export const uniswapV2Pair = "0x5Ff788F688650d3b0cB37E976e71d604D8229064" as `0x${string}`

export const defaultDotAgencyTokenURI = "0xC61bbBb218d82DB23d76cEE8A1146aC6AF442Fe8" as `0x${string}`

export const defaultAgentResolver = "0x21244259bE899fE7FB798B198a8BD70AB9873ABB" as `0x${string}`
export const defaultDotAgencyResolver = "0x6aCca1410C16FfDD60866be84b541492C2398C4e" as `0x${string}`

export const WrapCoinAddress = "0x989436e4194af162546F595Afc6336A15b3DCa7d" as `0x${string}`

export const tokenURIEngineConfig = [
  {
    "name": "Animated Mobius Loop I",
    "value": "0x41C01cD8562f3726D9ff685397732A9694F8E197" as `0x${string}`,
  },
  {
    "name": "Animated Mobius Loop II",
    "value": "0xB0419aFd9530e36b9F56f959Fdd5adE04Dd637fa" as `0x${string}`,
  },
  {
    "name": "Other",
    "value": "0x0" as `0x${string}`,
    "description": "Manually enter the address of TokenURI Engine"
  }
]

export const versionSelect = makeVersionSelect();
export const stakeVersionSelect = makeStakeVersionSelect();