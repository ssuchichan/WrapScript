import select from '@inquirer/select'
import { getDotAgencyEpochReward, getERC7527StakeData, lpStakeReward } from './utils/info';
import { calculateDotAgencyAPY, calculateLpAPY } from './utils/apy';
import { stakeVersionSelect } from './config';

const userSelect = await select({
    message: "WrapCoin Data",
    choices: [
        {
            name: "ERC7527 Token Stake Reward",
            value: "erc7527StakeReward",
            description: "Get the data of ERC7527 staking"
        },
        {
            name: "ERC7527 Stake Reward",
            value: "dotAgencyStakeReward",
            description: "Get the data of staking"
        },
        {
            name: "LP Stake Reward",
            value: "lpStakeReward",
            description: "Get the data of lp staking"
        },
        {
            name: "APY Summary",
            value: "apySummary",
            description: "Get the data of apy"
        }
    ]
})

await stakeVersionSelect.setStakeVersion();

switch (userSelect) {
    case "erc7527StakeReward":
        await getERC7527StakeData()
        break;
    case "dotAgencyStakeReward":
        await getDotAgencyEpochReward()
        break;
    case "lpStakeReward":
        await lpStakeReward()
        break;
    case "apySummary":
        await calculateDotAgencyAPY()
        await calculateLpAPY()
    default:
        break;
}